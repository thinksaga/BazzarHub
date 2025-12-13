/**
 * Admin KYC Verification Routes
 * Handles KYC document review, approval, and rejection
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';

const router = Router();

// Mock Redis and services
const redisClientMock = {
  get: async (key: string) => null,
  setEx: async (key: string, ttl: number, value: string) => {},
  lrange: async (key: string, start: number, end: number) => [],
  lpush: async (key: string, value: string) => {},
};

/**
 * RBAC middleware - verify admin has KYC admin role
 */
const requireKYCAdmin = (req: Request, res: Response, next: NextFunction): void => {
  // Mock implementation - in production, verify JWT token and check role
  const adminRole = (req.headers as any)['x-admin-role'];

  if (adminRole !== 'kyc_admin' && adminRole !== 'super_admin') {
    res.status(403).json({
      error: 'Insufficient permissions',
      required_role: 'kyc_admin',
    });
    return;
  }

  (req as any).admin_id = (req.headers as any)['x-admin-id'] || 'admin_system';
  next();
};

/**
 * GET /admin/kyc/pending
 * List all pending KYC submissions
 */
router.get('/pending', requireKYCAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Retrieve pending KYC list
    const pendingKYCs = await redisClientMock.lrange('kyc:pending', offset, offset + limit - 1);

    const pendingData = pendingKYCs.map((item: string) => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    }).filter((item: any) => item !== null);

    console.log('[AUDIT] Pending KYC list accessed', {
      admin_id: (req as any).admin_id,
      count: pendingData.length,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      pending_count: pendingData.length,
      data: pendingData,
      pagination: {
        offset,
        limit,
        total: pendingData.length,
      },
    });
  } catch (error) {
    console.error('[ADMIN/KYC] Failed to get pending KYCs', error);
    res.status(500).json({
      error: 'Failed to retrieve pending KYCs',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /admin/kyc/:vendor_id
 * View KYC documents for a vendor (with decryption)
 */
router.get('/:vendor_id', requireKYCAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { vendor_id } = req.params;

    if (!vendor_id.startsWith('vendor_')) {
      res.status(400).json({ error: 'Invalid vendor ID' });
      return;
    }

    // Get KYC data
    const kycJson = await redisClientMock.get(`kyc:${vendor_id}`);
    if (!kycJson) {
      res.status(404).json({ error: 'KYC data not found for this vendor' });
      return;
    }

    const kycData = JSON.parse(kycJson);

    // Log access for audit trail
    console.log('[AUDIT] KYC document accessed', {
      vendor_id,
      admin_id: (req as any).admin_id,
      timestamp: new Date().toISOString(),
    });

    // Return KYC with documents (encrypted data should be decrypted on-demand)
    res.json({
      success: true,
      kyc: {
        vendor_id: kycData.vendor_id,
        submission_id: kycData.submission_id,
        verification_status: kycData.verification_status,
        created_at: kycData.created_at,
        updated_at: kycData.updated_at,
        aadhaar_masked: kycData.aadhaar_last_four,
        gstin: kycData.gstin,
        documents: kycData.document_urls,
        // Note: In production, decrypt sensitive fields only when needed
      },
    });
  } catch (error) {
    console.error('[ADMIN/KYC] Failed to retrieve KYC', error);
    res.status(500).json({
      error: 'Failed to retrieve KYC data',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /admin/kyc/:vendor_id/approve
 * Approve KYC and create Razorpay linked account
 */
router.post('/:vendor_id/approve', requireKYCAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { vendor_id } = req.params;
    const { notes } = req.body;

    if (!vendor_id.startsWith('vendor_')) {
      res.status(400).json({ error: 'Invalid vendor ID' });
      return;
    }

    // Get KYC data
    const kycJson = await redisClientMock.get(`kyc:${vendor_id}`);
    if (!kycJson) {
      res.status(404).json({ error: 'KYC data not found' });
      return;
    }

    const kycData = JSON.parse(kycJson);

    // Verify KYC is pending
    if (kycData.verification_status !== 'pending') {
      res.status(400).json({
        error: `Cannot approve KYC with status: ${kycData.verification_status}`,
      });
      return;
    }

    // Update KYC status to verified
    kycData.verification_status = 'verified';
    kycData.updated_at = new Date().toISOString();
    kycData.approved_by = (req as any).admin_id;
    kycData.approved_at = new Date().toISOString();
    kycData.approval_notes = notes;

    await redisClientMock.setEx(
      `kyc:${vendor_id}`,
      30 * 24 * 60 * 60,
      JSON.stringify(kycData)
    );

    // Get vendor data to create Razorpay account
    const vendorJson = await redisClientMock.get(`vendor:${vendor_id}`);
    if (vendorJson) {
      const vendorData = JSON.parse(vendorJson);
      vendorData.kyc_verified_at = new Date().toISOString();
      vendorData.kyc_status = 'verified';

      // Create Razorpay linked account (mock)
      const razorpay_account_id = `acc_${uuid()}`;
      vendorData.razorpay_account_id = razorpay_account_id;

      console.log('[RAZORPAY] Linked account created', {
        vendor_id,
        account_id: razorpay_account_id,
      });

      // Enable vendor account
      vendorData.status = 'active';

      await redisClientMock.setEx(
        `vendor:${vendor_id}`,
        30 * 24 * 60 * 60,
        JSON.stringify(vendorData)
      );
    }

    // Audit log
    console.log('[AUDIT] KYC approved', {
      vendor_id,
      admin_id: (req as any).admin_id,
      timestamp: new Date().toISOString(),
    });

    // Send approval email (mock)
    console.log('[EMAIL] KYC approval email sent', {
      vendor_id,
      email: kycData.vendor_id,
    });

    res.json({
      success: true,
      message: 'KYC approved successfully',
      vendor_id,
      status: 'verified',
      razorpay_account_created: true,
    });
  } catch (error) {
    console.error('[ADMIN/KYC] Approval failed', error);
    res.status(500).json({
      error: 'Failed to approve KYC',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /admin/kyc/:vendor_id/reject
 * Reject KYC with reason
 */
router.post('/:vendor_id/reject', requireKYCAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { vendor_id } = req.params;
    const { reason, corrections_required } = req.body;

    if (!vendor_id.startsWith('vendor_')) {
      res.status(400).json({ error: 'Invalid vendor ID' });
      return;
    }

    if (!reason) {
      res.status(400).json({ error: 'Rejection reason is required' });
      return;
    }

    // Get KYC data
    const kycJson = await redisClientMock.get(`kyc:${vendor_id}`);
    if (!kycJson) {
      res.status(404).json({ error: 'KYC data not found' });
      return;
    }

    const kycData = JSON.parse(kycJson);

    // Update KYC status to rejected
    kycData.verification_status = 'pending_correction';
    kycData.updated_at = new Date().toISOString();
    kycData.rejected_by = (req as any).admin_id;
    kycData.rejected_at = new Date().toISOString();
    kycData.rejection_reason = reason;
    kycData.corrections_required = corrections_required || [];

    await redisClientMock.setEx(
      `kyc:${vendor_id}`,
      30 * 24 * 60 * 60,
      JSON.stringify(kycData)
    );

    // Audit log
    console.log('[AUDIT] KYC rejected', {
      vendor_id,
      reason,
      admin_id: (req as any).admin_id,
      timestamp: new Date().toISOString(),
    });

    // Send rejection email with corrections needed (mock)
    console.log('[EMAIL] KYC rejection email sent', {
      vendor_id,
      reason,
      corrections: corrections_required,
    });

    res.json({
      success: true,
      message: 'KYC rejected',
      vendor_id,
      status: 'pending_correction',
      rejection_reason: reason,
    });
  } catch (error) {
    console.error('[ADMIN/KYC] Rejection failed', error);
    res.status(500).json({
      error: 'Failed to reject KYC',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /admin/kyc/stats
 * Get KYC statistics
 */
router.get('/stats', requireKYCAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    // Mock stats - in production, aggregate from database
    const stats = {
      total_submissions: 150,
      pending: 23,
      verified: 115,
      rejected: 12,
      pending_correction: 8,
      approval_rate: 76.7,
      avg_review_time_hours: 24,
    };

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[ADMIN/KYC] Failed to get stats', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
