/**
 * Vendor Access Control Middleware
 * Enforces KYC verification before allowing vendor operations
 */

import { Request, Response, NextFunction } from 'express';
import { VendorAccountService } from '../services/vendor-account.service';
import { VendorAccountStatus } from '../models/vendor-account.model';

interface VendorRequest extends Request {
  user?: any;
  vendor?: any;
  vendor_id?: string;
  kyc_status?: string;
  kyc_verified?: boolean;
}

const vendorAccountService = new VendorAccountService();

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
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
      });
      return;
    }

    // Get vendor account
    const vendor = await vendorAccountService.findByUserId(userId);

    if (!vendor) {
      res.status(403).json({
        error: 'Vendor account not found',
        message: 'Please complete vendor registration',
        next_step: 'vendor_registration',
      });
      return;
    }

    // Attach vendor info to request
    req.vendor = vendor;
    req.vendor_id = vendor.id;
    req.kyc_status = vendor.status;
    req.kyc_verified = vendor.status === VendorAccountStatus.VERIFIED;

    // Check verification status
    if (vendor.status === VendorAccountStatus.PENDING || vendor.status === VendorAccountStatus.UNDER_REVIEW) {
      res.status(403).json({
        error: 'KYC verification pending',
        message: 'Your KYC is under review. You will be notified once verified.',
        status: vendor.status,
        banner: {
          type: 'warning',
          text: 'Your account verification is in progress',
        },
      });
      return;
    }

    if (vendor.status === VendorAccountStatus.REJECTED) {
      res.status(403).json({
        error: 'KYC rejected',
        message: 'Your KYC submission was rejected',
        status: vendor.status,
        banner: {
          type: 'error',
          text: 'KYC was rejected. Contact support for details.',
        },
      });
      return;
    }

    if (vendor.status === VendorAccountStatus.SUSPENDED) {
      res.status(403).json({
        error: 'Account suspended',
        message: 'Your account has been suspended',
        status: vendor.status,
        banner: {
          type: 'error',
          text: 'Account suspended.',
        },
      });
      return;
    }

    if (vendor.status === VendorAccountStatus.VERIFIED) {
      // All good, proceed
      next();
      return;
    }

    // Unknown status
    res.status(403).json({
      error: 'Invalid KYC status',
      status: vendor.status,
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
    const userId = req.user?.id;

    if (!userId) {
      next();
      return;
    }

    const vendor = await vendorAccountService.findByUserId(userId);

    if (!vendor) {
      next();
      return;
    }

    // Attach to request
    req.vendor = vendor;
    req.vendor_id = vendor.id;
    req.kyc_status = vendor.status;
    req.kyc_verified = vendor.status === VendorAccountStatus.VERIFIED;

    // Add banner to response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (vendor.status !== VendorAccountStatus.VERIFIED) {
        body.kyc_banner = {
          visible: true,
          type: (vendor.status === VendorAccountStatus.PENDING || vendor.status === VendorAccountStatus.UNDER_REVIEW) ? 'warning' : 'error',
          text: (vendor.status === VendorAccountStatus.PENDING || vendor.status === VendorAccountStatus.UNDER_REVIEW)
            ? 'Your account verification is in progress'
            : 'Account issue. Please check status.',
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
    const vendor_id = req.vendor_id; // Set by requireVerifiedVendor or attachKYCStatus
    const resource_vendor_id = req.params.vendor_id || req.body.vendor_id;

    if (!vendor_id) {
      res.status(401).json({ error: 'Vendor not authenticated' });
      return;
    }

    if (resource_vendor_id && vendor_id !== resource_vendor_id) {
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
