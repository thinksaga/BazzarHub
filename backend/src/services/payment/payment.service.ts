import { RazorpayClient } from '../../config/razorpay';
import RedisService from '../redis';
import { v4 as uuidv4 } from 'uuid';

interface OrderDetails {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  razorpay_order_id: string;
  status: string;
  notes?: any;
  created_at: Date;
}

interface PaymentDetails {
  id: string;
  order_id: string;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  email?: string;
  contact?: string;
  captured_at?: Date;
  created_at: Date;
}

interface RefundDetails {
  id: string;
  payment_id: string;
  razorpay_refund_id: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  processed_at?: Date;
  created_at: Date;
}

export class PaymentService {
  private razorpayClient: RazorpayClient;
  private redisService: RedisService;
  private static instance: PaymentService;

  private constructor() {
    this.razorpayClient = RazorpayClient.getInstance();
    this.redisService = new RedisService();
  }

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Create Razorpay order
   * Step 1 of payment flow
   */
  async createOrder(
    amount: number, // Amount in paise (smallest currency unit)
    currency: string = 'INR',
    notes?: any
  ): Promise<OrderDetails> {
    try {
      const razorpay = this.razorpayClient.getRazorpay();
      
      // Generate unique receipt ID
      const receipt = `receipt_${Date.now()}_${uuidv4().substring(0, 8)}`;

      // Create order with Razorpay
      const razorpayOrder: any = await this.razorpayClient.withRetry(
        () => razorpay.orders.create({
          amount,
          currency,
          receipt,
          notes: {
            ...notes,
            created_by: 'bazaarhub_marketplace',
          },
        })
      );

      // Create order record
      const order: OrderDetails = {
        id: uuidv4(),
        amount,
        currency,
        receipt,
        razorpay_order_id: razorpayOrder.id,
        status: 'created',
        notes,
        created_at: new Date(),
      };

      // Store order in Redis
      await this.saveOrder(order);

      // Log transaction
      await this.logTransaction('order_created', {
        order_id: order.id,
        razorpay_order_id: razorpayOrder.id,
        amount,
        currency,
      });

      console.log('[Payment Service] Order created:', order.id);

      return order;
    } catch (error: any) {
      console.error('[Payment Service] Error creating order:', error);
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  /**
   * Capture payment after successful authorization
   * Step 2 of payment flow
   */
  async capturePayment(
    razorpayPaymentId: string,
    amount: number,
    currency: string = 'INR'
  ): Promise<PaymentDetails> {
    try {
      const razorpay = this.razorpayClient.getRazorpay();

      // Capture payment with Razorpay
      const capturedPayment: any = await this.razorpayClient.withRetry(
        () => razorpay.payments.capture(razorpayPaymentId, amount, currency)
      );

      // Get order by razorpay_order_id
      const order = await this.getOrderByRazorpayOrderId(capturedPayment.order_id);

      if (!order) {
        throw new Error('Order not found');
      }

      // Create payment record
      const payment: PaymentDetails = {
        id: uuidv4(),
        order_id: order.id,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: capturedPayment.order_id,
        amount: capturedPayment.amount,
        currency: capturedPayment.currency,
        status: 'captured',
        method: capturedPayment.method,
        email: capturedPayment.email,
        contact: capturedPayment.contact,
        captured_at: new Date(capturedPayment.created_at * 1000),
        created_at: new Date(),
      };

      // Save payment record
      await this.savePayment(payment);

      // Update order status
      order.status = 'paid';
      await this.saveOrder(order);

      // Log transaction
      await this.logTransaction('payment_captured', {
        payment_id: payment.id,
        order_id: order.id,
        razorpay_payment_id: razorpayPaymentId,
        amount,
      });

      console.log('[Payment Service] Payment captured:', payment.id);

      return payment;
    } catch (error: any) {
      console.error('[Payment Service] Error capturing payment:', error);
      throw new Error(`Failed to capture payment: ${error.message}`);
    }
  }

  /**
   * Verify payment signature
   * Prevents unauthorized payment confirmations
   */
  async verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): Promise<{ verified: boolean; payment?: PaymentDetails; error?: string }> {
    try {
      // Get order
      const order = await this.getOrderByRazorpayOrderId(orderId);

      if (!order) {
        return {
          verified: false,
          error: 'Order not found',
        };
      }

      // Validate signature
      const isValid = this.razorpayClient.validatePaymentSignature(
        orderId,
        paymentId,
        signature
      );

      if (!isValid) {
        await this.logTransaction('signature_verification_failed', {
          order_id: order.id,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
        });

        return {
          verified: false,
          error: 'Invalid signature',
        };
      }

      // Check for duplicate processing
      const existingPayment = await this.getPaymentByRazorpayPaymentId(paymentId);
      if (existingPayment) {
        console.log('[Payment Service] Payment already processed:', paymentId);
        return {
          verified: true,
          payment: existingPayment,
        };
      }

      // Fetch payment details from Razorpay
      const razorpay = this.razorpayClient.getRazorpay();
      const razorpayPayment: any = await razorpay.payments.fetch(paymentId);

      // Create payment record
      const payment: PaymentDetails = {
        id: uuidv4(),
        order_id: order.id,
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
        amount: razorpayPayment.amount,
        currency: razorpayPayment.currency,
        status: razorpayPayment.status,
        method: razorpayPayment.method,
        email: razorpayPayment.email,
        contact: razorpayPayment.contact,
        captured_at: razorpayPayment.captured ? new Date(razorpayPayment.created_at * 1000) : undefined,
        created_at: new Date(),
      };

      // Save payment
      await this.savePayment(payment);

      // Update order status
      if (razorpayPayment.status === 'captured') {
        order.status = 'paid';
        await this.saveOrder(order);
      }

      // Log transaction
      await this.logTransaction('signature_verified', {
        payment_id: payment.id,
        order_id: order.id,
        razorpay_payment_id: paymentId,
      });

      console.log('[Payment Service] Signature verified:', payment.id);

      return {
        verified: true,
        payment,
      };
    } catch (error: any) {
      console.error('[Payment Service] Error verifying signature:', error);
      return {
        verified: false,
        error: error.message,
      };
    }
  }

  /**
   * Process refund
   * Can be full or partial refund
   */
  async refundPayment(
    paymentId: string,
    amount?: number, // If not provided, full refund
    reason?: string
  ): Promise<RefundDetails> {
    try {
      const razorpay = this.razorpayClient.getRazorpay();

      // Get payment details
      const payment = await this.getPaymentByRazorpayPaymentId(paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'captured') {
        throw new Error('Only captured payments can be refunded');
      }

      // Default to full refund if amount not specified
      const refundAmount = amount || payment.amount;

      if (refundAmount > payment.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }

      // Create refund with Razorpay
      const razorpayRefund: any = await this.razorpayClient.withRetry(
        () => razorpay.payments.refund(paymentId, {
          amount: refundAmount,
          notes: {
            reason: reason || 'Customer requested refund',
            refunded_by: 'bazaarhub_marketplace',
          },
        })
      );

      // Create refund record
      const refund: RefundDetails = {
        id: uuidv4(),
        payment_id: payment.id,
        razorpay_refund_id: razorpayRefund.id,
        amount: refundAmount,
        currency: payment.currency,
        reason: reason || 'Customer requested refund',
        status: razorpayRefund.status,
        processed_at: razorpayRefund.status === 'processed' ? new Date() : undefined,
        created_at: new Date(),
      };

      // Save refund
      await this.saveRefund(refund);

      // Update payment status
      if (refundAmount === payment.amount) {
        payment.status = 'refunded';
      } else {
        payment.status = 'partial_refund';
      }
      await this.savePayment(payment);

      // Update order status
      const order = await this.getOrder(payment.order_id);
      if (order) {
        order.status = refundAmount === payment.amount ? 'refunded' : 'partial_refund';
        await this.saveOrder(order);
      }

      // Log transaction
      await this.logTransaction('refund_created', {
        refund_id: refund.id,
        payment_id: payment.id,
        order_id: payment.order_id,
        amount: refundAmount,
        reason,
      });

      console.log('[Payment Service] Refund created:', refund.id);

      return refund;
    } catch (error: any) {
      console.error('[Payment Service] Error creating refund:', error);
      throw new Error(`Failed to create refund: ${error.message}`);
    }
  }

  /**
   * Get order by Razorpay order ID
   */
  async getOrderByRazorpayOrderId(razorpayOrderId: string): Promise<OrderDetails | null> {
    try {
      const redis = this.redisService.getClient();
      const key = `order:razorpay:${razorpayOrderId}`;
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as OrderDetails;
    } catch (error) {
      console.error('[Payment Service] Error fetching order:', error);
      return null;
    }
  }

  /**
   * Get order by internal ID
   */
  async getOrder(orderId: string): Promise<OrderDetails | null> {
    try {
      const redis = this.redisService.getClient();
      const key = `order:${orderId}`;
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as OrderDetails;
    } catch (error) {
      console.error('[Payment Service] Error fetching order:', error);
      return null;
    }
  }

  /**
   * Get payment by Razorpay payment ID
   */
  async getPaymentByRazorpayPaymentId(razorpayPaymentId: string): Promise<PaymentDetails | null> {
    try {
      const redis = this.redisService.getClient();
      const key = `payment:razorpay:${razorpayPaymentId}`;
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as PaymentDetails;
    } catch (error) {
      console.error('[Payment Service] Error fetching payment:', error);
      return null;
    }
  }

  /**
   * Get payment by internal ID
   */
  async getPayment(paymentId: string): Promise<PaymentDetails | null> {
    try {
      const redis = this.redisService.getClient();
      const key = `payment:${paymentId}`;
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as PaymentDetails;
    } catch (error) {
      console.error('[Payment Service] Error fetching payment:', error);
      return null;
    }
  }

  /**
   * Get payments for an order
   */
  async getOrderPayments(orderId: string): Promise<PaymentDetails[]> {
    try {
      const redis = this.redisService.getClient();
      const pattern = `payment:order:${orderId}:*`;
      const keys = await redis.keys(pattern);

      const payments = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          payments.push(JSON.parse(data));
        }
      }

      return payments.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('[Payment Service] Error fetching order payments:', error);
      return [];
    }
  }

  /**
   * Get refunds for a payment
   */
  async getPaymentRefunds(paymentId: string): Promise<RefundDetails[]> {
    try {
      const redis = this.redisService.getClient();
      const pattern = `refund:payment:${paymentId}:*`;
      const keys = await redis.keys(pattern);

      const refunds = [];
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          refunds.push(JSON.parse(data));
        }
      }

      return refunds.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('[Payment Service] Error fetching refunds:', error);
      return [];
    }
  }

  // Private helper methods

  private async saveOrder(order: OrderDetails): Promise<void> {
    const redis = this.redisService.getClient();
    
    // Save by internal ID
    await redis.set(`order:${order.id}`, JSON.stringify(order));
    
    // Index by Razorpay order ID
    await redis.set(`order:razorpay:${order.razorpay_order_id}`, JSON.stringify(order));
  }

  private async savePayment(payment: PaymentDetails): Promise<void> {
    const redis = this.redisService.getClient();
    
    // Save by internal ID
    await redis.set(`payment:${payment.id}`, JSON.stringify(payment));
    
    // Index by Razorpay payment ID
    await redis.set(`payment:razorpay:${payment.razorpay_payment_id}`, JSON.stringify(payment));
    
    // Index by order ID
    await redis.set(`payment:order:${payment.order_id}:${payment.id}`, JSON.stringify(payment));
  }

  private async saveRefund(refund: RefundDetails): Promise<void> {
    const redis = this.redisService.getClient();
    
    // Save by internal ID
    await redis.set(`refund:${refund.id}`, JSON.stringify(refund));
    
    // Index by Razorpay refund ID
    await redis.set(`refund:razorpay:${refund.razorpay_refund_id}`, JSON.stringify(refund));
    
    // Index by payment ID
    await redis.set(`refund:payment:${refund.payment_id}:${refund.id}`, JSON.stringify(refund));
  }

  private async logTransaction(event: string, data: any): Promise<void> {
    const redis = this.redisService.getClient();
    const log = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    
    const logKey = `transaction:log:${Date.now()}:${uuidv4()}`;
    await redis.set(logKey, JSON.stringify(log), 'EX', 86400 * 30); // Keep for 30 days
  }
}

export default PaymentService;
