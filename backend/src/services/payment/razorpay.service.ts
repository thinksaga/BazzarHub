import Razorpay from 'razorpay';
import crypto from 'crypto';
import RedisService from '../redis';

export interface RazorpayConfig {
  key_id: string;
  key_secret: string;
  webhook_secret: string;
}

export interface PaymentOrder {
  amount: number; // in smallest currency unit (paise for INR)
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
  partial_payment?: boolean;
}

export interface CreateOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export interface PaymentDetails {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  method: string;
  description: string;
  email: string;
  contact: string;
  fee: number;
  tax: number;
  error_code?: string;
  error_description?: string;
  created_at: number;
}

export interface RefundDetails {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  payment_id: string;
  status: string;
  created_at: number;
}

export interface PaymentMethodPreference {
  method: string;
  count: number;
  success_rate: number;
  avg_amount: number;
}

export class RazorpayService {
  private razorpay: Razorpay;
  private keySecret: string;
  private webhookSecret: string;
  private redisService: RedisService;
  private readonly PAYMENT_PREFERENCES_KEY = 'payment:preferences';
  private readonly PAYMENT_RETRY_KEY = 'payment:retry';
  private readonly MAX_RETRY_ATTEMPTS = 3;

  constructor(config: RazorpayConfig, redisService: RedisService) {
    this.razorpay = new Razorpay({
      key_id: config.key_id,
      key_secret: config.key_secret,
    });
    this.keySecret = config.key_secret;
    this.webhookSecret = config.webhook_secret;
    this.redisService = redisService;
  }

  /**
   * Create a Razorpay order for checkout
   */
  async createOrder(orderData: PaymentOrder): Promise<CreateOrderResponse> {
    try {
      const order = await this.razorpay.orders.create({
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        receipt: orderData.receipt,
        notes: orderData.notes,
        partial_payment: orderData.partial_payment || false,
      });

      console.log('[Razorpay] Order created:', order.id);
      return order as CreateOrderResponse;
    } catch (error: any) {
      console.error('[Razorpay] Failed to create order:', error);
      throw new Error(`Failed to create Razorpay order: ${error.message}`);
    }
  }

  /**
   * Verify payment signature for security
   */
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    try {
      const text = `${orderId}|${paymentId}`;
      const generatedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(text)
        .digest('hex');

      const isValid = generatedSignature === signature;
      console.log('[Razorpay] Signature verification:', isValid ? 'SUCCESS' : 'FAILED');
      return isValid;
    } catch (error: any) {
      console.error('[Razorpay] Signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(body)
        .digest('hex');

      const isValid = expectedSignature === signature;
      console.log('[Razorpay] Webhook verification:', isValid ? 'SUCCESS' : 'FAILED');
      return isValid;
    } catch (error: any) {
      console.error('[Razorpay] Webhook verification error:', error);
      return false;
    }
  }

  /**
   * Fetch payment details
   */
  async getPaymentDetails(paymentId: string): Promise<PaymentDetails> {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      console.log('[Razorpay] Fetched payment:', paymentId);
      return payment as PaymentDetails;
    } catch (error: any) {
      console.error('[Razorpay] Failed to fetch payment:', error);
      throw new Error(`Failed to fetch payment: ${error.message}`);
    }
  }

  /**
   * Fetch order details
   */
  async getOrderDetails(orderId: string): Promise<any> {
    try {
      const order = await this.razorpay.orders.fetch(orderId);
      console.log('[Razorpay] Fetched order:', orderId);
      return order;
    } catch (error: any) {
      console.error('[Razorpay] Failed to fetch order:', error);
      throw new Error(`Failed to fetch order: ${error.message}`);
    }
  }

  /**
   * Capture payment (for authorized payments)
   */
  async capturePayment(paymentId: string, amount: number, currency: string = 'INR'): Promise<any> {
    try {
      const payment = await this.razorpay.payments.capture(paymentId, amount, currency);
      console.log('[Razorpay] Payment captured:', paymentId);
      return payment;
    } catch (error: any) {
      console.error('[Razorpay] Failed to capture payment:', error);
      throw new Error(`Failed to capture payment: ${error.message}`);
    }
  }

  /**
   * Create a refund
   */
  async createRefund(
    paymentId: string,
    amount?: number,
    notes?: Record<string, string>
  ): Promise<RefundDetails> {
    try {
      const refundData: any = { notes };
      if (amount) {
        refundData.amount = amount;
      }

      const refund = await this.razorpay.payments.refund(paymentId, refundData);
      console.log('[Razorpay] Refund created:', refund.id);
      return refund as RefundDetails;
    } catch (error: any) {
      console.error('[Razorpay] Failed to create refund:', error);
      throw new Error(`Failed to create refund: ${error.message}`);
    }
  }

  /**
   * Get refund details
   */
  async getRefundDetails(refundId: string): Promise<RefundDetails> {
    try {
      const refund = await this.razorpay.refunds.fetch(refundId);
      console.log('[Razorpay] Fetched refund:', refundId);
      return refund as RefundDetails;
    } catch (error: any) {
      console.error('[Razorpay] Failed to fetch refund:', error);
      throw new Error(`Failed to fetch refund: ${error.message}`);
    }
  }

  /**
   * Track payment method preferences
   */
  async trackPaymentMethod(
    method: string,
    amount: number,
    success: boolean
  ): Promise<void> {
    try {
      const redisClient = this.redisService.getClient();
      const key = `${this.PAYMENT_PREFERENCES_KEY}:${method}`;

      // Increment count
      await redisClient.hincrby(key, 'count', 1);

      // Track successful payments
      if (success) {
        await redisClient.hincrby(key, 'success', 1);
      }

      // Update total amount
      await redisClient.hincrbyfloat(key, 'total_amount', amount);

      // Set expiry (30 days)
      await redisClient.expire(key, 30 * 24 * 60 * 60);

      console.log('[Razorpay] Tracked payment method:', method, success ? 'SUCCESS' : 'FAILED');
    } catch (error: any) {
      console.error('[Razorpay] Failed to track payment method:', error);
    }
  }

  /**
   * Get payment method preferences
   */
  async getPaymentMethodPreferences(): Promise<PaymentMethodPreference[]> {
    try {
      const redisClient = this.redisService.getClient();
      const pattern = `${this.PAYMENT_PREFERENCES_KEY}:*`;
      const keys = await redisClient.keys(pattern);

      const preferences: PaymentMethodPreference[] = [];

      for (const key of keys) {
        const method = key.split(':').pop() || '';
        const data = await redisClient.hgetall(key);

        const count = parseInt(data.count || '0');
        const success = parseInt(data.success || '0');
        const totalAmount = parseFloat(data.total_amount || '0');

        if (count > 0) {
          preferences.push({
            method,
            count,
            success_rate: count > 0 ? success / count : 0,
            avg_amount: count > 0 ? totalAmount / count : 0,
          });
        }
      }

      // Sort by popularity (count)
      preferences.sort((a, b) => b.count - a.count);

      return preferences;
    } catch (error: any) {
      console.error('[Razorpay] Failed to get payment preferences:', error);
      return [];
    }
  }

  /**
   * Get popular payment methods for display
   */
  async getPopularPaymentMethods(limit: number = 5): Promise<string[]> {
    const preferences = await this.getPaymentMethodPreferences();
    return preferences.slice(0, limit).map((p) => p.method);
  }

  /**
   * Track failed payment for retry
   */
  async trackFailedPayment(orderId: string, paymentId: string, error: string): Promise<void> {
    try {
      const redisClient = this.redisService.getClient();
      const key = `${this.PAYMENT_RETRY_KEY}:${orderId}`;

      const retryData = {
        order_id: orderId,
        payment_id: paymentId,
        error,
        attempts: 1,
        last_attempt: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      // Check if already exists
      const existing = await redisClient.get(key);
      if (existing) {
        const data = JSON.parse(existing);
        retryData.attempts = (data.attempts || 0) + 1;
        retryData.created_at = data.created_at;
      }

      await redisClient.setex(key, 7 * 24 * 60 * 60, JSON.stringify(retryData)); // 7 days TTL
      console.log('[Razorpay] Tracked failed payment:', orderId, `Attempt ${retryData.attempts}`);
    } catch (error: any) {
      console.error('[Razorpay] Failed to track failed payment:', error);
    }
  }

  /**
   * Check if payment can be retried
   */
  async canRetryPayment(orderId: string): Promise<boolean> {
    try {
      const redisClient = this.redisService.getClient();
      const key = `${this.PAYMENT_RETRY_KEY}:${orderId}`;
      const data = await redisClient.get(key);

      if (!data) {
        return true; // No previous failures
      }

      const retryData = JSON.parse(data);
      return retryData.attempts < this.MAX_RETRY_ATTEMPTS;
    } catch (error: any) {
      console.error('[Razorpay] Failed to check retry status:', error);
      return false;
    }
  }

  /**
   * Get retry attempts for an order
   */
  async getRetryAttempts(orderId: string): Promise<number> {
    try {
      const redisClient = this.redisService.getClient();
      const key = `${this.PAYMENT_RETRY_KEY}:${orderId}`;
      const data = await redisClient.get(key);

      if (!data) {
        return 0;
      }

      const retryData = JSON.parse(data);
      return retryData.attempts || 0;
    } catch (error: any) {
      console.error('[Razorpay] Failed to get retry attempts:', error);
      return 0;
    }
  }

  /**
   * Clear retry data after successful payment
   */
  async clearRetryData(orderId: string): Promise<void> {
    try {
      const redisClient = this.redisService.getClient();
      const key = `${this.PAYMENT_RETRY_KEY}:${orderId}`;
      await redisClient.del(key);
      console.log('[Razorpay] Cleared retry data:', orderId);
    } catch (error: any) {
      console.error('[Razorpay] Failed to clear retry data:', error);
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(): Promise<any> {
    try {
      const preferences = await this.getPaymentMethodPreferences();

      const totalPayments = preferences.reduce((sum, p) => sum + p.count, 0);
      const totalSuccessful = preferences.reduce(
        (sum, p) => sum + Math.round(p.count * p.success_rate),
        0
      );
      const totalAmount = preferences.reduce((sum, p) => sum + p.avg_amount * p.count, 0);

      return {
        total_payments: totalPayments,
        successful_payments: totalSuccessful,
        failed_payments: totalPayments - totalSuccessful,
        success_rate: totalPayments > 0 ? totalSuccessful / totalPayments : 0,
        total_amount: totalAmount,
        avg_transaction_value: totalPayments > 0 ? totalAmount / totalPayments : 0,
        payment_methods: preferences,
      };
    } catch (error: any) {
      console.error('[Razorpay] Failed to get statistics:', error);
      return null;
    }
  }
}

// Singleton instance
let razorpayService: RazorpayService | null = null;

export function getRazorpayService(redisService: RedisService): RazorpayService {
  if (!razorpayService) {
    const config: RazorpayConfig = {
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || '',
      webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    };

    if (!config.key_id || !config.key_secret) {
      throw new Error('Razorpay credentials not configured');
    }

    razorpayService = new RazorpayService(config, redisService);
  }

  return razorpayService;
}
