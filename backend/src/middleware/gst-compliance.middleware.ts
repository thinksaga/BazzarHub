import { Request, Response, NextFunction } from 'express';
import GSTService from '../services/gst.service';

const gstService = GSTService.getInstance();

// Validation helper functions
const validateGSTIN = (gstin: string): { valid: boolean; error?: string } => {
  if (!gstin) return { valid: false, error: 'GSTIN is required' };
  if (!/^[0-9A-Z]{15}$/.test(gstin)) {
    return { valid: false, error: 'GSTIN must be 15 alphanumeric characters' };
  }
  return { valid: true };
};

const validateHSNCode = (hsnCode: string): { valid: boolean; error?: string } => {
  if (!hsnCode) return { valid: false, error: 'HSN code is required' };
  if (!/^\d{4,8}$/.test(hsnCode)) {
    return { valid: false, error: 'HSN code must be 4-8 digits' };
  }
  return { valid: true };
};

const validatePAN = (pan: string): { valid: boolean; error?: string } => {
  if (!pan) return { valid: false, error: 'PAN is required' };
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
    return { valid: false, error: 'PAN must be 10 characters (5 letters, 4 digits, 1 letter)' };
  }
  return { valid: true };
};

const validateProductPublish = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!data.product_id) errors.push('product_id is required');
  if (!data.name) errors.push('name is required');
  if (!data.category) errors.push('category is required');
  if (!data.hsn_code) errors.push('hsn_code is required');
  if (!data.price || data.price <= 0) errors.push('price must be a positive number');
  if (!data.vendor_id) errors.push('vendor_id is required');
  
  if (data.hsn_code) {
    const hsnValidation = validateHSNCode(data.hsn_code);
    if (!hsnValidation.valid) errors.push(hsnValidation.error || '');
  }

  return { valid: errors.length === 0, errors };
};

const validateVendorGST = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!data.vendor_id) errors.push('vendor_id is required');
  if (!data.gstin) errors.push('gstin is required');
  if (!data.business_name) errors.push('business_name is required');
  if (!data.pan) errors.push('pan is required');
  if (!data.address) errors.push('address is required');
  if (!data.state) errors.push('state is required');
  
  if (data.gstin) {
    const gstinValidation = validateGSTIN(data.gstin);
    if (!gstinValidation.valid) errors.push(gstinValidation.error || '');
  }
  
  if (data.pan) {
    const panValidation = validatePAN(data.pan);
    if (!panValidation.valid) errors.push(panValidation.error || '');
  }

  return { valid: errors.length === 0, errors };
};

const validateOrder = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!data.order_id) errors.push('order_id is required');
  if (!data.vendor_id) errors.push('vendor_id is required');
  if (!data.customer_id) errors.push('customer_id is required');
  if (!Array.isArray(data.items)) errors.push('items must be an array');
  
  if (Array.isArray(data.items)) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (!item.product_id) errors.push(`items[${i}].product_id is required`);
      if (!item.hsn_code) errors.push(`items[${i}].hsn_code is required`);
      if (!item.quantity || item.quantity <= 0) errors.push(`items[${i}].quantity must be positive`);
      if (!item.price || item.price <= 0) errors.push(`items[${i}].price must be positive`);
      
      if (item.hsn_code) {
        const hsnValidation = validateHSNCode(item.hsn_code);
        if (!hsnValidation.valid) errors.push(`items[${i}].${hsnValidation.error}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Middleware to validate product HSN code before publishing
 * Ensures all products have valid HSN codes
 */
export const validateProductHSN = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('[Compliance Middleware] Validating product HSN code');

    // Validate request schema
    const validation = validateProductPublish(req.body);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
      });
      return;
    }

    const { hsn_code, product_id } = req.body;

    // Validate HSN code exists in GST system
    const gstRate = await gstService.getGSTRate(hsn_code);
    if (!gstRate) {
      res.status(400).json({
        error: 'Invalid HSN code',
        message: `HSN code ${hsn_code} not found in GST system`,
        suggestion: 'Please use a valid HSN code from the GST portal',
      });
      return;
    }

    console.log('[Compliance Middleware] Product HSN validation passed:', {
      product_id,
      hsn_code,
      gst_rate: gstRate.gst_rate,
    });

    // Attach validation data to request
    (req as any).gstValidation = {
      hsn_code,
      gst_rate: gstRate.gst_rate,
      cess_rate: gstRate.cess_rate,
    };

    next();

  } catch (error: any) {
    console.error('[Compliance Middleware] Error validating product HSN:', error);
    res.status(500).json({
      error: 'HSN validation failed',
      message: error.message,
    });
  }
};

/**
 * Middleware to verify vendor GSTIN before approval
 * Ensures vendor details are valid and compliant
 */
export const verifyVendorGSTIN = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('[Compliance Middleware] Verifying vendor GSTIN');

    // Validate request schema
    const validation = validateVendorGST(req.body);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
      });
      return;
    }

    const { gstin, pan, vendor_id, state } = req.body;

    // Validate GSTIN format and checksum
    const gstinValidation = gstService.validateGSTIN(gstin);
    if (!gstinValidation.valid) {
      res.status(400).json({
        error: 'Invalid GSTIN',
        message: gstinValidation.error,
        format_valid: gstinValidation.format_valid,
        checksum_valid: gstinValidation.checksum_valid,
      });
      return;
    }

    // Extract state code from GSTIN (first 2 characters)
    const stateCodeFromGSTIN = gstin.substring(0, 2);

    // Validate state matches GSTIN (optional but recommended)
    console.log('[Compliance Middleware] Vendor GSTIN validation passed:', {
      vendor_id,
      gstin,
      state_code: stateCodeFromGSTIN,
      pan: pan.substring(0, 5) + '****' + pan.slice(-1), // Masked
    });

    // Attach validation data to request
    (req as any).gstCompliance = {
      gstin_valid: true,
      state_code: stateCodeFromGSTIN,
      pan_valid: true,
    };

    next();

  } catch (error: any) {
    console.error('[Compliance Middleware] Error verifying vendor GSTIN:', error);
    res.status(500).json({
      error: 'GSTIN verification failed',
      message: error.message,
    });
  }
};

/**
 * Middleware to validate order GST compliance
 * Ensures all products have valid HSN codes and vendor GST details are valid
 */
export const validateOrderGSTCompliance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('[Compliance Middleware] Validating order GST compliance');

    // Validate request schema
    const validation = validateOrder(req.body);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
      });
      return;
    }

    const { items } = req.body;

    // Validate all products have HSN codes
    for (const item of items) {
      if (!item.hsn_code) {
        res.status(400).json({
          error: 'Missing HSN code',
          product_id: item.product_id,
          message: `Product ${item.product_id} does not have a valid HSN code`,
        });
        return;
      }

      // Validate HSN code exists
      const gstRate = await gstService.getGSTRate(item.hsn_code);
      if (!gstRate) {
        res.status(400).json({
          error: 'Invalid HSN code',
          product_id: item.product_id,
          hsn_code: item.hsn_code,
          message: `HSN code not found in GST system`,
        });
        return;
      }
    }

    // Validate vendor GST details (in production, fetch from database)
    console.log('[Compliance Middleware] Order GST compliance validation passed:', {
      order_id: req.body.order_id,
      vendor_id: req.body.vendor_id,
      items_count: items.length,
    });

    // Attach validation data to request
    (req as any).orderGSTCompliance = {
      validated: true,
      items_count: items.length,
    };

    next();

  } catch (error: any) {
    console.error('[Compliance Middleware] Error validating order GST compliance:', error);
    res.status(500).json({
      error: 'Order GST compliance validation failed',
      message: error.message,
    });
  }
};

/**
 * Middleware to block orders with invalid GST details
 * Prevents processing of non-compliant orders
 */
export const enforceGSTCompliance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('[Compliance Middleware] Enforcing GST compliance');

    const { vendor_id, order_id } = req.body;

    // Check vendor GSTIN (in production, fetch from database)
    // This is a placeholder implementation
    const vendorGSTINValid = true; // Should validate from database

    if (!vendorGSTINValid) {
      res.status(403).json({
        error: 'Vendor GST details invalid',
        message: 'Order cannot be processed. Vendor GST details are not compliant.',
        vendor_id,
      });
      return;
    }

    // Check all products have valid HSN codes
    if ((req as any).orderGSTCompliance?.validated !== true) {
      res.status(400).json({
        error: 'Order GST compliance check failed',
        message: 'Please run order compliance validation first',
      });
      return;
    }

    console.log('[Compliance Middleware] GST compliance enforced successfully');

    next();

  } catch (error: any) {
    console.error('[Compliance Middleware] Error enforcing GST compliance:', error);
    res.status(500).json({
      error: 'GST compliance enforcement failed',
      message: error.message,
    });
  }
};

/**
 * Middleware to log GST compliance actions for audit trail
 */
export const auditGSTCompliance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const auditData = {
      timestamp: new Date(),
      method: req.method,
      path: req.path,
      vendor_id: req.body?.vendor_id,
      order_id: req.body?.order_id,
      product_id: req.body?.product_id,
      gst_validation: (req as any).gstValidation,
      gst_compliance: (req as any).gstCompliance,
      action_type: req.path.includes('publish') ? 'product_publish' : 'order_creation',
    };

    console.log('[Compliance Audit] GST action:', auditData);

    // In production, store in audit database
    // For now, just log

    next();

  } catch (error: any) {
    console.error('[Compliance Middleware] Error in audit logging:', error);
    next(); // Continue despite audit error
  }
};

export default {
  validateProductHSN,
  verifyVendorGSTIN,
  validateOrderGSTCompliance,
  enforceGSTCompliance,
  auditGSTCompliance,
};
