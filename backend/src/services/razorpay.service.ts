/**
 * Razorpay Payment Service
 * Handles split payments, Route integration, linked accounts, and payouts
 */

interface PaymentSplitConfig {
  vendor_id: string;
  order_value: number; // in paise
  commission_percentage: number;
  tds_percentage: number;
  tds_applicable: boolean;
}

interface RazorpayPaymentEvent {
  type: 'payment.captured' | 'payment.failed' | 'refund.created' | 'payout.processed';
  payment_id: string;
  amount: number;
  vendor_id?: string;
  reason?: string;
}

class RazorpayService {
  private static instance: RazorpayService;
  private razorpayKey: string;
  private razorpaySecret: string;

  private constructor() {
    this.razorpayKey = process.env.RAZORPAY_KEY_ID || '';
    this.razorpaySecret = process.env.RAZORPAY_KEY_SECRET || '';
  }

  public static getInstance(): RazorpayService {
    if (!RazorpayService.instance) {
      RazorpayService.instance = new RazorpayService();
    }
    return RazorpayService.instance;
  }

  /**
   * Calculate split payment allocation
   */
  calculateSplitPayment(config: PaymentSplitConfig): {
    platform_amount: number;
    vendor_amount: number;
    commission_amount: number;
    tds_amount: number;
  } {
    const commission = Math.floor((config.order_value * config.commission_percentage) / 100);
    let tds = 0;

    if (config.tds_applicable) {
      tds = Math.floor((config.order_value * config.tds_percentage) / 100);
    }

    const vendor_amount = config.order_value - commission - tds;

    return {
      platform_amount: commission,
      vendor_amount,
      commission_amount: commission,
      tds_amount: tds,
    };
  }

  /**
   * Create Razorpay linked account for vendor
   */
  async createLinkedAccount(vendor_id: string, vendorData: {
    gstin: string;
    pan: string;
    bank_account: string;
    ifsc: string;
    business_name: string;
    email: string;
    phone: string;
  }): Promise<{ account_id: string; status: string }> {
    try {
      // Mock Razorpay Route API call
      const accountId = `acc_${Math.random().toString(36).substr(2, 14)}`;

      console.log('[RAZORPAY] Linked account created', {
        vendor_id,
        account_id: accountId,
        business: vendorData.business_name,
      });

      // In production, make actual API call:
      // const response = await axios.post('https://api.razorpay.com/v1/accounts', {
      //   email: vendorData.email,
      //   phone: vendorData.phone,
      //   type: 'route',
      //   legal_business_name: vendorData.business_name,
      //   business_type: 'partnership',
      //   gstin: vendorData.gstin,
      //   notes: { vendor_id }
      // }, {
      //   auth: { username: this.razorpayKey, password: this.razorpaySecret }
      // });

      return {
        account_id: accountId,
        status: 'created',
      };
    } catch (error) {
      console.error('[RAZORPAY] Linked account creation failed', error);
      throw error;
    }
  }

  /**
   * Create split payment
   */
  async createSplitPayment(
    payment_id: string,
    splits: { linked_account_id: string; amount: number; description: string }[]
  ): Promise<{ split_id: string; status: string }> {
    try {
      const splitId = `split_${Math.random().toString(36).substr(2, 14)}`;

      console.log('[RAZORPAY] Split payment created', {
        payment_id,
        split_id: splitId,
        split_count: splits.length,
      });

      // In production, call Razorpay Route Split API
      // const response = await axios.post(
      //   `https://api.razorpay.com/v1/payments/${payment_id}/split`,
      //   { splits },
      //   { auth: { username: this.razorpayKey, password: this.razorpaySecret } }
      // );

      return {
        split_id: splitId,
        status: 'created',
      };
    } catch (error) {
      console.error('[RAZORPAY] Split payment creation failed', error);
      throw error;
    }
  }

  /**
   * Process vendor payout via Route
   */
  async processVendorPayout(
    vendor_id: string,
    razorpay_account_id: string,
    amount: number,
    description: string
  ): Promise<{ payout_id: string; status: string }> {
    try {
      const payoutId = `payout_${Math.random().toString(36).substr(2, 14)}`;

      console.log('[RAZORPAY] Vendor payout initiated', {
        vendor_id,
        account_id: razorpay_account_id,
        amount: `₹${(amount / 100).toFixed(2)}`,
        payout_id: payoutId,
      });

      // In production, make actual API call:
      // const response = await axios.post(
      //   `https://api.razorpay.com/v1/payouts`,
      //   {
      //     account_number: razorpay_account_id,
      //     amount: amount,
      //     currency: 'INR',
      //     mode: 'NEFT',
      //     purpose: description,
      //     narration: `BazaarHub Payout for ${vendor_id}`,
      //   },
      //   { auth: { username: this.razorpayKey, password: this.razorpaySecret } }
      // );

      return {
        payout_id: payoutId,
        status: 'initiated',
      };
    } catch (error) {
      console.error('[RAZORPAY] Payout processing failed', error);
      throw error;
    }
  }

  /**
   * Verify Razorpay webhook signature
   */
  verifyWebhookSignature(
    body: string,
    signature: string
  ): boolean {
    try {
      const crypto = require('crypto');
      const hash = crypto
        .createHmac('sha256', this.razorpaySecret)
        .update(body)
        .digest('hex');

      return hash === signature;
    } catch (error) {
      console.error('[RAZORPAY] Webhook signature verification failed', error);
      return false;
    }
  }

  /**
   * Handle payment.captured event
   */
  async handlePaymentCaptured(event: RazorpayPaymentEvent): Promise<void> {
    try {
      console.log('[RAZORPAY] Payment captured', {
        payment_id: event.payment_id,
        amount: `₹${(event.amount / 100).toFixed(2)}`,
      });

      // Trigger split payment
      // Emit event for order processing
      // Update order status
    } catch (error) {
      console.error('[RAZORPAY] Payment capture handling failed', error);
    }
  }

  /**
   * Handle payment.failed event
   */
  async handlePaymentFailed(event: RazorpayPaymentEvent): Promise<void> {
    try {
      console.log('[RAZORPAY] Payment failed', {
        payment_id: event.payment_id,
        reason: event.reason,
      });

      // Notify customer
      // Update order status to failed
      // Release held inventory
    } catch (error) {
      console.error('[RAZORPAY] Payment failure handling failed', error);
    }
  }

  /**
   * Handle refund.created event
   */
  async handleRefund(event: RazorpayPaymentEvent): Promise<void> {
    try {
      console.log('[RAZORPAY] Refund created', {
        payment_id: event.payment_id,
        amount: `₹${(event.amount / 100).toFixed(2)}`,
      });

      // Reverse commission and TDS
      // Adjust vendor payout
      // Update order status
    } catch (error) {
      console.error('[RAZORPAY] Refund handling failed', error);
    }
  }

  /**
   * Reconcile payments
   */
  async reconcilePayments(date: Date): Promise<{
    total_payments: number;
    total_amount: number;
    discrepancies: any[];
  }> {
    try {
      console.log('[RAZORPAY] Starting payment reconciliation', { date });

      // Fetch payments from Razorpay for the date
      // Compare with local records
      // Flag discrepancies

      return {
        total_payments: 0,
        total_amount: 0,
        discrepancies: [],
      };
    } catch (error) {
      console.error('[RAZORPAY] Reconciliation failed', error);
      throw error;
    }
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(payment_id: string): Promise<any> {
    try {
      // In production, fetch from Razorpay API
      return {
        id: payment_id,
        amount: 0,
        currency: 'INR',
        status: 'captured',
      };
    } catch (error) {
      console.error('[RAZORPAY] Failed to fetch payment details', error);
      throw error;
    }
  }
}

export default RazorpayService;
