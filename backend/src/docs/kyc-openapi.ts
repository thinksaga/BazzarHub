/**
 * KYC API OpenAPI Documentation
 * Comprehensive API specification for vendor onboarding and KYC verification
 */

export const kycOpenAPISpec = {
  openapi: '3.0.0',
  info: {
    title: 'Vendor KYC API',
    description: 'Secure vendor onboarding and KYC verification system for BazaarHub marketplace',
    version: '1.0.0',
    contact: {
      name: 'BazaarHub Support',
      email: 'support@bazaarhub.com',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: 'https://api.bazaarhub.com/v1',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3000/v1',
      description: 'Development server',
    },
  ],
  tags: [
    {
      name: 'Vendor Registration',
      description: 'Vendor account creation and email verification',
    },
    {
      name: 'KYC Submission',
      description: 'KYC document upload and verification',
    },
    {
      name: 'Admin KYC',
      description: 'Admin KYC review and approval workflows',
    },
  ],
  paths: {
    '/vendor/request-phone-otp': {
      post: {
        tags: ['Vendor Registration'],
        summary: 'Request OTP for phone verification',
        description: 'Send OTP to vendor phone number for verification during registration',
        operationId: 'requestPhoneOTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  phone: {
                    type: 'string',
                    pattern: '^[0-9]{10}$',
                    example: '9876543210',
                    description: '10-digit mobile number',
                  },
                },
                required: ['phone'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'OTP sent successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'OTP sent to your phone' },
                    otp: {
                      type: 'string',
                      example: '123456',
                      description: 'OTP (dev only, not sent in production)',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid phone format',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Invalid phone number format',
                    },
                  },
                },
              },
            },
          },
          '429': {
            description: 'Too many OTP requests',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string', example: 'Too many requests' },
                    retryAfter: { type: 'number', example: 300 },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/vendor/register': {
      post: {
        tags: ['Vendor Registration'],
        summary: 'Register new vendor account',
        description: 'Create vendor account with validation, rate limiting, and email verification',
        operationId: 'registerVendor',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  business_name: {
                    type: 'string',
                    minLength: 3,
                    maxLength: 255,
                    example: 'Tech Solutions India',
                  },
                  business_type: {
                    type: 'string',
                    enum: ['individual', 'company'],
                    example: 'company',
                  },
                  email: {
                    type: 'string',
                    format: 'email',
                    example: 'vendor@techsolutions.in',
                  },
                  phone: {
                    type: 'string',
                    pattern: '^[0-9]{10}$',
                    example: '9876543210',
                  },
                  phone_otp: {
                    type: 'string',
                    length: 6,
                    example: '123456',
                  },
                  password: {
                    type: 'string',
                    minLength: 12,
                    example: 'SecurePass@123456',
                    description: 'Must contain: uppercase, lowercase, digit, special char',
                  },
                  confirm_password: {
                    type: 'string',
                    example: 'SecurePass@123456',
                  },
                  primary_contact_name: {
                    type: 'string',
                    minLength: 2,
                    example: 'John Doe',
                  },
                  primary_contact_phone: {
                    type: 'string',
                    pattern: '^[0-9]{10}$',
                    example: '9876543210',
                  },
                  business_address: {
                    type: 'string',
                    minLength: 10,
                    example: '123 Tech Street, Bangalore',
                  },
                  city: { type: 'string', example: 'Bangalore' },
                  state: { type: 'string', example: 'Karnataka' },
                  pincode: {
                    type: 'string',
                    pattern: '^[0-9]{6}$',
                    example: '560001',
                  },
                  country: { type: 'string', default: 'India' },
                  website: {
                    type: 'string',
                    format: 'uri',
                    example: 'https://techsolutions.in',
                  },
                  gst_number: {
                    type: 'string',
                    example: '18AABCU9603R1Z0',
                  },
                },
                required: [
                  'business_name',
                  'business_type',
                  'email',
                  'phone',
                  'phone_otp',
                  'password',
                  'confirm_password',
                  'primary_contact_name',
                  'primary_contact_phone',
                  'business_address',
                  'city',
                  'state',
                  'pincode',
                ],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Vendor account created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string' },
                    vendor_id: { type: 'string', example: 'vendor_abc123' },
                    next_step: {
                      type: 'string',
                      example: 'email_verification',
                      enum: ['email_verification', 'kyc_submission'],
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    errors: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          field: { type: 'string' },
                          message: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '409': {
            description: 'Email already registered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string', example: 'Email already registered' },
                  },
                },
              },
            },
          },
          '429': {
            description: 'Rate limited (3 attempts per hour)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    retryAfter: { type: 'number', description: 'Seconds until retry' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/vendor/verify-email': {
      post: {
        tags: ['Vendor Registration'],
        summary: 'Verify vendor email',
        description: 'Verify email with JWT token sent to vendor email',
        operationId: 'verifyEmail',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: {
                    type: 'string',
                    description: 'JWT verification token from email',
                  },
                },
                required: ['token'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Email verified successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    vendor_id: { type: 'string' },
                    next_step: { type: 'string', example: 'kyc_submission' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Invalid or expired token',
          },
          '404': {
            description: 'Vendor account not found',
          },
        },
      },
    },

    '/admin/kyc/pending': {
      get: {
        tags: ['Admin KYC'],
        summary: 'List pending KYC submissions',
        description: 'Get all pending KYC submissions for admin review (requires kyc_admin role)',
        operationId: 'listPendingKYC',
        security: [{ adminAuth: ['kyc_admin', 'super_admin'] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 },
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 },
          },
        ],
        responses: {
          '200': {
            description: 'List of pending KYC submissions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    pending_count: { type: 'number' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          vendor_id: { type: 'string' },
                          submission_id: { type: 'string' },
                          timestamp: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        offset: { type: 'number' },
                        limit: { type: 'number' },
                        total: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
          },
        },
      },
    },

    '/admin/kyc/{vendor_id}': {
      get: {
        tags: ['Admin KYC'],
        summary: 'View KYC documents',
        description: 'Get KYC details and documents for a vendor (with decryption)',
        operationId: 'getVendorKYC',
        security: [{ adminAuth: ['kyc_admin', 'super_admin'] }],
        parameters: [
          {
            name: 'vendor_id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^vendor_' },
          },
        ],
        responses: {
          '200': {
            description: 'KYC data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    kyc: {
                      type: 'object',
                      properties: {
                        vendor_id: { type: 'string' },
                        verification_status: {
                          type: 'string',
                          enum: ['pending', 'verified', 'rejected', 'pending_correction'],
                        },
                        aadhaar_masked: {
                          type: 'string',
                          example: 'XXXX-XXXX-1234',
                        },
                        gstin: { type: 'string' },
                        documents: {
                          type: 'object',
                          additionalProperties: {
                            type: 'string',
                            format: 'uri',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions or audit trail recorded',
          },
          '404': {
            description: 'KYC not found',
          },
        },
      },
    },

    '/admin/kyc/{vendor_id}/approve': {
      post: {
        tags: ['Admin KYC'],
        summary: 'Approve KYC',
        description: 'Approve vendor KYC and create Razorpay linked account',
        operationId: 'approveKYC',
        security: [{ adminAuth: ['kyc_admin', 'super_admin'] }],
        parameters: [
          {
            name: 'vendor_id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  notes: {
                    type: 'string',
                    example: 'All documents verified',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'KYC approved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    vendor_id: { type: 'string' },
                    status: { type: 'string', example: 'verified' },
                    razorpay_account_created: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'KYC already verified or invalid status',
          },
          '403': {
            description: 'Insufficient permissions',
          },
        },
      },
    },

    '/admin/kyc/{vendor_id}/reject': {
      post: {
        tags: ['Admin KYC'],
        summary: 'Reject KYC',
        description: 'Reject vendor KYC with reason and required corrections',
        operationId: 'rejectKYC',
        security: [{ adminAuth: ['kyc_admin', 'super_admin'] }],
        parameters: [
          {
            name: 'vendor_id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: {
                    type: 'string',
                    example: 'Incomplete documents',
                    description: 'Rejection reason',
                  },
                  corrections_required: {
                    type: 'array',
                    items: { type: 'string' },
                    example: [
                      'Clear PAN front and back',
                      'Updated bank passbook',
                    ],
                  },
                },
                required: ['reason'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'KYC rejected',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    status: { type: 'string', example: 'pending_correction' },
                    rejection_reason: { type: 'string' },
                  },
                },
              },
            },
          },
          '403': {
            description: 'Insufficient permissions',
          },
        },
      },
    },
  },

  components: {
    securitySchemes: {
      vendorAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-vendor-id',
        description: 'Vendor ID from session/JWT',
      },
      adminAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-admin-role',
        description: 'Admin role (kyc_admin, super_admin, etc)',
      },
    },
  },
};

export default kycOpenAPISpec;
