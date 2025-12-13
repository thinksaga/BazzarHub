import express, { Request, Response } from 'express';
import RazorpayRouteService, {
  VendorAccountStatus,
  AccountType,
  PayoutStatus,
} from '../services/payment/razorpay-route.service';

const router = express.Router();

// Lazy initialization - only when credentials are available
let routeService: RazorpayRouteService | null = null;

const getRouteService = (): RazorpayRouteService => {
  if (!routeService) {
    try {
      routeService = RazorpayRouteService.getInstance();
    } catch (error: any) {
      throw new Error(`Razorpay Route service not configured: ${error.message}`);
    }
  }
  return routeService;
};

// Vendor Onboarding Endpoints

/**
 * POST /api/vendor/onboard
 * Register vendor and create Razorpay linked account
 */
router.post('/onboard', async (req: Request, res: Response) => {
  try {
    const service = getRouteService();
    const {
      vendor_id,
      bank_details,
      kyc_details,
    } = req.body;

    if (!vendor_id || !bank_details || !kyc_details) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: vendor_id, bank_details, kyc_details',
      });
    }

    const vendorAccount = await service.createLinkedAccount(
      vendor_id,
      bank_details,
      kyc_details
    );

    res.json({
      success: true,
      data: vendorAccount,
      message: 'Vendor account created successfully. Pending approval.',
    });
  } catch (error: any) {
    console.error('Error onboarding vendor:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/vendor/account/:vendorId
 * Get vendor account details
 */
router.get('/account/:vendorId', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    const service = getRouteService(); const vendorAccount = await service.getVendorAccount(vendorId);

    res.json({
      success: true,
      data: vendorAccount,
    });
  } catch (error: any) {
    console.error('Error fetching vendor account:', error);
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/vendor/approve
 * Approve vendor account (Admin only)
 */
router.post('/approve', async (req: Request, res: Response) => {
  try {
    const { vendor_id, approved_by, notes } = req.body;

    if (!vendor_id || !approved_by) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: vendor_id, approved_by',
      });
    }

    const service = getRouteService(); const vendorAccount = await service.approveVendorAccount(
      vendor_id,
      approved_by,
      notes
    );

    res.json({
      success: true,
      data: vendorAccount,
      message: 'Vendor account approved successfully',
    });
  } catch (error: any) {
    console.error('Error approving vendor:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/vendor/reject
 * Reject vendor account (Admin only)
 */
router.post('/reject', async (req: Request, res: Response) => {
  try {
    const { vendor_id, reason, rejected_by } = req.body;

    if (!vendor_id || !reason || !rejected_by) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: vendor_id, reason, rejected_by',
      });
    }

    const service = getRouteService(); const vendorAccount = await service.rejectVendorAccount(
      vendor_id,
      reason,
      rejected_by
    );

    res.json({
      success: true,
      data: vendorAccount,
      message: 'Vendor account rejected',
    });
  } catch (error: any) {
    console.error('Error rejecting vendor:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/vendor/commission/:vendorId
 * Update commission percentage (Admin only)
 */
router.put('/commission/:vendorId', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;
    const { commission_percentage } = req.body;

    if (commission_percentage === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: commission_percentage',
      });
    }

    const service = getRouteService(); const vendorAccount = await service.updateCommissionPercentage(
      vendorId,
      commission_percentage
    );

    res.json({
      success: true,
      data: vendorAccount,
      message: 'Commission percentage updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating commission:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/vendor/auto-payout/:vendorId
 * Toggle auto payout
 */
router.put('/auto-payout/:vendorId', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: enabled',
      });
    }

    const service = getRouteService(); const vendorAccount = await service.toggleAutoPayout(
      vendorId,
      enabled
    );

    res.json({
      success: true,
      data: vendorAccount,
      message: `Auto payout ${enabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error: any) {
    console.error('Error toggling auto payout:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Payout Dashboard Endpoints

/**
 * GET /api/vendor/payout/summary/:vendorId
 * Get payout summary
 */
router.get('/payout/summary/:vendorId', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    const service = getRouteService(); const summary = await service.getPayoutSummary(vendorId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Error fetching payout summary:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/vendor/payout/pending/:vendorId
 * Get pending payouts
 */
router.get('/payout/pending/:vendorId', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    const service = getRouteService(); const payouts = await service.getPayoutsByStatus(
      vendorId,
      PayoutStatus.PENDING
    );

    res.json({
      success: true,
      data: payouts,
      total: payouts.length,
    });
  } catch (error: any) {
    console.error('Error fetching pending payouts:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/vendor/payout/completed/:vendorId
 * Get completed payouts
 */
router.get('/payout/completed/:vendorId', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    const service = getRouteService(); const payouts = await service.getPayoutsByStatus(
      vendorId,
      PayoutStatus.COMPLETED
    );

    res.json({
      success: true,
      data: payouts,
      total: payouts.length,
    });
  } catch (error: any) {
    console.error('Error fetching completed payouts:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/vendor/payout/failed/:vendorId
 * Get failed payouts
 */
router.get('/payout/failed/:vendorId', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    const service = getRouteService(); const payouts = await service.getPayoutsByStatus(
      vendorId,
      PayoutStatus.FAILED
    );

    res.json({
      success: true,
      data: payouts,
      total: payouts.length,
    });
  } catch (error: any) {
    console.error('Error fetching failed payouts:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/vendor/payout/:payoutId
 * Get payout details
 */
router.get('/payout/:payoutId', async (req: Request, res: Response) => {
  try {
    const { payoutId } = req.params;

    const service = getRouteService(); const payout = await service.getPayout(payoutId);

    res.json({
      success: true,
      data: payout,
    });
  } catch (error: any) {
    console.error('Error fetching payout:', error);
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/vendor/payout/retry/:payoutId
 * Retry failed payout (Manual)
 */
router.post('/payout/retry/:payoutId', async (req: Request, res: Response) => {
  try {
    const { payoutId } = req.params;

    const service = getRouteService(); const payout = await service.retryPayout(payoutId);

    res.json({
      success: true,
      data: payout,
      message: 'Payout retry initiated successfully',
    });
  } catch (error: any) {
    console.error('Error retrying payout:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Admin Endpoints

/**
 * GET /api/vendor/admin/accounts
 * Get all vendor accounts (Admin only)
 */
router.get('/admin/accounts', async (req: Request, res: Response) => {
  try {
    const service = getRouteService(); const accounts = await service.getAllVendorAccounts();

    res.json({
      success: true,
      data: accounts,
      total: accounts.length,
    });
  } catch (error: any) {
    console.error('Error fetching vendor accounts:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/vendor/admin/notifications
 * Get admin notifications for failed payouts
 */
router.get('/admin/notifications', async (req: Request, res: Response) => {
  try {
    const service = getRouteService(); const notifications = await service.getAdminNotifications();

    res.json({
      success: true,
      data: notifications,
      total: notifications.length,
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/vendor/webhook/transfer
 * Handle Razorpay Route transfer webhooks
 */
router.post('/webhook/transfer', async (req: Request, res: Response) => {
  try {
    const event = req.body;

    const service = getRouteService(); await service.handleTransferWebhook(event);

    res.json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
