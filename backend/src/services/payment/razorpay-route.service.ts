import Razorpay from 'razorpay';
import RedisService from '../redis';
import { v4 as uuidv4 } from 'uuid';

// Enums
export enum VendorAccountStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

export enum AccountType {
  SAVINGS = 'savings',
  CURRENT = 'current',
}

export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

export enum PayoutType {
  ORDER = 'order',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
}

// Interfaces
export interface VendorAccount {
  id: string;
  vendor_id: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  account_type: AccountType;
  pan: string;
  gstin?: string;
  business_name?: string;
  business_type?: string;
  business_address?: string;
  contact_phone?: string;
  contact_email?: string;
  razorpay_contact_id?: string;
  razorpay_fund_account_id?: string;
  status: VendorAccountStatus;
  commission_percentage: number;
  auto_payout_enabled: boolean;
  bank_verified: boolean;
  verified_at?: Date;
  verified_by?: string;
  verification_notes?: string;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
}

export interface VendorPayout {
  id: string;
  vendor_id: string;
  order_id?: string;
  payment_id?: string;
  payout_type: PayoutType;
  gross_amount: number;
  commission_percentage: number;
  commission_amount: number;
  net_payout: number;
  currency: string;
  transfer_id?: string;
  razorpay_contact_id?: string;
  status: PayoutStatus;
  retry_count: number;
  max_retries: number;
  next_retry_at?: Date;
  error_message?: string;
  error_details?: any;
  initiated_at?: Date;
  processed_at?: Date;
  completed_at?: Date;
  failed_at?: Date;
  vendor_notified: boolean;
  admin_notified: boolean;
  notes?: string;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

interface BankAccountDetails {
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  account_type?: AccountType;
}

interface KYCDetails {
  pan: string;
  gstin?: string;
  business_name?: string;
  business_type?: string;
  business_address?: string;
  contact_phone?: string;
  contact_email?: string;
}

interface PayoutSummary {
  total_payouts: number;
  pending_amount: number;
  completed_amount: number;
  failed_amount: number;
  total_commission: number;
  pending_count: number;
  completed_count: number;
  failed_count: number;
}

export class RazorpayRouteService {
  private razorpay: Razorpay;
  private redisService: RedisService;
  private static instance: RazorpayRouteService;

  private constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.warn('[Razorpay Route] Credentials not configured. Route API features will be disabled.');
      throw new Error('Razorpay credentials not configured');
    }

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    this.redisService = new RedisService();
  }

  static getInstance(): RazorpayRouteService {
    if (!RazorpayRouteService.instance) {
      try {
        RazorpayRouteService.instance = new RazorpayRouteService();
      } catch (error: any) {
        // Silently fail if credentials not configured
        console.warn('[Razorpay Route] Service initialization failed:', error.message);
        throw error;
      }
    }
    return RazorpayRouteService.instance;
  }

  /**
   * Create a linked account for vendor (Razorpay Route)
   */
  async createLinkedAccount(
    vendorId: string,
    bankDetails: BankAccountDetails,
    kycDetails: KYCDetails
  ): Promise<VendorAccount> {
    try {
      // Check if vendor account already exists
      const existingAccount = await this.getVendorAccount(vendorId).catch(() => null);

      if (existingAccount && existingAccount.razorpay_contact_id) {
        throw new Error('Vendor account already exists');
      }

      // Create contact in Razorpay
      const contact: any = await this.razorpay.customers.create({
        name: bankDetails.account_holder_name,
        email: kycDetails.contact_email || `vendor_${vendorId}@bazaarhub.com`,
        contact: kycDetails.contact_phone || '',
        notes: {
          vendor_id: vendorId,
          pan: kycDetails.pan,
          gstin: kycDetails.gstin || '',
          business_name: kycDetails.business_name || '',
        },
      } as any);

      // Create fund account for the contact
      const fundAccount: any = await this.razorpay.fundAccount.create({
        contact_id: contact.id,
        account_type: 'bank_account',
        bank_account: {
          name: bankDetails.account_holder_name,
          ifsc: bankDetails.ifsc_code,
          account_number: bankDetails.account_number,
        },
      } as any);

      // Create vendor account record
      const vendorAccount: VendorAccount = {
        id: uuidv4(),
        vendor_id: vendorId,
        account_number: bankDetails.account_number,
        ifsc_code: bankDetails.ifsc_code,
        account_holder_name: bankDetails.account_holder_name,
        account_type: bankDetails.account_type || AccountType.SAVINGS,
        pan: kycDetails.pan,
        gstin: kycDetails.gstin,
        business_name: kycDetails.business_name,
        business_type: kycDetails.business_type,
        business_address: kycDetails.business_address,
        contact_phone: kycDetails.contact_phone,
        contact_email: kycDetails.contact_email,
        razorpay_contact_id: contact.id,
        razorpay_fund_account_id: fundAccount.id,
        status: VendorAccountStatus.UNDER_REVIEW,
        commission_percentage: 10.0, // Default 10%
        auto_payout_enabled: true,
        bank_verified: fundAccount.active || false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Save to Redis
      await this.saveVendorAccount(vendorAccount);

      return vendorAccount;
    } catch (error: any) {
      console.error('Error creating linked account:', error);
      throw new Error(`Failed to create linked account: ${error.message}`);
    }
  }

  /**
   * Approve vendor account for payouts
   */
  async approveVendorAccount(
    vendorId: string,
    approvedBy: string,
    notes?: string
  ): Promise<VendorAccount> {
    const vendorAccount = await this.getVendorAccount(vendorId);

    vendorAccount.status = VendorAccountStatus.VERIFIED;
    vendorAccount.verified_at = new Date();
    vendorAccount.verified_by = approvedBy;
    vendorAccount.verification_notes = notes;
    vendorAccount.updated_at = new Date();

    await this.saveVendorAccount(vendorAccount);

    return vendorAccount;
  }

  /**
   * Reject vendor account
   */
  async rejectVendorAccount(
    vendorId: string,
    reason: string,
    rejectedBy: string
  ): Promise<VendorAccount> {
    const vendorAccount = await this.getVendorAccount(vendorId);

    vendorAccount.status = VendorAccountStatus.REJECTED;
    vendorAccount.rejection_reason = reason;
    vendorAccount.verified_by = rejectedBy;
    vendorAccount.verified_at = new Date();
    vendorAccount.updated_at = new Date();

    await this.saveVendorAccount(vendorAccount);

    return vendorAccount;
  }

  /**
   * Update commission percentage
   */
  async updateCommissionPercentage(
    vendorId: string,
    commissionPercentage: number
  ): Promise<VendorAccount> {
    const vendorAccount = await this.getVendorAccount(vendorId);

    if (commissionPercentage < 0 || commissionPercentage > 100) {
      throw new Error('Commission percentage must be between 0 and 100');
    }

    vendorAccount.commission_percentage = commissionPercentage;
    vendorAccount.updated_at = new Date();

    await this.saveVendorAccount(vendorAccount);

    return vendorAccount;
  }

  /**
   * Toggle auto payout
   */
  async toggleAutoPayout(
    vendorId: string,
    enabled: boolean
  ): Promise<VendorAccount> {
    const vendorAccount = await this.getVendorAccount(vendorId);

    vendorAccount.auto_payout_enabled = enabled;
    vendorAccount.updated_at = new Date();

    await this.saveVendorAccount(vendorAccount);

    return vendorAccount;
  }

  /**
   * Create payout with commission split
   */
  async createPayout(
    vendorId: string,
    orderId: string,
    paymentId: string,
    grossAmount: number, // in paise
    metadata?: any
  ): Promise<VendorPayout> {
    try {
      const vendorAccount = await this.getVendorAccount(vendorId);

      if (vendorAccount.status !== VendorAccountStatus.VERIFIED) {
        throw new Error('Vendor account not verified');
      }

      // Calculate commission
      const commissionPercentage = vendorAccount.commission_percentage;
      const commissionAmount = Math.floor(
        (grossAmount * commissionPercentage) / 100
      );
      const netPayout = grossAmount - commissionAmount;

      // Create payout record
      const payout: VendorPayout = {
        id: uuidv4(),
        vendor_id: vendorId,
        order_id: orderId,
        payment_id: paymentId,
        payout_type: PayoutType.ORDER,
        gross_amount: grossAmount,
        commission_percentage: commissionPercentage,
        commission_amount: commissionAmount,
        net_payout: netPayout,
        currency: 'INR',
        razorpay_contact_id: vendorAccount.razorpay_contact_id,
        status: PayoutStatus.PENDING,
        retry_count: 0,
        max_retries: 5,
        vendor_notified: false,
        admin_notified: false,
        metadata,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await this.savePayout(payout);

      // Initiate transfer if auto payout enabled
      if (vendorAccount.auto_payout_enabled) {
        await this.initiateTransfer(payout.id);
      }

      return payout;
    } catch (error: any) {
      console.error('Error creating payout:', error);
      throw new Error(`Failed to create payout: ${error.message}`);
    }
  }

  /**
   * Initiate transfer to vendor account
   */
  async initiateTransfer(payoutId: string): Promise<VendorPayout> {
    try {
      const payout = await this.getPayout(payoutId);

      if (payout.status !== PayoutStatus.PENDING) {
        throw new Error('Payout not in pending status');
      }

      const vendorAccount = await this.getVendorAccount(payout.vendor_id);

      if (!vendorAccount.razorpay_fund_account_id) {
        throw new Error('Fund account not configured');
      }

      // Create transfer using Razorpay Route
      const transfer: any = await this.razorpay.transfers.create({
        account: vendorAccount.razorpay_fund_account_id,
        amount: payout.net_payout,
        currency: payout.currency,
        notes: {
          payout_id: payout.id,
          order_id: payout.order_id || '',
          vendor_id: payout.vendor_id,
        },
      } as any);

      // Update payout with transfer details
      payout.transfer_id = transfer.id;
      payout.status = PayoutStatus.PROCESSING;
      payout.initiated_at = new Date();
      payout.updated_at = new Date();

      await this.savePayout(payout);

      return payout;
    } catch (error: any) {
      console.error('Error initiating transfer:', error);

      // Update payout with error
      const payout = await this.getPayout(payoutId);

      payout.status = PayoutStatus.FAILED;
      payout.failed_at = new Date();
      payout.error_message = error.message;
      payout.error_details = {
        code: error.statusCode,
        description: error.error?.description,
        source: error.error?.source,
        step: error.error?.step,
        reason: error.error?.reason,
      };
      payout.updated_at = new Date();

      await this.savePayout(payout);

      // Schedule retry
      await this.scheduleRetry(payout);

      throw error;
    }
  }

  /**
   * Handle transfer webhook
   */
  async handleTransferWebhook(event: any): Promise<void> {
    try {
      const transfer = event.payload.transfer.entity;
      const transferId = transfer.id;

      // Find payout by transfer ID
      const payout = await this.getPayoutByTransferId(transferId);

      if (!payout) {
        console.error('Payout not found for transfer:', transferId);
        return;
      }

      // Update payout status based on transfer status
      if (transfer.status === 'processed') {
        payout.status = PayoutStatus.COMPLETED;
        payout.processed_at = new Date();
        payout.completed_at = new Date();
      } else if (transfer.status === 'failed') {
        payout.status = PayoutStatus.FAILED;
        payout.failed_at = new Date();
        payout.error_message = transfer.failure_reason || 'Transfer failed';

        // Schedule retry
        await this.scheduleRetry(payout);
      } else if (transfer.status === 'reversed') {
        payout.status = PayoutStatus.REVERSED;
      }

      payout.updated_at = new Date();
      await this.savePayout(payout);

      // Clear retry schedule if completed
      if (payout.status === PayoutStatus.COMPLETED) {
        await this.clearRetrySchedule(payout.id);
      }
    } catch (error: any) {
      console.error('Error handling transfer webhook:', error);
      throw error;
    }
  }

  /**
   * Retry failed payout
   */
  async retryPayout(payoutId: string): Promise<VendorPayout> {
    const payout = await this.getPayout(payoutId);

    if (payout.status !== PayoutStatus.FAILED) {
      throw new Error('Only failed payouts can be retried');
    }

    if (payout.retry_count >= payout.max_retries) {
      throw new Error('Maximum retry attempts reached');
    }

    // Increment retry count
    payout.retry_count += 1;
    payout.status = PayoutStatus.PENDING;
    payout.error_message = undefined;
    payout.error_details = undefined;
    payout.updated_at = new Date();

    await this.savePayout(payout);

    // Initiate transfer
    return await this.initiateTransfer(payoutId);
  }

  /**
   * Schedule retry for failed payout
   */
  private async scheduleRetry(payout: VendorPayout): Promise<void> {
    if (payout.retry_count >= payout.max_retries) {
      // Notify admin about persistent failure
      await this.notifyAdminFailure(payout);
      return;
    }

    // Calculate exponential backoff (2^retry_count minutes)
    const delayMinutes = Math.pow(2, payout.retry_count);
    const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    payout.next_retry_at = nextRetryAt;
    await this.savePayout(payout);

    // Store in Redis for retry processing
    const redis = this.redisService.getClient();
    const retryKey = `payout:retry:${payout.id}`;
    await redis.set(
      retryKey,
      JSON.stringify({
        payout_id: payout.id,
        retry_count: payout.retry_count,
        next_retry_at: nextRetryAt.toISOString(),
      }),
      'EX',
      delayMinutes * 60
    );
  }

  /**
   * Clear retry schedule
   */
  private async clearRetrySchedule(payoutId: string): Promise<void> {
    const redis = this.redisService.getClient();
    const retryKey = `payout:retry:${payoutId}`;
    await redis.del(retryKey);
  }

  /**
   * Notify admin about persistent failure
   */
  private async notifyAdminFailure(payout: VendorPayout): Promise<void> {
    if (payout.admin_notified) {
      return;
    }

    // Store notification in Redis
    const redis = this.redisService.getClient();
    const notificationKey = `payout:admin:notification:${payout.id}`;
    await redis.set(
      notificationKey,
      JSON.stringify({
        payout_id: payout.id,
        vendor_id: payout.vendor_id,
        order_id: payout.order_id,
        amount: payout.net_payout,
        retry_count: payout.retry_count,
        error: payout.error_message,
        timestamp: new Date().toISOString(),
      }),
      'EX',
      86400 * 7 // Keep for 7 days
    );

    payout.admin_notified = true;
    await this.savePayout(payout);

    console.error('ADMIN ALERT: Payout failed after max retries:', {
      payout_id: payout.id,
      vendor_id: payout.vendor_id,
      amount: payout.net_payout / 100,
    });
  }

  /**
   * Get payout summary for vendor
   */
  async getPayoutSummary(vendorId: string): Promise<PayoutSummary> {
    const payouts = await this.getVendorPayouts(vendorId);

    const summary: PayoutSummary = {
      total_payouts: payouts.length,
      pending_amount: 0,
      completed_amount: 0,
      failed_amount: 0,
      total_commission: 0,
      pending_count: 0,
      completed_count: 0,
      failed_count: 0,
    };

    for (const payout of payouts) {
      summary.total_commission += Number(payout.commission_amount);

      if (payout.status === PayoutStatus.PENDING || payout.status === PayoutStatus.PROCESSING) {
        summary.pending_amount += Number(payout.net_payout);
        summary.pending_count++;
      } else if (payout.status === PayoutStatus.COMPLETED) {
        summary.completed_amount += Number(payout.net_payout);
        summary.completed_count++;
      } else if (payout.status === PayoutStatus.FAILED) {
        summary.failed_amount += Number(payout.net_payout);
        summary.failed_count++;
      }
    }

    return summary;
  }

  /**
   * Get admin notifications
   */
  async getAdminNotifications(): Promise<any[]> {
    const redis = this.redisService.getClient();
    const pattern = 'payout:admin:notification:*';
    const keys = await redis.keys(pattern);

    const notifications = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        notifications.push(JSON.parse(data));
      }
    }

    return notifications.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // Redis storage methods

  private async saveVendorAccount(account: VendorAccount): Promise<void> {
    const redis = this.redisService.getClient();
    const key = `vendor:account:${account.vendor_id}`;
    await redis.set(key, JSON.stringify(account));
  }

  async getVendorAccount(vendorId: string): Promise<VendorAccount> {
    const redis = this.redisService.getClient();
    const key = `vendor:account:${vendorId}`;
    const data = await redis.get(key);

    if (!data) {
      throw new Error('Vendor account not found');
    }

    return JSON.parse(data) as VendorAccount;
  }

  async getAllVendorAccounts(): Promise<VendorAccount[]> {
    const redis = this.redisService.getClient();
    const pattern = 'vendor:account:*';
    const keys = await redis.keys(pattern);

    const accounts = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        accounts.push(JSON.parse(data));
      }
    }

    return accounts;
  }

  private async savePayout(payout: VendorPayout): Promise<void> {
    const redis = this.redisService.getClient();
    const key = `payout:${payout.id}`;
    await redis.set(key, JSON.stringify(payout));

    // Add to vendor's payout list
    const listKey = `vendor:payouts:${payout.vendor_id}`;
    await redis.sadd(listKey, payout.id);

    // Index by transfer ID if available
    if (payout.transfer_id) {
      const transferKey = `payout:transfer:${payout.transfer_id}`;
      await redis.set(transferKey, payout.id);
    }
  }

  async getPayout(payoutId: string): Promise<VendorPayout> {
    const redis = this.redisService.getClient();
    const key = `payout:${payoutId}`;
    const data = await redis.get(key);

    if (!data) {
      throw new Error('Payout not found');
    }

    return JSON.parse(data) as VendorPayout;
  }

  private async getPayoutByTransferId(transferId: string): Promise<VendorPayout | null> {
    const redis = this.redisService.getClient();
    const transferKey = `payout:transfer:${transferId}`;
    const payoutId = await redis.get(transferKey);

    if (!payoutId) {
      return null;
    }

    return await this.getPayout(payoutId);
  }

  async getVendorPayouts(vendorId: string): Promise<VendorPayout[]> {
    const redis = this.redisService.getClient();
    const listKey = `vendor:payouts:${vendorId}`;
    const payoutIds = await redis.smembers(listKey);

    const payouts = [];
    for (const payoutId of payoutIds) {
      try {
        const payout = await this.getPayout(payoutId);
        payouts.push(payout);
      } catch (error) {
        console.error(`Error loading payout ${payoutId}:`, error);
      }
    }

    return payouts.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async getPayoutsByStatus(vendorId: string, status: PayoutStatus): Promise<VendorPayout[]> {
    const allPayouts = await this.getVendorPayouts(vendorId);
    return allPayouts.filter(p => p.status === status);
  }
}

export default RazorpayRouteService;
