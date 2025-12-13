/**
 * Vendor Access Control Middleware
 * Enforces KYC verification before allowing vendor operations
 */

import { Request, Response, NextFunction } from 'express';

interface VendorRequest extends Request {
  vendor_id?: string;
  kyc_status?: string;
  kyc_verified?: boolean;
}

// Mock Redis client
const redisClientMock = {
  get: async (key: string) => null,
};

/**
 * Middleware: Require verified vendor
 * Checks KYC status before allowing product listing and vendor operations
 */
export const requireVerifiedVendor = async (
  req: VendorRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get vendor ID from JWT or session (mock implementation)
    const vendor_id = (req.headers as any)['x-vendor-id'];

    if (!vendor_id) {
      res.status(401).json({
        error: 'Vendor ID not found',
        required: 'x-vendor-id header',
      });
      return;
    }

    // Get vendor KYC status
    const kycJson = await redisClientMock.get(`kyc:${vendor_id}`);

    if (!kycJson) {
      res.status(403).json({
        error: 'KYC not found',
        message: 'Please submit KYC documents to proceed',
        next_step: 'kyc_submission',
      });
      return;
    }

    const kycData = JSON.parse(kycJson);

    // Attach KYC info to request
    req.vendor_id = vendor_id;
    req.kyc_status = kycData.verification_status;
    req.kyc_verified = kycData.verification_status === 'verified';

    // Check verification status
    if (kycData.verification_status === 'pending') {
      res.status(403).json({
        error: 'KYC verification pending',
        message: 'Your KYC is under review. You will be notified once verified.',
        status: 'pending',
        banner: {
          type: 'warning',
          text: 'Your account verification is in progress',
        },
      });
      return;
    }

    if (kycData.verification_status === 'pending_correction') {
      res.status(403).json({
        error: 'KYC corrections required',
        message: 'Please resubmit KYC with required corrections',
        status: 'pending_correction',
        corrections_required: kycData.corrections_required || [],
        banner: {
          type: 'error',
          text: 'KYC corrections required. Please resubmit.',
        },
      });
      return;
    }

    if (kycData.verification_status === 'rejected') {
      res.status(403).json({
        error: 'KYC rejected',
        message: 'Your KYC submission was rejected',
        rejection_reason: kycData.rejection_reason,
        status: 'rejected',
        banner: {
          type: 'error',
          text: 'KYC was rejected. Contact support for details.',
        },
      });
      return;
    }

    if (kycData.verification_status === 'verified') {
      // All good, proceed
      next();
      return;
    }

    // Unknown status
    res.status(403).json({
      error: 'Invalid KYC status',
      status: kycData.verification_status,
    });
  } catch (error) {
    console.error('[VENDOR/ACCESS] KYC verification check failed', error);
    res.status(500).json({
      error: 'Failed to verify vendor status',
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Middleware: Attach KYC status to request (non-blocking)
 * Adds KYC info and banner message to response if not verified
 */
export const attachKYCStatus = async (
  req: VendorRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vendor_id = (req.headers as any)['x-vendor-id'];

    if (!vendor_id) {
      next();
      return;
    }

    // Get vendor KYC status
    const kycJson = await redisClientMock.get(`kyc:${vendor_id}`);

    if (!kycJson) {
      next();
      return;
    }

    const kycData = JSON.parse(kycJson);

    // Attach to request
    req.vendor_id = vendor_id;
    req.kyc_status = kycData.verification_status;
    req.kyc_verified = kycData.verification_status === 'verified';

    // Add banner to response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (kycData.verification_status !== 'verified') {
        body.kyc_banner = {
          visible: true,
          type: kycData.verification_status === 'pending' ? 'warning' : 'error',
          text: kycData.verification_status === 'pending'
            ? 'Your account verification is in progress'
            : 'KYC corrections required. Please resubmit.',
          action_url: '/vendor/kyc/resubmit',
        };
      }
      return originalJson(body);
    };

    next();
  } catch (error) {
    console.warn('[VENDOR/ACCESS] Failed to attach KYC status', error);
    next(); // Don't block on error
  }
};

/**
 * Middleware: Check vendor is owner of resource
 * Ensures vendor can only access their own data
 */
export const verifyVendorOwnership = (
  req: VendorRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const vendor_id = (req.headers as any)['x-vendor-id'];
    const resource_vendor_id = req.params.vendor_id || req.body.vendor_id;

    if (!vendor_id) {
      res.status(401).json({ error: 'Vendor not authenticated' });
      return;
    }

    if (vendor_id !== resource_vendor_id) {
      res.status(403).json({
        error: 'Vendor cannot access this resource',
        message: 'You do not have permission to access this vendor data',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[VENDOR/OWNERSHIP] Ownership check failed', error);
    res.status(500).json({
      error: 'Failed to verify vendor ownership',
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Middleware: Attach KYC info to response headers
 * Useful for tracking KYC verification across requests
 */
export const attachKYCHeaders = (
  req: VendorRequest,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader('X-KYC-Status', req.kyc_status || 'unknown');
  res.setHeader('X-KYC-Verified', req.kyc_verified ? 'true' : 'false');
  next();
};

export default {
  requireVerifiedVendor,
  attachKYCStatus,
  verifyVendorOwnership,
  attachKYCHeaders,
};
