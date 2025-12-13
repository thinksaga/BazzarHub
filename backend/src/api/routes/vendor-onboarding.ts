/**
 * Vendor Onboarding Routes
 * Handles secure vendor registration, KYC submission, and account setup
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';

const router = Router();

// Mock implementations
const bcryptMock = {
  hash: async (password: string, cost: number) => `hashed_${password}`,
};

const jwtMock = {
  sign: (payload: any, secret: string, opts?: any) => `token_${JSON.stringify(payload)}`,
  verify: (token: string, secret: string) => {
    try {
      const jsonStr = token.replace('token_', '');
      return JSON.parse(jsonStr);
    } catch {
      throw new Error('Invalid token');
    }
  },
};

const redisClientMock = {
  get: async (key: string) => null,
  setEx: async (key: string, ttl: number, value: string) => {},
  del: async (key: string) => {},
};

// Rate limiting storage
const registrationAttempts: Map<string, { count: number; timestamp: number }> = new Map();

/**
 * Custom validation helper
 */
function validateRegistration(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!data.business_name || data.business_name.length < 3) errors.push('Business name is required (min 3 chars)');
  if (!['individual', 'company'].includes(data.business_type)) errors.push('Invalid business type');
  if (!data.email || !data.email.match(/@/)) errors.push('Valid email is required');
  if (!data.phone || !/^\d{10}$/.test(data.phone)) errors.push('Valid 10-digit phone is required');
  if (!data.phone_otp || data.phone_otp.length !== 6) errors.push('OTP must be 6 digits');
  if (!data.password || data.password.length < 12) errors.push('Password must be at least 12 chars');
  if (!/(?=.*[a-z])/.test(data.password)) errors.push('Password must contain lowercase');
  if (!/(?=.*[A-Z])/.test(data.password)) errors.push('Password must contain uppercase');
  if (!/(?=.*\d)/.test(data.password)) errors.push('Password must contain digits');
  if (!/(?=.*[@$!%*?&])/.test(data.password)) errors.push('Password must contain special characters');
  if (data.password !== data.confirm_password) errors.push('Passwords do not match');
  if (!data.primary_contact_name || data.primary_contact_name.length < 2) errors.push('Contact name required');
  if (!data.business_address || data.business_address.length < 10) errors.push('Business address required');
  if (!data.pincode || !/^\d{6}$/.test(data.pincode)) errors.push('Valid 6-digit pincode required');

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Rate limiting middleware
 */
const applyRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const maxAttempts = 3;

  const attempts = registrationAttempts.get(ip);

  if (attempts && now - attempts.timestamp < window) {
    attempts.count++;

    if (attempts.count > maxAttempts) {
      res.status(429).json({
        error: 'Too many registration attempts',
        retryAfter: Math.ceil((window - (now - attempts.timestamp)) / 1000),
      });
      return;
    }
  } else {
    registrationAttempts.set(ip, { count: 1, timestamp: now });
  }

  // Clean up old entries
  for (const [key, value] of registrationAttempts.entries()) {
    if (now - value.timestamp > window) {
      registrationAttempts.delete(key);
    }
  }

  next();
};

/**
 * POST /vendor/register
 * Create new vendor account with email verification
 */
router.post('/register', applyRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const validation = validateRegistration(req.body);

    if (!validation.valid) {
      res.status(400).json({
        errors: validation.errors,
      });
      return;
    }

    const data = req.body;

    // Check email uniqueness
    const existingEmail = await redisClientMock.get(`vendor:email:${data.email}`);
    if (existingEmail) {
      res.status(409).json({
        error: 'Email already registered',
      });
      return;
    }

    // Verify phone OTP
    const phoneOTPKey = `phone_otp:${data.phone}`;
    const storedOTP = await redisClientMock.get(phoneOTPKey);

    if (!storedOTP || storedOTP !== data.phone_otp) {
      res.status(400).json({
        error: 'Invalid phone OTP',
      });
      return;
    }

    // Create vendor account
    const vendor_id = `vendor_${uuid()}`;
    const hashedPassword = await bcryptMock.hash(data.password, 12);

    const vendorData = {
      vendor_id,
      business_name: data.business_name,
      business_type: data.business_type,
      email: data.email,
      phone: data.phone,
      primary_contact_name: data.primary_contact_name,
      primary_contact_phone: data.primary_contact_phone,
      business_address: data.business_address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      country: data.country || 'India',
      password_hash: hashedPassword,
      status: 'pending_verification',
      created_at: new Date().toISOString(),
      ip_address: req.ip,
    };

    // Store vendor account
    await redisClientMock.setEx(
      `vendor:${vendor_id}`,
      30 * 24 * 60 * 60,
      JSON.stringify(vendorData)
    );

    // Store email index for uniqueness check
    await redisClientMock.setEx(
      `vendor:email:${data.email}`,
      30 * 24 * 60 * 60,
      vendor_id
    );

    // Generate verification token
    const verificationToken = jwtMock.sign(
      { vendor_id, email: data.email },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '24h' }
    );

    // Store token
    await redisClientMock.setEx(
      `vendor:verification_token:${vendor_id}`,
      24 * 60 * 60,
      verificationToken
    );

    const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/vendor/verify-email?token=${verificationToken}`;

    console.log('[VENDOR] Verification email sent', {
      vendor_id,
      email: data.email,
      verification_link: verificationLink,
    });

    console.log('[AUDIT] Vendor registration created', {
      vendor_id,
      email: data.email,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    // Clear phone OTP
    await redisClientMock.del(phoneOTPKey);

    res.status(201).json({
      success: true,
      message: 'Vendor account created. Please check your email to verify your account.',
      vendor_id,
      next_step: 'email_verification',
    });
  } catch (error) {
    console.error('[VENDOR] Registration failed', error);
    res.status(500).json({
      error: 'Registration failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /vendor/verify-email
 * Verify vendor email with JWT token
 */
router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Verification token is required' });
      return;
    }

    try {
      const decoded = jwtMock.verify(token, process.env.JWT_SECRET || 'secret-key') as { vendor_id: string; email: string };
      const vendor_id = decoded.vendor_id;

      // Get vendor account
      const vendorJson = await redisClientMock.get(`vendor:${vendor_id}`);
      if (!vendorJson) {
        res.status(404).json({ error: 'Vendor account not found' });
        return;
      }

      const vendorData = JSON.parse(vendorJson);

      // Update verification status
      vendorData.status = 'email_verified';
      vendorData.email_verified_at = new Date().toISOString();

      await redisClientMock.setEx(
        `vendor:${vendor_id}`,
        30 * 24 * 60 * 60,
        JSON.stringify(vendorData)
      );

      // Clear verification token
      await redisClientMock.del(`vendor:verification_token:${vendor_id}`);

      console.log('[AUDIT] Email verified', {
        vendor_id,
        email: vendorData.email,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: 'Email verified successfully. You can now submit KYC documents.',
        vendor_id,
        next_step: 'kyc_submission',
      });
    } catch (error) {
      res.status(401).json({
        error: 'Invalid or expired verification token',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    console.error('[VENDOR] Email verification failed', error);
    res.status(500).json({
      error: 'Email verification failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /vendor/request-phone-otp
 * Request OTP for phone verification
 */
router.post('/request-phone-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      res.status(400).json({ error: 'Invalid phone number format' });
      return;
    }

    // Generate OTP (mock - in production, send via SMS)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 10-minute expiry
    await redisClientMock.setEx(`phone_otp:${phone}`, 10 * 60, otp);

    console.log('[OTP] Phone OTP generated', {
      phone: phone.slice(-4),
      otp,
    });

    res.json({
      success: true,
      message: 'OTP sent to your phone',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined, // Return OTP only in dev
    });
  } catch (error) {
    console.error('[VENDOR] OTP request failed', error);
    res.status(500).json({
      error: 'OTP request failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /vendor/resend-verification-email
 * Resend verification email
 */
router.post('/resend-verification-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Find vendor by email
    const vendor_id = await redisClientMock.get(`vendor:email:${email}`);
    if (!vendor_id) {
      // Don't reveal if email exists
      res.json({
        success: true,
        message: 'If the email is registered, you will receive a verification link shortly.',
      });
      return;
    }

    // Get vendor data
    const vendorJson = await redisClientMock.get(`vendor:${vendor_id}`);
    if (!vendorJson) {
      res.json({
        success: true,
        message: 'If the email is registered, you will receive a verification link shortly.',
      });
      return;
    }

    const vendorData = JSON.parse(vendorJson);

    // Check if already verified
    if (vendorData.status === 'email_verified') {
      res.status(400).json({
        error: 'Email already verified',
      });
      return;
    }

    // Generate new token
    const verificationToken = jwtMock.sign(
      { vendor_id, email },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '24h' }
    );

    await redisClientMock.setEx(
      `vendor:verification_token:${vendor_id}`,
      24 * 60 * 60,
      verificationToken
    );

    console.log('[VENDOR] Verification email resent', { vendor_id, email });

    res.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (error) {
    console.error('[VENDOR] Resend verification failed', error);
    res.status(500).json({
      error: 'Failed to resend verification email',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
