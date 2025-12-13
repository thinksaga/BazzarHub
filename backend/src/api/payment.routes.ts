import { Router } from 'express';
import { getRazorpayService } from '../services/payment/razorpay.service';
import { RazorpayWebhookHandler } from '../services/payment/webhook-handler.service';
import RedisService from '../services/redis';

const router = Router();
const redisService = new RedisService();

/**
 * @route   POST /api/payment/create-order
 * @desc    Create Razorpay order for checkout
 * @access  Public (should be authenticated in production)
 */
router.post('/create-order', async (req, res) => {
  try {
    const razorpayService = getRazorpayService(redisService);
    const { amount, currency, receipt, notes, partial_payment } = req.body;

    if (!amount || !receipt) {
      return res.status(400).json({
        success: false,
        error: 'Amount and receipt are required',
      });
    }

    const order = await razorpayService.createOrder({
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency || 'INR',
      receipt,
      notes,
      partial_payment,
    });

    res.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error: any) {
    console.error('[Payment API] Create order error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create order',
    });
  }
});

/**
 * @route   POST /api/payment/verify
 * @desc    Verify payment signature after payment
 * @access  Public (should be authenticated in production)
 */
router.post('/verify', async (req, res) => {
  try {
    const razorpayService = getRazorpayService(redisService);
    const { order_id, payment_id, signature } = req.body;

    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Order ID, Payment ID, and Signature are required',
      });
    }

    const isValid = razorpayService.verifyPaymentSignature(order_id, payment_id, signature);

    if (isValid) {
      // Get payment details
      const payment = await razorpayService.getPaymentDetails(payment_id);

      // Track payment method
      await razorpayService.trackPaymentMethod(payment.method, payment.amount, true);

      // Clear retry data
      await razorpayService.clearRetryData(order_id);

      res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          payment_id: payment.id,
          order_id: payment.order_id,
          amount: payment.amount / 100, // Convert to rupees
          method: payment.method,
          status: payment.status,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid payment signature',
      });
    }
  } catch (error: any) {
    console.error('[Payment API] Verify payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Payment verification failed',
    });
  }
});

/**
 * @route   GET /api/payment/details/:paymentId
 * @desc    Get payment details
 * @access  Public (should be authenticated in production)
 */
router.get('/details/:paymentId', async (req, res) => {
  try {
    const razorpayService = getRazorpayService(redisService);
    const { paymentId } = req.params;

    const payment = await razorpayService.getPaymentDetails(paymentId);

    res.json({
      success: true,
      data: {
        id: payment.id,
        order_id: payment.order_id,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        fee: payment.fee / 100,
        tax: payment.tax / 100,
        created_at: new Date(payment.created_at * 1000),
      },
    });
  } catch (error: any) {
    console.error('[Payment API] Get payment details error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get payment details',
    });
  }
});

/**
 * @route   POST /api/payment/refund
 * @desc    Create a refund
 * @access  Protected (admin only in production)
 */
router.post('/refund', async (req, res) => {
  try {
    const razorpayService = getRazorpayService(redisService);
    const { payment_id, amount, notes } = req.body;

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID is required',
      });
    }

    const refundAmount = amount ? Math.round(amount * 100) : undefined;

    const refund = await razorpayService.createRefund(payment_id, refundAmount, notes);

    res.json({
      success: true,
      message: 'Refund initiated successfully',
      data: {
        refund_id: refund.id,
        payment_id: refund.payment_id,
        amount: refund.amount / 100,
        status: refund.status,
        created_at: new Date(refund.created_at * 1000),
      },
    });
  } catch (error: any) {
    console.error('[Payment API] Create refund error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create refund',
    });
  }
});

/**
 * @route   GET /api/payment/refund/:refundId
 * @desc    Get refund details
 * @access  Public (should be authenticated in production)
 */
router.get('/refund/:refundId', async (req, res) => {
  try {
    const razorpayService = getRazorpayService(redisService);
    const { refundId } = req.params;

    const refund = await razorpayService.getRefundDetails(refundId);

    res.json({
      success: true,
      data: {
        id: refund.id,
        payment_id: refund.payment_id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status,
        created_at: new Date(refund.created_at * 1000),
      },
    });
  } catch (error: any) {
    console.error('[Payment API] Get refund details error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get refund details',
    });
  }
});

/**
 * @route   GET /api/payment/preferences
 * @desc    Get payment method preferences
 * @access  Public
 */
router.get('/preferences', async (req, res) => {
  try {
    const razorpayService = getRazorpayService(redisService);
    const preferences = await razorpayService.getPaymentMethodPreferences();

    res.json({
      success: true,
      data: {
        preferences: preferences.map((p) => ({
          method: p.method,
          count: p.count,
          success_rate: (p.success_rate * 100).toFixed(2) + '%',
          avg_amount: (p.avg_amount / 100).toFixed(2),
        })),
      },
    });
  } catch (error: any) {
    console.error('[Payment API] Get preferences error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get payment preferences',
    });
  }
});

/**
 * @route   GET /api/payment/popular-methods
 * @desc    Get popular payment methods for Indian customers
 * @access  Public
 */
router.get('/popular-methods', async (req, res) => {
  try {
    const razorpayService = getRazorpayService(redisService);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

    const popularMethods = await razorpayService.getPopularPaymentMethods(limit);

    // Provide user-friendly labels
    const methodLabels: Record<string, string> = {
      upi: 'UPI (Google Pay, PhonePe, Paytm)',
      card: 'Credit/Debit Card',
      netbanking: 'Net Banking',
      wallet: 'Wallets (Paytm, PhonePe)',
      emi: 'EMI Options',
      cardless_emi: 'Cardless EMI',
    };

    res.json({
      success: true,
      data: {
        popular_methods: popularMethods.map((method) => ({
          method,
          label: methodLabels[method] || method,
        })),
      },
    });
  } catch (error: any) {
    console.error('[Payment API] Get popular methods error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get popular payment methods',
    });
  }
});

/**
 * @route   GET /api/payment/statistics
 * @desc    Get payment statistics
 * @access  Protected (admin only in production)
 */
router.get('/statistics', async (req, res) => {
  try {
    const razorpayService = getRazorpayService(redisService);
    const statistics = await razorpayService.getPaymentStatistics();

    if (!statistics) {
      return res.status(404).json({
        success: false,
        error: 'No statistics available',
      });
    }

    res.json({
      success: true,
      data: {
        total_payments: statistics.total_payments,
        successful_payments: statistics.successful_payments,
        failed_payments: statistics.failed_payments,
        success_rate: (statistics.success_rate * 100).toFixed(2) + '%',
        total_amount: (statistics.total_amount / 100).toFixed(2),
        avg_transaction_value: (statistics.avg_transaction_value / 100).toFixed(2),
        payment_methods: statistics.payment_methods.map((m: any) => ({
          method: m.method,
          count: m.count,
          success_rate: (m.success_rate * 100).toFixed(2) + '%',
          avg_amount: (m.avg_amount / 100).toFixed(2),
        })),
      },
    });
  } catch (error: any) {
    console.error('[Payment API] Get statistics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get payment statistics',
    });
  }
});

/**
 * @route   GET /api/payment/retry-status/:orderId
 * @desc    Check if payment can be retried
 * @access  Public (should be authenticated in production)
 */
router.get('/retry-status/:orderId', async (req, res) => {
  try {
    const razorpayService = getRazorpayService(redisService);
    const { orderId } = req.params;

    const canRetry = await razorpayService.canRetryPayment(orderId);
    const attempts = await razorpayService.getRetryAttempts(orderId);

    res.json({
      success: true,
      data: {
        order_id: orderId,
        can_retry: canRetry,
        attempts,
        max_attempts: 3,
        remaining_attempts: Math.max(0, 3 - attempts),
      },
    });
  } catch (error: any) {
    console.error('[Payment API] Get retry status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get retry status',
    });
  }
});

/**
 * @route   POST /api/payment/webhook
 * @desc    Handle Razorpay webhooks
 * @access  Public (Razorpay servers)
 */
router.post('/webhook', async (req, res) => {
  try {
    const razorpayService = getRazorpayService(redisService);
    const webhookHandler = new RazorpayWebhookHandler(razorpayService);

    await webhookHandler.handleWebhook(req, res);
  } catch (error: any) {
    console.error('[Payment API] Webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed',
    });
  }
});

export default router;
