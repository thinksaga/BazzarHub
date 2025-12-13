import Razorpay from 'razorpay';
import crypto from 'crypto';

interface RazorpayConfig {
  key_id: string;
  key_secret: string;
}

interface WebhookValidation {
  isValid: boolean;
  timestamp?: number;
  error?: string;
}

export class RazorpayClient {
  private static instance: RazorpayClient;
  private razorpay: Razorpay;
  private keySecret: string;
  private webhookSecret: string;

  private constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret || '';

    // Initialize Razorpay with timeout and retry settings
    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    console.log('[Razorpay Config] Initialized successfully');
  }

  static getInstance(): RazorpayClient {
    if (!RazorpayClient.instance) {
      RazorpayClient.instance = new RazorpayClient();
    }
    return RazorpayClient.instance;
  }

  getRazorpay(): Razorpay {
    return this.razorpay;
  }

  /**
   * Validate webhook signature
   * Prevents tampering and ensures webhook is from Razorpay
   */
  validateWebhookSignature(
    body: string,
    signature: string,
    secret?: string
  ): WebhookValidation {
    try {
      const webhookSecret = secret || this.webhookSecret;

      if (!webhookSecret) {
        return {
          isValid: false,
          error: 'Webhook secret not configured',
        };
      }

      // Generate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      // Compare signatures (constant-time comparison to prevent timing attacks)
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        return {
          isValid: false,
          error: 'Invalid signature',
        };
      }

      // Parse body to get timestamp for replay attack prevention
      const payload = JSON.parse(body);
      const timestamp = payload.created_at;

      // Check if event is not older than 5 minutes (300 seconds)
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timeDifference = currentTimestamp - timestamp;

      if (timeDifference > 300) {
        return {
          isValid: false,
          timestamp,
          error: 'Webhook event too old (possible replay attack)',
        };
      }

      return {
        isValid: true,
        timestamp,
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Validate payment signature from frontend
   * Used after successful payment to verify authenticity
   */
  validatePaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    try {
      const body = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(body)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('[Razorpay] Payment signature validation error:', error);
      return false;
    }
  }

  /**
   * Generate signature for refund verification
   */
  generateRefundSignature(
    refundId: string,
    paymentId: string
  ): string {
    const body = `${paymentId}|${refundId}`;
    return crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');
  }

  /**
   * Retry configuration for API calls
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on client errors (4xx)
        if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = delayMs * Math.pow(2, attempt - 1);
          console.log(`[Razorpay] Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Health check - verifies Razorpay credentials
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to fetch orders to verify credentials
      await this.razorpay.orders.all({ count: 1 });
      return true;
    } catch (error) {
      console.error('[Razorpay] Health check failed:', error);
      return false;
    }
  }
}

export default RazorpayClient;
