import { Request, Response } from 'express';
import { RazorpayService } from './razorpay.service';
import RazorpayRouteService from './razorpay-route.service';

export interface WebhookEvent {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: any;
    };
    order?: {
      entity: any;
    };
    refund?: {
      entity: any;
    };
    transfer?: {
      entity: any;
    };
  };
  created_at: number;
}

export class RazorpayWebhookHandler {
  private razorpayService: RazorpayService;
  private routeService: RazorpayRouteService;

  constructor(razorpayService: RazorpayService) {
    this.razorpayService = razorpayService;
    this.routeService = RazorpayRouteService.getInstance();
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const body = JSON.stringify(req.body);

      // Verify webhook signature
      const isValid = this.razorpayService.verifyWebhookSignature(body, signature);

      if (!isValid) {
        console.error('[Razorpay Webhook] Invalid signature');
        res.status(400).json({ error: 'Invalid signature' });
        return;
      }

      const event: WebhookEvent = req.body;
      console.log('[Razorpay Webhook] Received event:', event.event);

      // Route to appropriate handler
      switch (event.event) {
        case 'payment.authorized':
          await this.handlePaymentAuthorized(event);
          break;

        case 'payment.captured':
        case 'payment.success':
          await this.handlePaymentSuccess(event);
          break;

        case 'payment.failed':
          await this.handlePaymentFailed(event);
          break;

        case 'refund.created':
          await this.handleRefundCreated(event);
          break;

        case 'refund.processed':
          await this.handleRefundProcessed(event);
          break;

        case 'refund.failed':
          await this.handleRefundFailed(event);
          break;

        case 'order.paid':
          await this.handleOrderPaid(event);
          break;

        case 'transfer.processed':
        case 'transfer.failed':
        case 'transfer.reversed':
          await this.handleTransferEvent(event);
          break;

        default:
          console.log('[Razorpay Webhook] Unhandled event type:', event.event);
      }

      res.status(200).json({ status: 'success' });
    } catch (error: any) {
      console.error('[Razorpay Webhook] Error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle payment authorized event
   */
  private async handlePaymentAuthorized(event: WebhookEvent): Promise<void> {
    try {
      const payment = event.payload.payment?.entity;
      if (!payment) return;

      console.log('[Razorpay Webhook] Payment authorized:', payment.id);

      // Auto-capture the payment if needed
      // await this.razorpayService.capturePayment(payment.id, payment.amount);

      // Update order status in database
      // await this.updateOrderStatus(payment.order_id, 'payment_authorized');

      // Track payment method
      await this.razorpayService.trackPaymentMethod(
        payment.method || 'unknown',
        payment.amount,
        true
      );
    } catch (error: any) {
      console.error('[Razorpay Webhook] Payment authorized error:', error);
    }
  }

  /**
   * Handle payment success event
   */
  private async handlePaymentSuccess(event: WebhookEvent): Promise<void> {
    try {
      const payment = event.payload.payment?.entity;
      if (!payment) return;

      console.log('[Razorpay Webhook] Payment success:', payment.id);

      // Clear retry data
      await this.razorpayService.clearRetryData(payment.order_id);

      // Update order status in database
      // await this.updateOrderStatus(payment.order_id, 'paid');

      // Track payment method
      await this.razorpayService.trackPaymentMethod(
        payment.method || 'unknown',
        payment.amount,
        true
      );

      // Send confirmation email
      // await this.sendPaymentConfirmation(payment);

      // Trigger order fulfillment
      // await this.triggerOrderFulfillment(payment.order_id);

      // Create vendor payout automatically
      await this.createVendorPayout(payment);
    } catch (error: any) {
      console.error('[Razorpay Webhook] Payment success error:', error);
    }
  }

  /**
   * Create vendor payout on successful payment
   */
  private async createVendorPayout(payment: any): Promise<void> {
    try {
      // Extract vendor_id from payment notes
      const vendorId = payment.notes?.vendor_id;
      
      if (!vendorId) {
        console.log('[Razorpay Webhook] No vendor_id in payment notes, skipping payout creation');
        return;
      }

      console.log('[Razorpay Webhook] Creating payout for vendor:', vendorId);

      // Create payout with automatic commission split
      const payout = await this.routeService.createPayout(
        vendorId,
        payment.order_id,
        payment.id,
        payment.amount, // Amount in paise
        {
          customer_id: payment.email,
          payment_method: payment.method,
          payment_captured_at: payment.captured_at,
        }
      );

      console.log('[Razorpay Webhook] Payout created:', payout.id);
    } catch (error: any) {
      console.error('[Razorpay Webhook] Payout creation error:', error);
      // Don't throw - payment was successful even if payout fails
      // Payout will be retried automatically
    }
  }

  /**
   * Handle transfer event (Route API)
   */
  private async handleTransferEvent(event: WebhookEvent): Promise<void> {
    try {
      console.log('[Razorpay Webhook] Transfer event:', event.event);

      await this.routeService.handleTransferWebhook(event);
    } catch (error: any) {
      console.error('[Razorpay Webhook] Transfer event error:', error);
    }
  }

  /**
   * Handle payment failed event
   */
  private async handlePaymentFailed(event: WebhookEvent): Promise<void> {
    try {
      const payment = event.payload.payment?.entity;
      if (!payment) return;

      console.log('[Razorpay Webhook] Payment failed:', payment.id);

      const errorDescription = payment.error_description || 'Payment failed';

      // Track failed payment
      await this.razorpayService.trackFailedPayment(
        payment.order_id,
        payment.id,
        errorDescription
      );

      // Track payment method failure
      await this.razorpayService.trackPaymentMethod(
        payment.method || 'unknown',
        payment.amount,
        false
      );

      // Check if payment can be retried
      const canRetry = await this.razorpayService.canRetryPayment(payment.order_id);
      const attempts = await this.razorpayService.getRetryAttempts(payment.order_id);

      console.log(
        `[Razorpay Webhook] Retry status for ${payment.order_id}: ${canRetry ? 'Allowed' : 'Max attempts reached'} (Attempt ${attempts}/3)`
      );

      // Update order status in database
      // await this.updateOrderStatus(payment.order_id, canRetry ? 'payment_failed_retry' : 'payment_failed');

      // Send notification to customer
      // if (canRetry) {
      //   await this.sendPaymentRetryNotification(payment);
      // } else {
      //   await this.sendPaymentFailedNotification(payment);
      // }

      // Log for admin review
      // await this.logFailedPayment(payment, attempts);
    } catch (error: any) {
      console.error('[Razorpay Webhook] Payment failed error:', error);
    }
  }

  /**
   * Handle refund created event
   */
  private async handleRefundCreated(event: WebhookEvent): Promise<void> {
    try {
      const refund = event.payload.refund?.entity;
      if (!refund) return;

      console.log('[Razorpay Webhook] Refund created:', refund.id);

      // Update order status in database
      // await this.updateOrderStatus(refund.payment_id, 'refund_initiated');

      // Send notification to customer
      // await this.sendRefundNotification(refund, 'initiated');
    } catch (error: any) {
      console.error('[Razorpay Webhook] Refund created error:', error);
    }
  }

  /**
   * Handle refund processed event
   */
  private async handleRefundProcessed(event: WebhookEvent): Promise<void> {
    try {
      const refund = event.payload.refund?.entity;
      if (!refund) return;

      console.log('[Razorpay Webhook] Refund processed:', refund.id);

      // Update order status in database
      // await this.updateOrderStatus(refund.payment_id, 'refunded');

      // Send notification to customer
      // await this.sendRefundNotification(refund, 'completed');
    } catch (error: any) {
      console.error('[Razorpay Webhook] Refund processed error:', error);
    }
  }

  /**
   * Handle refund failed event
   */
  private async handleRefundFailed(event: WebhookEvent): Promise<void> {
    try {
      const refund = event.payload.refund?.entity;
      if (!refund) return;

      console.log('[Razorpay Webhook] Refund failed:', refund.id);

      // Update order status in database
      // await this.updateOrderStatus(refund.payment_id, 'refund_failed');

      // Send notification to admin for manual intervention
      // await this.sendRefundFailedNotification(refund);
    } catch (error: any) {
      console.error('[Razorpay Webhook] Refund failed error:', error);
    }
  }

  /**
   * Handle order paid event
   */
  private async handleOrderPaid(event: WebhookEvent): Promise<void> {
    try {
      const order = event.payload.order?.entity;
      if (!order) return;

      console.log('[Razorpay Webhook] Order paid:', order.id);

      // Update order status in database
      // await this.updateOrderStatus(order.id, 'paid');

      // Trigger order processing
      // await this.processOrder(order.id);
    } catch (error: any) {
      console.error('[Razorpay Webhook] Order paid error:', error);
    }
  }

  /**
   * Helper method to update order status in database
   */
  private async updateOrderStatus(orderId: string, status: string): Promise<void> {
    // Implement your database update logic here
    console.log(`[Razorpay Webhook] Update order ${orderId} status to ${status}`);
  }
}
