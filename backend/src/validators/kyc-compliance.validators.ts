/**
 * KYC Compliance Validation Schemas
 * Validation rules and helpers for KYC verification process
 */

/**
 * PAN Validation Rules
 */
export const panValidationRules = {
  format: {
    required: true,
    pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
    description: 'PAN format: 5 letters + 4 digits + 1 letter',
  },
  length: {
    exact: 10,
  },
  structure: {
    position_0_4: 'Alphabets (5 chars)',
    position_5_8: 'Numerals (4 chars)',
    position_9: 'Alphabet (1 char)',
  },
};

/**
 * Aadhaar Validation Rules
 * Store only last 4 digits for compliance
 */
export const aadhaarValidationRules = {
  format: {
    required: true,
    pattern: '^\\d{12}$',
    description: '12-digit Aadhaar number',
  },
  storage: {
    masked_format: 'XXXX-XXXX-LAST4',
    example: 'XXXX-XXXX-1234',
    note: 'Store only last 4 digits for GDPR compliance',
  },
  privacy: {
    encryption: 'AES-256-CBC',
    retention_period: '365 days',
    deletion_on_request: true,
  },
};

/**
 * GSTIN Validation Rules
 */
export const gstinValidationRules = {
  format: {
    required: false,
    pattern: '^\\d{2}[A-Z]{5}\\d{4}[A-Z]\\d[A-Z]Z\\d$',
    length: 15,
    description: '15-character GSTIN format',
  },
  structure: {
    position_0_1: 'State Code (01-37)',
    position_2_6: 'PAN (5 letters)',
    position_7_10: 'Entity Number (4 digits)',
    position_11: 'Check Digit (1 letter)',
    position_12: 'Registration Type (1 digit)',
    position_13: 'Amendment Number (1 letter)',
    position_14: 'Checksum (1 digit)',
  },
};

/**
 * Bank Account Validation Rules
 */
export const bankAccountValidationRules = {
  account_number: {
    required: true,
    pattern: '^\\d{9,18}$',
    description: 'Bank account number (9-18 digits)',
  },
  account_type: {
    enum: ['savings', 'current', 'overdraft'],
    required: true,
  },
  ifsc_code: {
    required: true,
    pattern: '^[A-Z]{4}0[A-Z0-9]{6}$',
    description: 'IFSC code format (11 characters)',
  },
  micr_code: {
    optional: true,
    pattern: '^\\d{9}$',
    description: 'MICR code (9 digits)',
  },
  encryption: {
    method: 'AES-256-CBC',
    note: 'Encrypt account number at rest',
  },
};

/**
 * GST Certificate Validation Rules
 */
export const gstCertificateValidationRules = {
  gstin: {
    required: true,
    validation: 'Must match vendor GSTIN',
  },
  registration_date: {
    required: true,
    format: 'YYYY-MM-DD',
  },
  status: {
    required: true,
    enum: ['Active', 'Inactive', 'Cancelled', 'Suspended'],
  },
  file_format: {
    allowed: ['pdf', 'jpg', 'jpeg', 'png'],
    max_size: '5MB',
  },
};

/**
 * Business Registration Validation Rules
 */
export const businessRegistrationRules = {
  registration_type: {
    enum: [
      'shop_act_certificate',
      'gst_certificate',
      'llp_agreement',
      'moa_aoa',
      'din_certificate',
      'incorporation_certificate',
      'trade_license',
    ],
    required: true,
  },
  registration_number: {
    required: true,
    min_length: 3,
    max_length: 50,
  },
  registration_date: {
    required: true,
    format: 'YYYY-MM-DD',
  },
  file_format: {
    allowed: ['pdf', 'jpg', 'jpeg', 'png'],
    max_size: '5MB',
  },
};

/**
 * KYC Document Upload Rules
 */
export const kycDocumentRules = {
  document_types: {
    pan: {
      required: true,
      file_formats: ['pdf', 'jpg', 'jpeg', 'png'],
      max_size: '5MB',
      description: 'PAN Card (front and back)',
    },
    aadhaar: {
      required: true,
      file_formats: ['pdf', 'jpg', 'jpeg', 'png'],
      max_size: '5MB',
      description: 'Aadhaar (front and back)',
      note: 'Only last 4 digits will be stored',
    },
    gstin: {
      required: false,
      file_formats: ['pdf', 'jpg', 'jpeg', 'png'],
      max_size: '5MB',
      description: 'GSTIN Certificate',
      conditional: 'Required if business type is company',
    },
    bank_proof: {
      required: true,
      file_formats: ['pdf', 'jpg', 'jpeg', 'png'],
      max_size: '5MB',
      description: 'Bank Account Proof (passbook or cancelled cheque)',
    },
    business_registration: {
      required: true,
      file_formats: ['pdf', 'jpg', 'jpeg', 'png'],
      max_size: '5MB',
      description: 'Business Registration or Shop Act Certificate',
    },
  },
  virus_scanning: {
    enabled: true,
    scanner: 'ClamAV',
    timeout: '30 seconds',
  },
  s3_encryption: {
    enabled: true,
    method: 'AES-256',
    signed_urls_expiry: '1 hour',
  },
};

/**
 * KYC Submission Validation Rules
 */
export const kycSubmissionRules = {
  vendor_id: {
    required: true,
    pattern: '^vendor_[a-zA-Z0-9]+$',
  },
  documents: {
    required: true,
    min_count: 4,
    max_count: 5,
  },
  ip_address: {
    capture: true,
    note: 'Capture IP for fraud detection',
  },
  user_agent: {
    capture: true,
    note: 'Capture user agent for device fingerprinting',
  },
};

/**
 * KYC Approval Rules
 */
export const kycApprovalRules = {
  verification_status: {
    enum: ['verified', 'rejected', 'pending_correction'],
  },
  approver_role: {
    required: 'kyc_admin',
    minimum_permissions: ['kyc_review', 'kyc_approve'],
  },
  razorpay_linking: {
    enabled: true,
    trigger_status: 'verified',
    create_linked_account: true,
  },
  audit_trail: {
    log_approvals: true,
    log_rejections: true,
    retention: '7 years',
  },
};

/**
 * Compliance Error Codes
 */
export const complianceErrorCodes = {
  // PAN Errors
  PAN_INVALID_FORMAT: {
    code: 'PAN_001',
    message: 'Invalid PAN format',
    httpStatus: 400,
  },
  PAN_CHECKSUM_INVALID: {
    code: 'PAN_002',
    message: 'PAN checksum validation failed',
    httpStatus: 400,
  },

  // Aadhaar Errors
  AADHAAR_INVALID_FORMAT: {
    code: 'AAD_001',
    message: 'Invalid Aadhaar format',
    httpStatus: 400,
  },
  AADHAAR_EXTRACTION_FAILED: {
    code: 'AAD_002',
    message: 'Failed to extract Aadhaar from document',
    httpStatus: 400,
  },

  // GSTIN Errors
  GSTIN_INVALID_FORMAT: {
    code: 'GST_001',
    message: 'Invalid GSTIN format',
    httpStatus: 400,
  },
  GSTIN_MISMATCH_PAN: {
    code: 'GST_002',
    message: 'GSTIN PAN does not match vendor PAN',
    httpStatus: 400,
  },
  GSTIN_API_VERIFICATION_FAILED: {
    code: 'GST_003',
    message: 'GSTIN verification with GST portal failed',
    httpStatus: 400,
  },

  // Bank Account Errors
  BANK_ACCOUNT_INVALID_FORMAT: {
    code: 'BANK_001',
    message: 'Invalid bank account number format',
    httpStatus: 400,
  },
  IFSC_INVALID_FORMAT: {
    code: 'BANK_002',
    message: 'Invalid IFSC code format',
    httpStatus: 400,
  },

  // Document Errors
  DOCUMENT_INVALID_FORMAT: {
    code: 'DOC_001',
    message: 'Document format not allowed',
    httpStatus: 400,
  },
  DOCUMENT_SIZE_EXCEEDED: {
    code: 'DOC_002',
    message: 'Document size exceeds 5MB limit',
    httpStatus: 400,
  },
  DOCUMENT_VIRUS_DETECTED: {
    code: 'DOC_003',
    message: 'Virus detected in uploaded document',
    httpStatus: 400,
  },
  DOCUMENT_S3_UPLOAD_FAILED: {
    code: 'DOC_004',
    message: 'Failed to upload document to storage',
    httpStatus: 500,
  },

  // Submission Errors
  KYC_SUBMISSION_INCOMPLETE: {
    code: 'KYC_001',
    message: 'KYC submission incomplete - missing required documents',
    httpStatus: 400,
  },
  KYC_DUPLICATE_SUBMISSION: {
    code: 'KYC_002',
    message: 'KYC already submitted for this vendor',
    httpStatus: 409,
  },
  KYC_SUBMISSION_FAILED: {
    code: 'KYC_003',
    message: 'KYC submission processing failed',
    httpStatus: 500,
  },

  // Verification Errors
  KYC_NOT_FOUND: {
    code: 'KYC_004',
    message: 'KYC record not found',
    httpStatus: 404,
  },
  KYC_VERIFICATION_PENDING: {
    code: 'KYC_005',
    message: 'KYC verification pending',
    httpStatus: 403,
  },
  KYC_VERIFICATION_REJECTED: {
    code: 'KYC_006',
    message: 'KYC verification rejected',
    httpStatus: 403,
  },

  // Admin Errors
  ADMIN_INSUFFICIENT_PERMISSIONS: {
    code: 'ADMIN_001',
    message: 'Insufficient permissions to perform this action',
    httpStatus: 403,
  },
  ADMIN_INVALID_ACTION: {
    code: 'ADMIN_002',
    message: 'Invalid KYC action',
    httpStatus: 400,
  },
};

/**
 * Validation Helpers
 */

export function validatePAN(pan: string): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!pan) {
    errors.push('PAN is required');
  } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    errors.push('Invalid PAN format (expected: 5 letters + 4 digits + 1 letter)');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export function validateAadhaar(aadhaar: string): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!aadhaar) {
    errors.push('Aadhaar is required');
  } else if (!/^\d{12}$/.test(aadhaar.replace(/[\s\-]/g, ''))) {
    errors.push('Invalid Aadhaar format (expected: 12 digits)');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export function validateGSTIN(gstin: string): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!gstin) {
    errors.push('GSTIN is required');
  } else if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]Z\d$/.test(gstin)) {
    errors.push('Invalid GSTIN format (expected: 15 characters)');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export function validateBankAccount(account: string): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!account) {
    errors.push('Bank account is required');
  } else if (!/^\d{9,18}$/.test(account.replace(/[\s\-]/g, ''))) {
    errors.push('Invalid bank account format (expected: 9-18 digits)');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export function validateIFSC(ifsc: string): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!ifsc) {
    errors.push('IFSC code is required');
  } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    errors.push('Invalid IFSC code format (expected: AAAA0XXXXXX)');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export function validateDocumentFormat(filename: string, filesize: number): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  const allowedFormats = ['pdf', 'jpg', 'jpeg', 'png'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext || !allowedFormats.includes(ext)) {
    errors.push(`Invalid file format: ${ext}. Allowed: ${allowedFormats.join(', ')}`);
  }

  if (filesize > maxSize) {
    errors.push(`File size exceeds 5MB limit: ${(filesize / 1024 / 1024).toFixed(2)}MB`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export default {
  panValidationRules,
  aadhaarValidationRules,
  gstinValidationRules,
  bankAccountValidationRules,
  gstCertificateValidationRules,
  businessRegistrationRules,
  kycDocumentRules,
  kycSubmissionRules,
  kycApprovalRules,
  complianceErrorCodes,
  validatePAN,
  validateAadhaar,
  validateGSTIN,
  validateBankAccount,
  validateIFSC,
  validateDocumentFormat,
};
