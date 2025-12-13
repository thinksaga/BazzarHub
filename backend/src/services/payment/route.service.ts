import { RazorpayClient } from '../../config/razorpay';
import RedisService from '../redis';
import { v4 as uuidv4 } from 'uuid';

interface VendorDetails {
  vendor_id: string;
  email: string;
  phone: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_account_holder_name: string;
  pan?: string;
  gstin?: string;
  business_name?: string;
  business_type?: 'individual' | 'partnership' | 'company' | 'llp';
}

interface LinkedAccount {
  id: string;
  vendor_id: string;
  razorpay_account_id: string;
  razorpay_contact_id: string;
  razorpay_fund_account_id: string;
  status: 'active' | 'suspended';
  email: string;
  phone: string;
  account_verified: boolean;
  created_at: Date;
}

interface TransferSplit {
  vendor_amount: number;
  commission_amount: number;
  tds_amount: number;
  net_transfer_amount: number;
}

interface Transfer {
  id: string;
  payment_id: string;
  order_id: string;
  vendor_id: string;
  razorpay_transfer_id: string;
  amount: number;
  currency: string;
  commission: number;
  tds: number;
  net_amount: number;
  status: 'pending' | 'processed' | 'failed' | 'reversed' | 'on_hold';
  on_hold: boolean;
  on_hold_until?: Date;
  release_trigger?: 'delivery_confirmed' | 'manual' | 'auto';
  notes?: any;
  created_at: Date;
  processed_at?: Date;
}

export class RouteService {
  private razorpayClient: RazorpayClient;
  private redisService: RedisService;
  private static instance: RouteService;

  // Commission and TDS rates
  private readonly DEFAULT_COMMISSION_RATE = 10; // 10%
  private readonly TDS_RATE_WITH_PAN = 0; // 0% TDS if PAN provided
  private readonly TDS_RATE_WITHOUT_PAN = 1; // 1% TDS if no PAN

  private constructor() {
    this.razorpayClient = RazorpayClient.getInstance();
    this.redisService = new RedisService();
  }

  static getInstance(): RouteService {
    if (!RouteService.instance) {
      RouteService.instance = new RouteService();
    }
    return RouteService.instance;
  }

  /**
   * Onboard vendor with Razorpay Route
   * Creates a Linked Account for split payments
   */
  async createLinkedAccount(vendor: VendorDetails): Promise<LinkedAccount> {
    try {
      const razorpay = this.razorpayClient.getRazorpay();

      // Check if vendor already has linked account
      const existing = await this.getLinkedAccountByVendorId(vendor.vendor_id);
      if (existing) {
        throw new Error('Vendor already has a linked account');
      }

      console.log('[Route Service] Creating linked account for vendor:', vendor.vendor_id);

      // Create Linked Account (Route API)
      // This creates a sub-merchant account that can receive transfers
      const account: any = await this.razorpayClient.withRetry(
        () => razorpay.accounts.create({
          email: vendor.email,
          phone: vendor.phone,
          legal_business_name: vendor.business_name || vendor.bank_account_holder_name,
          business_type: vendor.business_type || 'individual',
          contact_name: vendor.bank_account_holder_name,
          profile: {
            category: 'ecommerce',
            subcategory: 'marketplace',
          },
          bank_account: {
            ifsc_code: vendor.bank_ifsc,
            account_number: vendor.bank_account_number,
            beneficiary_name: vendor.bank_account_holder_name,
          },
          tnc_accepted: true,
        } as any)
      );

      console.log('[Route Service] Linked account created:', account.id);

      // Create linked account record
      const linkedAccount: LinkedAccount = {
        id: uuidv4(),
        vendor_id: vendor.vendor_id,
        razorpay_account_id: account.id, // acc_... ID
        razorpay_contact_id: '', // Not used in Route
        razorpay_fund_account_id: '', // Not used in Route
        status: 'active',
        email: vendor.email,
        phone: vendor.phone,
        account_verified: true, // Assumed true for Route accounts initially
        created_at: new Date(),
      };

      // Save to Redis
      await this.saveLinkedAccount(linkedAccount);

      // Log event
      await this.logRouteEvent('linked_account_created', {
        vendor_id: vendor.vendor_id,
        razorpay_account_id: account.id,
      });

      return linkedAccount;
    } catch (error: any) {
      console.error('[Route Service] Error creating linked account:', error);
      throw new Error(`Failed to create linked account: ${error.message}`);
    }
  }

  /**
   * Calculate payment splits (vendor amount, commission, TDS)
   */
  calculateSplits(
    orderAmount: number,
    commissionRate?: number,
    hasPAN: boolean = true
  ): TransferSplit {
    // Use custom commission rate or default
    const commission = commissionRate || this.DEFAULT_COMMISSION_RATE;

    // Calculate commission amount
    const commissionAmount = Math.floor((orderAmount * commission) / 100);

    // Calculate TDS (only if no PAN)
    const tdsRate = hasPAN ? this.TDS_RATE_WITH_PAN : this.TDS_RATE_WITHOUT_PAN;
    const tdsAmount = Math.floor((orderAmount * tdsRate) / 100);

    // Calculate net transfer to vendor
    const vendorAmount = orderAmount - commissionAmount - tdsAmount;

    return {
      vendor_amount: vendorAmount,
      commission_amount: commissionAmount,
      tds_amount: tdsAmount,
      net_transfer_amount: vendorAmount,
    };
  }

  /**
   * Create transfer to vendor's linked account
   * Supports instant or on-hold transfers
   */
  async createTransfer(
    paymentId: string,
    orderId: string,
    vendorId: string,
    amount: number,
    commission?: number,
    onHold: boolean = false,
    onHoldUntil?: Date
  ): Promise<Transfer> {
    try {
      const razorpay = this.razorpayClient.getRazorpay();

      // Get vendor's linked account
      const linkedAccount = await this.getLinkedAccountByVendorId(vendorId);
      if (!linkedAccount) {
        throw new Error('Vendor does not have a linked account');
      }

      if (linkedAccount.status !== 'active') {
        throw new Error('Vendor account is not active');
      }

      // Get vendor details to check for PAN
      const hasPAN = await this.vendorHasPAN(vendorId);

      // Calculate splits
      const splits = this.calculateSplits(amount, commission, hasPAN);

      // Create transfer options
      const transferOptions: any = {
        account: linkedAccount.razorpay_account_id, // Use the Route Account ID (acc_...)
        amount: splits.net_transfer_amount,
        currency: 'INR',
        notes: {
          order_id: orderId,
          vendor_id: vendorId,
          payment_id: paymentId,
          commission: splits.commission_amount,
          tds: splits.tds_amount,
          created_by: 'bazaarhub_marketplace',
        },
      };

      // Add on-hold configuration if requested
      if (onHold) {
        transferOptions.on_hold = true;
        if (onHoldUntil) {
          transferOptions.on_hold_until = Math.floor(onHoldUntil.getTime() / 1000);
        }
      }

      // Create transfer with Razorpay
      const razorpayTransfer: any = await this.razorpayClient.withRetry(
        () => razorpay.transfers.create(transferOptions as any)
      );

      console.log('[Route Service] Transfer created:', razorpayTransfer.id);

      // Create transfer record
      const transfer: Transfer = {
        id: uuidv4(),
        payment_id: paymentId,
        order_id: orderId,
        vendor_id: vendorId,
        razorpay_transfer_id: razorpayTransfer.id,
        amount: amount,
        currency: 'INR',
        commission: splits.commission_amount,
        tds: splits.tds_amount,
        net_amount: splits.net_transfer_amount,
        status: onHold ? 'on_hold' : 'pending',
        on_hold: onHold,
        on_hold_until: onHoldUntil,
        release_trigger: onHold ? 'delivery_confirmed' : undefined,
        notes: transferOptions.notes,
        created_at: new Date(),
      };

      // Save transfer
      await this.saveTransfer(transfer);

      // Log event
      await this.logRouteEvent('transfer_created', {
        transfer_id: transfer.id,
        vendor_id: vendorId,
        amount: splits.net_transfer_amount,
        on_hold: onHold,
      });

      return transfer;
    } catch (error: any) {
      console.error('[Route Service] Error creating transfer:', error);
      throw new Error(`Failed to create transfer: ${error.message}`);
    }
  }

  /**
   * Get transfer status from Razorpay
   */
  async getTransferStatus(transferId: string): Promise<Transfer | null> {
    try {
      // First check local record
      const transfer = await this.getTransfer(transferId);
      if (!transfer) {
        return null;
      }

      // Fetch latest status from Razorpay
      const razorpay = this.razorpayClient.getRazorpay();
      const razorpayTransfer: any = await razorpay.transfers.fetch(
        transfer.razorpay_transfer_id
      );

      // Update transfer status
      transfer.status = this.mapRazorpayStatus(razorpayTransfer.status);
      
      if (razorpayTransfer.processed_at) {
        transfer.processed_at = new Date(razorpayTransfer.processed_at * 1000);
      }

      // Save updated transfer
      await this.saveTransfer(transfer);

      return transfer;
    } catch (error: any) {
      console.error('[Route Service] Error fetching transfer status:', error);
      return null;
    }
  }

  /**
   * Reverse transfer (for cancellations or returns)
   */
  async reverseTransfer(
    transferId: string,
    reason: string
  ): Promise<{ reversed: boolean; transfer?: Transfer; error?: string }> {
    try {
      const transfer = await this.getTransfer(transferId);
      
      if (!transfer) {
        return {
          reversed: false,
          error: 'Transfer not found',
        };
      }

      if (transfer.status === 'reversed') {
        return {
          reversed: true,
          transfer,
        };
      }

      if (transfer.status !== 'processed' && transfer.status !== 'on_hold') {
        return {
          reversed: false,
          error: 'Only processed or on-hold transfers can be reversed',
        };
      }

      // Reverse transfer with Razorpay
      const razorpay = this.razorpayClient.getRazorpay();
      const reversedTransfer: any = await this.razorpayClient.withRetry(
        () => razorpay.transfers.reverse(transfer.razorpay_transfer_id, {
          notes: {
            reason,
            reversed_by: 'bazaarhub_marketplace',
          },
        } as any)
      );

      console.log('[Route Service] Transfer reversed:', reversedTransfer.id);

      // Update transfer status
      transfer.status = 'reversed';
      transfer.notes = {
        ...transfer.notes,
        reversal_reason: reason,
        reversed_at: new Date().toISOString(),
      };

      await this.saveTransfer(transfer);

      // Log event
      await this.logRouteEvent('transfer_reversed', {
        transfer_id: transfer.id,
        vendor_id: transfer.vendor_id,
        amount: transfer.net_amount,
        reason,
      });

      return {
        reversed: true,
        transfer,
      };
    } catch (error: any) {
      console.error('[Route Service] Error reversing transfer:', error);
      return {
        reversed: false,
        error: error.message,
      };
    }
  }

  /**
   * Release on-hold transfer (after delivery confirmation)
   */
  async releaseTransfer(
    transferId: string,
    trigger: 'delivery_confirmed' | 'manual' | 'auto' = 'manual'
  ): Promise<{ released: boolean; transfer?: Transfer; error?: string }> {
    try {
      const transfer = await this.getTransfer(transferId);
      
      if (!transfer) {
        return {
          released: false,
          error: 'Transfer not found',
        };
      }

      if (!transfer.on_hold) {
        return {
          released: false,
          error: 'Transfer is not on hold',
        };
      }

      // Release transfer by editing on_hold to false
      const razorpay = this.razorpayClient.getRazorpay();
      const releasedTransfer: any = await this.razorpayClient.withRetry(
        () => razorpay.transfers.edit(transfer.razorpay_transfer_id, {
          on_hold: false,
        } as any)
      );

      console.log('[Route Service] Transfer released:', releasedTransfer.id);

      // Update transfer
      transfer.on_hold = false;
      transfer.release_trigger = trigger;
      transfer.status = 'pending';
      transfer.notes = {
        ...transfer.notes,
        released_at: new Date().toISOString(),
        release_trigger: trigger,
      };

      await this.saveTransfer(transfer);

      // Log event
      await this.logRouteEvent('transfer_released', {
        transfer_id: transfer.id,
        vendor_id: transfer.vendor_id,
        trigger,
      });

      return {
        released: true,
        transfer,
      };
    } catch (error: any) {
      console.error('[Route Service] Error releasing transfer:', error);
      return {
        released: false,
        error: error.message,
      };
    }
  }

  /**
   * Get transfers for a vendor
   */
  async getVendorTransfers(vendorId: string): Promise<Transfer[]> {
    try {
      const redis = this.redisService.getClient();
      const pattern = `transfer:vendor:${vendorId}:*`;
      const keys = await redis.keys(pattern);

      const transfers = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          transfers.push(JSON.parse(data));
        }
      }

      return transfers.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('[Route Service] Error fetching vendor transfers:', error);
      return [];
    }
  }

  /**
   * Get transfers for an order
   */
  async getOrderTransfers(orderId: string): Promise<Transfer[]> {
    try {
      const redis = this.redisService.getClient();
      const pattern = `transfer:order:${orderId}:*`;
      const keys = await redis.keys(pattern);

      const transfers = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          transfers.push(JSON.parse(data));
        }
      }

      return transfers;
    } catch (error) {
      console.error('[Route Service] Error fetching order transfers:', error);
      return [];
    }
  }

  // Private helper methods

  private async getLinkedAccountByVendorId(vendorId: string): Promise<LinkedAccount | null> {
    try {
      const redis = this.redisService.getClient();
      const key = `linked_account:vendor:${vendorId}`;
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as LinkedAccount;
    } catch (error) {
      return null;
    }
  }

  private async saveLinkedAccount(account: LinkedAccount): Promise<void> {
    const redis = this.redisService.getClient();
    
    // Save by vendor ID
    await redis.set(`linked_account:vendor:${account.vendor_id}`, JSON.stringify(account));
    
    // Index by account ID
    await redis.set(`linked_account:${account.id}`, JSON.stringify(account));
  }

  private async getTransfer(transferId: string): Promise<Transfer | null> {
    try {
      const redis = this.redisService.getClient();
      const key = `transfer:${transferId}`;
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as Transfer;
    } catch (error) {
      return null;
    }
  }

  private async saveTransfer(transfer: Transfer): Promise<void> {
    const redis = this.redisService.getClient();
    
    // Save by transfer ID
    await redis.set(`transfer:${transfer.id}`, JSON.stringify(transfer));
    
    // Index by vendor ID
    await redis.set(`transfer:vendor:${transfer.vendor_id}:${transfer.id}`, JSON.stringify(transfer));
    
    // Index by order ID
    await redis.set(`transfer:order:${transfer.order_id}:${transfer.id}`, JSON.stringify(transfer));
    
    // Index by Razorpay transfer ID
    await redis.set(`transfer:razorpay:${transfer.razorpay_transfer_id}`, JSON.stringify(transfer));
  }

  private async vendorHasPAN(vendorId: string): Promise<boolean> {
    try {
      const linkedAccount = await this.getLinkedAccountByVendorId(vendorId);
      if (!linkedAccount) {
        return false;
      }

      // Check if PAN exists in vendor notes
      const razorpay = this.razorpayClient.getRazorpay();
      const contact: any = await razorpay.customers.fetch(linkedAccount.razorpay_contact_id);
      
      return !!(contact.notes && contact.notes.pan);
    } catch (error) {
      return false;
    }
  }

  private mapRazorpayStatus(razorpayStatus: string): Transfer['status'] {
    switch (razorpayStatus) {
      case 'processed':
        return 'processed';
      case 'failed':
        return 'failed';
      case 'reversed':
        return 'reversed';
      case 'pending':
      default:
        return 'pending';
    }
  }

  private async logRouteEvent(event: string, data: any): Promise<void> {
    const redis = this.redisService.getClient();
    const log = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    
    const logKey = `route:log:${Date.now()}:${uuidv4()}`;
    await redis.set(logKey, JSON.stringify(log), 'EX', 86400 * 30); // Keep for 30 days
  }
}

export default RouteService;
