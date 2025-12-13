import express, { Request, Response } from 'express';
import { RazorpayClient } from '../../config/razorpay';
import { PaymentService } from '../../services/payment/payment.service';
import { RouteService } from '../../services/payment/route.service';
import CODService from '../../services/payment/cod.service';
import RedisService from '../../services/redis';

const router = express.Router();
const redisService = new RedisService();

interface WebhookEvent {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: any;
    };
    transfer?: {
      entity: any;
    };
    refund?: {
      entity: any;
    };
    order?: {
      entity: any;
    };
  };
  created_at: number;
}

/**
 * Main webhook endpoint for Razorpay events
 * Handles: payment.captured, payment.failed, transfer.processed, transfer.failed, refund.processed
 * Implements idempotent processing with event deduplication
 */
router.post('/razorpay', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Get raw body for signature verification
    const rawBody = req.body.toString('utf8');

    // Verify webhook signature
    const razorpayClient = RazorpayClient.getInstance();
    const isValid = razorpayClient.validateWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.error('[Webhook] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse event
    const event: WebhookEvent = JSON.parse(rawBody);

    console.log('[Webhook] Received event:', event.event, 'Entity:', event.entity);

    // Check for duplicate event (idempotency)
    const isDuplicate = await checkDuplicateEvent(event);
    if (isDuplicate) {
      console.log('[Webhook] Duplicate event, skipping:', event.event);
      return res.status(200).json({ status: 'duplicate', message: 'Event already processed' });
    }

    // Mark event as received
    await markEventReceived(event);

    // Process based on event type
    let result;
    switch (event.event) {
      case 'payment.captured':
        result = await handlePaymentCaptured(event);
        break;
      
      case 'payment.failed':
        result = await handlePaymentFailed(event);
        break;
      
      case 'transfer.processed':
        result = await handleTransferProcessed(event);
        break;
      
      case 'transfer.failed':
        result = await handleTransferFailed(event);
        break;
      
      case 'refund.processed':
        result = await handleRefundProcessed(event);
        break;
      
      case 'order.paid':
        result = await handleOrderPaid(event);
        break;
      
      default:
        console.log('[Webhook] Unhandled event type:', event.event);
        result = { status: 'ignored', message: 'Event type not handled' };
    }

    // Mark event as processed
    await markEventProcessed(event, result);

    return res.status(200).json({
      status: 'success',
      event: event.event,
      result,
    });

  } catch (error: any) {
    console.error('[Webhook] Error processing webhook:', error);
    
    // Don't return 500 to avoid retry storms
    // Razorpay will retry automatically
    return res.status(200).json({
      status: 'error',
      message: error.message,
    });
  }
});

/**
 * Handle payment.captured event
 * Triggered when a payment is successfully captured
 */
async function handlePaymentCaptured(event: WebhookEvent): Promise<any> {
  try {
    const payment = event.payload.payment?.entity;
    if (!payment) {
      throw new Error('Payment entity not found in event payload');
    }

    console.log('[Webhook] Processing payment.captured:', payment.id);

    const paymentService = PaymentService.getInstance();

    // Capture payment in our system
    await paymentService.capturePayment(
      payment.id,
      payment.amount,
      payment.currency
    );

    // If payment has order_id, check for automatic transfer
    if (payment.order_id) {
      const order = await paymentService.getOrderByRazorpayOrderId(payment.order_id);
      
      if (order && order.notes?.vendor_id) {
        // Create automatic transfer to vendor
        const routeService = RouteService.getInstance();
        
        const commission = parseFloat(order.notes.commission_rate || '10');
        const vendorId = order.notes.vendor_id;
        
        // Check if transfer should be on-hold (pending delivery)
        const onHold = order.notes.hold_until_delivery === 'true';
        const onHoldUntil = onHold ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined; // 7 days

        const transfer = await routeService.createTransfer(
          payment.id,
          order.id,
          vendorId,
          order.amount,
          commission,
          onHold,
          onHoldUntil
        );

        console.log('[Webhook] Automatic transfer created:', transfer.id);

        return {
          payment_id: payment.id,
          order_id: order.id,
          transfer_id: transfer.id,
          status: 'transfer_initiated',
        };
      }
    }

    return {
      payment_id: payment.id,
      status: 'captured',
    };

  } catch (error: any) {
    console.error('[Webhook] Error handling payment.captured:', error);
    throw error;
  }
}

/**
 * Handle payment.failed event
 * Triggered when a payment fails
 */
async function handlePaymentFailed(event: WebhookEvent): Promise<any> {
  try {
    const payment = event.payload.payment?.entity;
    if (!payment) {
      throw new Error('Payment entity not found in event payload');
    }

    console.log('[Webhook] Processing payment.failed:', payment.id);

    const paymentService = PaymentService.getInstance();

    // Update payment status
    const redis = redisService.getClient();
    const paymentKey = `payment:razorpay:${payment.id}`;
    const paymentData = await redis.get(paymentKey);

    if (paymentData) {
      const paymentRecord = JSON.parse(paymentData);
      paymentRecord.status = 'failed';
      paymentRecord.error_code = payment.error_code;
      paymentRecord.error_description = payment.error_description;
      paymentRecord.updated_at = new Date();

      await redis.set(paymentKey, JSON.stringify(paymentRecord));
      await redis.set(`payment:${paymentRecord.id}`, JSON.stringify(paymentRecord));

      // Update order status
      if (paymentRecord.order_id) {
        const orderKey = `order:${paymentRecord.order_id}`;
        const orderData = await redis.get(orderKey);
        
        if (orderData) {
          const order = JSON.parse(orderData);
          order.status = 'failed';
          order.updated_at = new Date();
          await redis.set(orderKey, JSON.stringify(order));
        }
      }
    }

    return {
      payment_id: payment.id,
      status: 'failed',
      error_code: payment.error_code,
    };

  } catch (error: any) {
    console.error('[Webhook] Error handling payment.failed:', error);
    throw error;
  }
}

/**
 * Handle transfer.processed event
 * Triggered when a transfer to vendor account is successful
 */
async function handleTransferProcessed(event: WebhookEvent): Promise<any> {
  try {
    const transfer = event.payload.transfer?.entity;
    if (!transfer) {
      throw new Error('Transfer entity not found in event payload');
    }

    console.log('[Webhook] Processing transfer.processed:', transfer.id);

    const routeService = RouteService.getInstance();

    // Update transfer status in our system
    await routeService.getTransferStatus(transfer.id);

    // Update COD payout if applicable
    const redis = redisService.getClient();
    const transferKey = `transfer:razorpay:${transfer.id}`;
    const transferData = await redis.get(transferKey);

    if (transferData) {
      const transferRecord = JSON.parse(transferData);
      
      // If this is a COD remittance transfer, update payout status
      if (transferRecord.metadata?.payout_type === 'cod_remittance') {
        const payoutKey = `payout:cod:${transferRecord.metadata.payout_id}`;
        const payoutData = await redis.get(payoutKey);
        
        if (payoutData) {
          const payout = JSON.parse(payoutData);
          payout.status = 'completed';
          payout.transfer_id = transfer.id;
          payout.completed_at = new Date();
          await redis.set(payoutKey, JSON.stringify(payout));
        }
      }
    }

    return {
      transfer_id: transfer.id,
      status: 'processed',
      amount: transfer.amount,
    };

  } catch (error: any) {
    console.error('[Webhook] Error handling transfer.processed:', error);
    throw error;
  }
}

/**
 * Handle transfer.failed event
 * Triggered when a transfer to vendor account fails
 */
async function handleTransferFailed(event: WebhookEvent): Promise<any> {
  try {
    const transfer = event.payload.transfer?.entity;
    if (!transfer) {
      throw new Error('Transfer entity not found in event payload');
    }

    console.log('[Webhook] Processing transfer.failed:', transfer.id);

    const redis = redisService.getClient();
    const transferKey = `transfer:razorpay:${transfer.id}`;
    const transferData = await redis.get(transferKey);

    if (transferData) {
      const transferRecord = JSON.parse(transferData);
      transferRecord.status = 'failed';
      transferRecord.failure_reason = transfer.failure_reason;
      transferRecord.updated_at = new Date();

      await redis.set(transferKey, JSON.stringify(transferRecord));
      await redis.set(`transfer:${transferRecord.id}`, JSON.stringify(transferRecord));

      // Log failure for admin review
      await logTransferFailure(transferRecord, transfer.failure_reason);
    }

    return {
      transfer_id: transfer.id,
      status: 'failed',
      failure_reason: transfer.failure_reason,
    };

  } catch (error: any) {
    console.error('[Webhook] Error handling transfer.failed:', error);
    throw error;
  }
}

/**
 * Handle refund.processed event
 * Triggered when a refund is successfully processed
 */
async function handleRefundProcessed(event: WebhookEvent): Promise<any> {
  try {
    const refund = event.payload.refund?.entity;
    if (!refund) {
      throw new Error('Refund entity not found in event payload');
    }

    console.log('[Webhook] Processing refund.processed:', refund.id);

    const redis = redisService.getClient();
    const refundKey = `refund:razorpay:${refund.id}`;
    const refundData = await redis.get(refundKey);

    if (refundData) {
      const refundRecord = JSON.parse(refundData);
      refundRecord.status = 'processed';
      refundRecord.updated_at = new Date();

      await redis.set(refundKey, JSON.stringify(refundRecord));
      await redis.set(`refund:${refundRecord.id}`, JSON.stringify(refundRecord));

      // If transfer was made, initiate reversal
      if (refundRecord.payment_id) {
        const paymentKey = `payment:razorpay:${refundRecord.payment_id}`;
        const paymentData = await redis.get(paymentKey);

        if (paymentData) {
          const payment = JSON.parse(paymentData);
          
          // Check if there's a transfer for this payment
          const transferKeys = await redis.keys(`transfer:order:${payment.order_id}:*`);
          
          for (const transferKey of transferKeys) {
            const transferData = await redis.get(transferKey);
            if (transferData) {
              const transfer = JSON.parse(transferData);
              
              // Reverse the transfer
              const routeService = RouteService.getInstance();
              await routeService.reverseTransfer(
                transfer.razorpay_transfer_id,
                `Refund processed: ${refund.id}`
              );
            }
          }
        }
      }
    }

    return {
      refund_id: refund.id,
      status: 'processed',
      amount: refund.amount,
    };

  } catch (error: any) {
    console.error('[Webhook] Error handling refund.processed:', error);
    throw error;
  }
}

/**
 * Handle order.paid event
 * Triggered when an order is fully paid
 */
async function handleOrderPaid(event: WebhookEvent): Promise<any> {
  try {
    const order = event.payload.order?.entity;
    if (!order) {
      throw new Error('Order entity not found in event payload');
    }

    console.log('[Webhook] Processing order.paid:', order.id);

    const redis = redisService.getClient();
    const orderKey = `order:razorpay:${order.id}`;
    const orderData = await redis.get(orderKey);

    if (orderData) {
      const orderRecord = JSON.parse(orderData);
      orderRecord.status = 'paid';
      orderRecord.paid_at = new Date();
      orderRecord.updated_at = new Date();

      await redis.set(orderKey, JSON.stringify(orderRecord));
      await redis.set(`order:${orderRecord.id}`, JSON.stringify(orderRecord));
    }

    return {
      order_id: order.id,
      status: 'paid',
      amount: order.amount,
    };

  } catch (error: any) {
    console.error('[Webhook] Error handling order.paid:', error);
    throw error;
  }
}

/**
 * Check if event has already been processed (idempotency)
 */
async function checkDuplicateEvent(event: WebhookEvent): Promise<boolean> {
  const redis = redisService.getClient();
  const eventKey = `webhook:event:${event.event}:${event.payload.payment?.entity?.id || event.payload.transfer?.entity?.id || event.payload.refund?.entity?.id || event.created_at}`;
  
  const exists = await redis.exists(eventKey);
  return exists === 1;
}

/**
 * Mark event as received
 */
async function markEventReceived(event: WebhookEvent): Promise<void> {
  const redis = redisService.getClient();
  const eventKey = `webhook:event:${event.event}:${event.payload.payment?.entity?.id || event.payload.transfer?.entity?.id || event.payload.refund?.entity?.id || event.created_at}`;
  
  await redis.set(eventKey, JSON.stringify({
    event: event.event,
    entity: event.entity,
    received_at: new Date(),
    status: 'received',
  }), 'EX', 86400 * 7); // Keep for 7 days
}

/**
 * Mark event as processed with result
 */
async function markEventProcessed(event: WebhookEvent, result: any): Promise<void> {
  const redis = redisService.getClient();
  const eventKey = `webhook:event:${event.event}:${event.payload.payment?.entity?.id || event.payload.transfer?.entity?.id || event.payload.refund?.entity?.id || event.created_at}`;
  
  await redis.set(eventKey, JSON.stringify({
    event: event.event,
    entity: event.entity,
    received_at: new Date(),
    processed_at: new Date(),
    status: 'processed',
    result,
  }), 'EX', 86400 * 7); // Keep for 7 days
}

/**
 * Log transfer failure for admin review
 */
async function logTransferFailure(transfer: any, reason: string): Promise<void> {
  const redis = redisService.getClient();
  const logKey = `transfer:failure:${transfer.id}`;
  
  await redis.set(logKey, JSON.stringify({
    transfer_id: transfer.id,
    vendor_id: transfer.vendor_id,
    order_id: transfer.order_id,
    amount: transfer.amount,
    failure_reason: reason,
    timestamp: new Date(),
  }), 'EX', 86400 * 30); // Keep for 30 days
}

export default router;
