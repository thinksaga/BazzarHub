/**
 * GST Compliance Validation Schemas
 * Comprehensive validation rules for all GST operations
 */

/**
 * Product Validation Schema
 */
export const productValidationRules = {
  product_id: {
    required: true,
    type: 'string',
    pattern: '^[a-zA-Z0-9_-]+$',
    minLength: 1,
    maxLength: 100,
  },
  name: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 255,
  },
  category: {
    required: true,
    type: 'string',
    enum: [
      'electronics',
      'clothing',
      'food',
      'books',
      'cosmetics',
      'furniture',
      'home_appliances',
      'sports',
      'jewelry',
      'other',
    ],
  },
  hsn_code: {
    required: true,
    type: 'string',
    pattern: '^\\d{4,8}$',
    description: 'HSN code must be 4-8 digits',
  },
  price: {
    required: true,
    type: 'number',
    minimum: 1,
    description: 'Price in paise (₹1 = 100 paise)',
  },
  vendor_id: {
    required: true,
    type: 'string',
    pattern: '^vendor_[a-zA-Z0-9]+$',
  },
  sku: {
    required: false,
    type: 'string',
    maxLength: 50,
  },
  description: {
    required: false,
    type: 'string',
    maxLength: 1000,
  },
  tax_rate_override: {
    required: false,
    type: 'number',
    minimum: 0,
    maximum: 100,
    description: 'Override standard GST rate if applicable',
  },
};

/**
 * Vendor GST Validation Schema
 */
export const vendorGSTValidationRules = {
  vendor_id: {
    required: true,
    type: 'string',
    pattern: '^vendor_[a-zA-Z0-9]+$',
  },
  gstin: {
    required: true,
    type: 'string',
    pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
    length: 15,
    description: '15-character GSTIN with valid checksum',
  },
  pan: {
    required: true,
    type: 'string',
    pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
    length: 10,
    description: 'Permanent Account Number format',
  },
  business_name: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 255,
  },
  business_type: {
    required: true,
    type: 'string',
    enum: ['sole_proprietor', 'partnership', 'llp', 'pvt_ltd', 'public_ltd', 'other'],
  },
  address: {
    required: true,
    type: 'string',
    minLength: 10,
    maxLength: 500,
  },
  state: {
    required: true,
    type: 'string',
    enum: [
      'andaman_nicobar',
      'andhra_pradesh',
      'arunachal_pradesh',
      'assam',
      'bihar',
      'chandigarh',
      'chhattisgarh',
      'dadra_nagar_haveli',
      'daman_diu',
      'delhi',
      'goa',
      'gujarat',
      'haryana',
      'himachal_pradesh',
      'jharkhand',
      'karnataka',
      'kerala',
      'ladakh',
      'lakshadweep',
      'madhya_pradesh',
      'maharashtra',
      'manipur',
      'meghalaya',
      'mizoram',
      'nagaland',
      'odisha',
      'puducherry',
      'punjab',
      'rajasthan',
      'sikkim',
      'tamil_nadu',
      'telangana',
      'tripura',
      'uttar_pradesh',
      'uttarakhand',
      'west_bengal',
    ],
    description: 'State where vendor is registered',
  },
  email: {
    required: true,
    type: 'string',
    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
  },
  phone: {
    required: true,
    type: 'string',
    pattern: '^[0-9]{10}$',
    description: '10-digit phone number',
  },
  bank_name: {
    required: false,
    type: 'string',
  },
  bank_account_number: {
    required: false,
    type: 'string',
    pattern: '^[0-9]{9,18}$',
  },
  bank_ifsc: {
    required: false,
    type: 'string',
    pattern: '^[A-Z]{4}0[A-Z0-9]{6}$',
  },
  gst_registration_date: {
    required: true,
    type: 'date',
    description: 'Date of GST registration',
  },
  composition_scheme_opted: {
    required: false,
    type: 'boolean',
  },
  exemption_category: {
    required: false,
    type: 'string',
    enum: ['none', 'small_business', 'nonprofit', 'government', 'other'],
  },
};

/**
 * Order Validation Schema
 */
export const orderValidationRules = {
  order_id: {
    required: true,
    type: 'string',
    pattern: '^order_[a-zA-Z0-9]+$',
  },
  vendor_id: {
    required: true,
    type: 'string',
    pattern: '^vendor_[a-zA-Z0-9]+$',
  },
  customer_id: {
    required: true,
    type: 'string',
    pattern: '^cust_[a-zA-Z0-9]+$',
  },
  items: {
    required: true,
    type: 'array',
    minItems: 1,
    maxItems: 1000,
    itemSchema: {
      product_id: {
        required: true,
        type: 'string',
      },
      product_name: {
        required: true,
        type: 'string',
      },
      hsn_code: {
        required: true,
        type: 'string',
        pattern: '^\\d{4,8}$',
      },
      quantity: {
        required: true,
        type: 'number',
        minimum: 1,
      },
      unit_price: {
        required: true,
        type: 'number',
        minimum: 1,
        description: 'Price in paise',
      },
      tax_rate: {
        required: false,
        type: 'number',
        minimum: 0,
        maximum: 100,
      },
    },
  },
  buyer_state: {
    required: true,
    type: 'string',
    description: 'Buyer/Shipping state for determining CGST+SGST vs IGST',
  },
  seller_state: {
    required: true,
    type: 'string',
    description: 'Seller state for determining CGST+SGST vs IGST',
  },
  shipping_address: {
    required: true,
    type: 'string',
    minLength: 10,
    maxLength: 500,
  },
  customer_gstin: {
    required: false,
    type: 'string',
    pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
    description: 'Optional for B2C transactions',
  },
  invoice_required: {
    required: false,
    type: 'boolean',
    default: true,
  },
};

/**
 * Invoice Validation Schema
 */
export const invoiceValidationRules = {
  invoice_number: {
    required: true,
    type: 'string',
    pattern: '^[A-Z0-9_/]+$',
    description: 'Format: VENDOR_ID/FY/SEQUENCE',
  },
  order_id: {
    required: true,
    type: 'string',
  },
  vendor_gstin: {
    required: true,
    type: 'string',
    pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
  },
  customer_gstin: {
    required: false,
    type: 'string',
    pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
  },
  total_taxable_value: {
    required: true,
    type: 'number',
    minimum: 0,
  },
  total_gst: {
    required: true,
    type: 'number',
    minimum: 0,
  },
  invoice_date: {
    required: true,
    type: 'date',
    description: 'Date in YYYY-MM-DD format',
  },
};

/**
 * GST Report Validation Schema
 */
export const gstReportValidationRules = {
  vendor_id: {
    required: true,
    type: 'string',
    pattern: '^vendor_[a-zA-Z0-9]+$',
  },
  month: {
    required: true,
    type: 'number',
    minimum: 1,
    maximum: 12,
  },
  year: {
    required: true,
    type: 'number',
    minimum: 2017,
    maximum: 2100,
  },
  report_type: {
    required: true,
    type: 'string',
    enum: ['gstr1', 'gstr3b', 'gstr2', 'gstr2a'],
  },
};

/**
 * TDS Calculation Validation Schema
 */
export const tdsValidationRules = {
  vendor_id: {
    required: true,
    type: 'string',
    pattern: '^vendor_[a-zA-Z0-9]+$',
  },
  payout_amount: {
    required: true,
    type: 'number',
    minimum: 0,
    description: 'Amount in paise',
  },
  vendor_pan: {
    required: false,
    type: 'string',
    pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
  },
  has_pan: {
    required: false,
    type: 'boolean',
    default: false,
  },
};

/**
 * GSTIN Validation Rules
 */
export const gstinValidationRules = {
  format: {
    required: true,
    pattern: '^[0-9A-Z]{15}$',
    description: '15 alphanumeric characters',
  },
  state_code: {
    required: true,
    position: '0-2',
    type: 'string',
    validValues: Array.from({ length: 37 }, (_, i) => String(i + 1).padStart(2, '0')),
  },
  pan: {
    required: true,
    position: '2-12',
    type: 'string',
    pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
  },
  entity_code: {
    required: true,
    position: '12-13',
    type: 'string',
    validValues: ['Z', 'C', 'S', 'H', 'A', 'B', 'G', 'J', 'F', 'P', 'T', 'N', 'E', 'U', 'D', 'M'],
  },
  check_digit: {
    required: true,
    position: '14-15',
    type: 'string',
    algorithm: 'Verhoeff',
  },
};

/**
 * HSN Code Validation Rules
 */
export const hsnValidationRules = {
  format: {
    required: true,
    pattern: '^\\d{4,8}$',
    description: '4-8 digit numeric code',
  },
  structure: {
    sections: 4,
    section1: '2 digits - Chapter',
    section2: '2 digits - Heading',
    section3: '2 digits - Sub-heading',
    section4: '4 digits - Sub-sub-heading (optional)',
  },
  valid_ranges: {
    '01-05': 'Animal & animal products',
    '06-15': 'Vegetable products',
    '16-24': 'Foodstuffs',
    '25-27': 'Mineral products',
    '28-38': 'Chemicals & related products',
    '39-40': 'Plastics & rubbers',
    '41-43': 'Hides & skins',
    '44-49': 'Wood & wood products',
    '50-63': 'Textiles & apparel',
    '64-67': 'Footwear',
    '68-71': 'Stone, plaster, cement',
    '72-83': 'Metals & metal articles',
    '84-85': 'Electrical machinery',
    '86-89': 'Transportation',
    '90-97': 'Miscellaneous',
  },
};

/**
 * Compliance Error Codes
 */
export const complianceErrorCodes = {
  // GSTIN Errors
  GSTIN_INVALID_FORMAT: {
    code: 'GSTIN_001',
    message: 'GSTIN format is invalid',
    httpStatus: 400,
  },
  GSTIN_INVALID_CHECKSUM: {
    code: 'GSTIN_002',
    message: 'GSTIN checksum validation failed',
    httpStatus: 400,
  },
  GSTIN_INVALID_STATE: {
    code: 'GSTIN_003',
    message: 'Invalid state code in GSTIN',
    httpStatus: 400,
  },

  // HSN Errors
  HSN_MISSING: {
    code: 'HSN_001',
    message: 'HSN code is required',
    httpStatus: 400,
  },
  HSN_INVALID_FORMAT: {
    code: 'HSN_002',
    message: 'HSN code format is invalid',
    httpStatus: 400,
  },
  HSN_NOT_FOUND: {
    code: 'HSN_003',
    message: 'HSN code not found in GST system',
    httpStatus: 404,
  },

  // PAN Errors
  PAN_INVALID_FORMAT: {
    code: 'PAN_001',
    message: 'PAN format is invalid',
    httpStatus: 400,
  },
  PAN_MISMATCH: {
    code: 'PAN_002',
    message: 'PAN does not match GSTIN',
    httpStatus: 400,
  },

  // Invoice Errors
  INVOICE_GENERATION_FAILED: {
    code: 'INV_001',
    message: 'Invoice generation failed',
    httpStatus: 500,
  },
  INVOICE_NOT_FOUND: {
    code: 'INV_002',
    message: 'Invoice not found',
    httpStatus: 404,
  },
  VENDOR_GSTIN_INVALID: {
    code: 'INV_003',
    message: 'Vendor GSTIN is invalid',
    httpStatus: 400,
  },

  // Order Errors
  ORDER_MISSING_HSN: {
    code: 'ORD_001',
    message: 'One or more items missing HSN code',
    httpStatus: 400,
  },
  ORDER_VENDOR_NOT_COMPLIANT: {
    code: 'ORD_002',
    message: 'Vendor GST details not compliant',
    httpStatus: 403,
  },
  ORDER_STATE_MISMATCH: {
    code: 'ORD_003',
    message: 'Order state information is invalid',
    httpStatus: 400,
  },

  // Tax Errors
  GST_CALCULATION_FAILED: {
    code: 'TAX_001',
    message: 'GST calculation failed',
    httpStatus: 500,
  },
  TDS_CALCULATION_FAILED: {
    code: 'TAX_002',
    message: 'TDS calculation failed',
    httpStatus: 500,
  },

  // Report Errors
  REPORT_GENERATION_FAILED: {
    code: 'REP_001',
    message: 'Report generation failed',
    httpStatus: 500,
  },
  REPORT_NOT_FOUND: {
    code: 'REP_002',
    message: 'Report not found',
    httpStatus: 404,
  },
};

/**
 * Validation Helper Functions
 */

export function validateGSTIN(gstin: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check length
  if (gstin.length !== 15) {
    errors.push('GSTIN must be exactly 15 characters');
  }

  // Check format
  if (!/^[0-9A-Z]{15}$/.test(gstin)) {
    errors.push('GSTIN must contain only numbers and uppercase letters');
  }

  // Check state code
  const stateCode = parseInt(gstin.substring(0, 2));
  if (stateCode < 1 || stateCode > 37) {
    errors.push(`Invalid state code: ${gstin.substring(0, 2)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateHSNCode(hsn: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check format
  if (!/^\d{4,8}$/.test(hsn)) {
    errors.push('HSN code must be 4-8 digits');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validatePAN(pan: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check format
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
    errors.push('PAN must be 10 characters: 5 letters, 4 digits, 1 letter');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateEmail(email: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validatePhone(phone: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!/^\d{10}$/.test(phone)) {
    errors.push('Phone number must be 10 digits');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  productValidationRules,
  vendorGSTValidationRules,
  orderValidationRules,
  invoiceValidationRules,
  gstReportValidationRules,
  tdsValidationRules,
  gstinValidationRules,
  hsnValidationRules,
  complianceErrorCodes,
  validateGSTIN,
  validateHSNCode,
  validatePAN,
  validateEmail,
  validatePhone,
};
