/**
 * Vendor Onboarding Routes
 * Handles secure vendor registration, KYC submission, and account setup
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../../config/database.config';
import { User, UserRole } from '../../models/user.entity';
import { VendorAccount, VendorAccountStatus, AccountType } from '../../models/vendor-account.model';
import GSTService from '../../services/gst.service';
import { RouteService } from '../../services/payment/route.service';
import RedisService from '../../services/redis';

const router = Router();
const redisService = new RedisService();
const gstService = GSTService.getInstance();
const routeService = RouteService.getInstance();

// Rate limiting storage (using Redis in production, but Map for now is fine for simple rate limiting if Redis fails)
const registrationAttempts: Map<string, { count: number; timestamp: number }> = new Map();

/**
 * Custom validation helper
 */
function validateRegistration(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!data.business_name || data.business_name.length < 3) errors.push('Business name is required (min 3 chars)');
  if (!['individual', 'company', 'partnership', 'llp'].includes(data.business_type)) errors.push('Invalid business type');
  if (!data.email || !data.email.match(/@/)) errors.push('Valid email is required');
  if (!data.phone || !/^\d{10}$/.test(data.phone)) errors.push('Valid 10-digit phone is required');
  if (!data.password || data.password.length < 8) errors.push('Password must be at least 8 chars');
  
  // Bank Details
  if (!data.bank_account_number) errors.push('Bank account number is required');
  if (!data.bank_ifsc) errors.push('IFSC code is required');
  if (!data.bank_account_holder_name) errors.push('Account holder name is required');

  // Tax Details
  if (!data.pan) errors.push('PAN is required');
  // GSTIN is optional for some small vendors, but we'll enforce it if provided
  if (data.gstin && data.gstin.length !== 15) errors.push('GSTIN must be 15 characters');

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
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Validate Input
    const validation = validateRegistration(req.body);
    if (!validation.valid) {
      res.status(400).json({ errors: validation.errors });
      return;
    }

    const data = req.body;

    // 2. Check if Email exists
    const userRepository = AppDataSource.getRepository(User);
    const existingUser = await userRepository.findOne({ where: { email: data.email } });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // 3. Validate GSTIN (if provided)
    if (data.gstin) {
      const gstValidation = gstService.validateGSTIN(data.gstin);
      if (!gstValidation.valid) {
        res.status(400).json({ error: `Invalid GSTIN: ${gstValidation.error}` });
        return;
      }
    }

    // 4. Create Razorpay Linked Account (Route)
    let linkedAccount;
    try {
      linkedAccount = await routeService.createLinkedAccount({
        vendor_id: '', // Will be set after user creation
        email: data.email,
        phone: data.phone,
        bank_account_number: data.bank_account_number,
        bank_ifsc: data.bank_ifsc,
        bank_account_holder_name: data.bank_account_holder_name,
        business_name: data.business_name,
        business_type: data.business_type,
        pan: data.pan,
        gstin: data.gstin
      });
    } catch (error: any) {
      console.error('Razorpay Account Creation Failed:', error);
      // Proceeding without Razorpay account for dev/test if credentials missing
    }

    // 5. Create User Entity
    const hashedPassword = await bcrypt.hash(data.password, 12);
    const newUser = new User();
    newUser.email = data.email;
    newUser.password = hashedPassword;
    newUser.firstName = data.primary_contact_name.split(' ')[0];
    newUser.lastName = data.primary_contact_name.split(' ').slice(1).join(' ') || '';
    newUser.role = UserRole.VENDOR;
    newUser.phone = data.phone;
    
    const savedUser = await queryRunner.manager.save(newUser);

    // 6. Create VendorAccount Entity
    const newVendorAccount = new VendorAccount();
    newVendorAccount.vendor_id = savedUser.id; // Link to User ID
    newVendorAccount.account_number = data.bank_account_number;
    newVendorAccount.ifsc_code = data.bank_ifsc;
    newVendorAccount.account_holder_name = data.bank_account_holder_name;
    newVendorAccount.account_type = AccountType.SAVINGS; // Default
    newVendorAccount.pan = data.pan;
    newVendorAccount.gstin = data.gstin;
    newVendorAccount.business_name = data.business_name;
    newVendorAccount.business_type = data.business_type;
    newVendorAccount.business_address = data.business_address;
    newVendorAccount.contact_phone = data.phone;
    newVendorAccount.contact_email = data.email;
    newVendorAccount.status = VendorAccountStatus.PENDING;
    
    if (linkedAccount) {
      newVendorAccount.razorpay_account_id = linkedAccount.razorpay_account_id;
      newVendorAccount.razorpay_fund_account_id = linkedAccount.razorpay_fund_account_id;
    }

    await queryRunner.manager.save(newVendorAccount);

    // 7. Commit Transaction
    await queryRunner.commitTransaction();

    // 8. Generate Verification Token
    const verificationToken = jwt.sign(
      { userId: savedUser.id, email: savedUser.email },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '24h' }
    );

    // Store token in Redis
    const redis = redisService.getClient();
    await redis.set(`vendor:verification:${savedUser.id}`, verificationToken, 'EX', 86400);

    console.log(`[VENDOR] Registered: ${savedUser.email} (${savedUser.id})`);

    res.status(201).json({
      success: true,
      message: 'Vendor registration successful. Please verify your email.',
      vendor_id: savedUser.id,
      verification_token: verificationToken // In real app, send via email
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('[VENDOR] Registration Error:', error);
    res.status(500).json({
      error: 'Registration failed',
      details: error.message
    });
  } finally {
    await queryRunner.release();
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key') as { userId: string; email: string };
      const userId = decoded.userId;

      // Verify token against Redis (to ensure it hasn't been used/expired)
      const redis = redisService.getClient();
      const storedToken = await redis.get(`vendor:verification:${userId}`);

      if (!storedToken || storedToken !== token) {
        res.status(401).json({ error: 'Invalid or expired verification token' });
        return;
      }

      // Update Vendor Account Status
      const vendorAccountRepo = AppDataSource.getRepository(VendorAccount);
      const vendorAccount = await vendorAccountRepo.findOne({ where: { vendor_id: userId } });

      if (!vendorAccount) {
        res.status(404).json({ error: 'Vendor account not found' });
        return;
      }

      // Update status to UNDER_REVIEW (Email Verified)
      vendorAccount.status = VendorAccountStatus.UNDER_REVIEW;
      await vendorAccountRepo.save(vendorAccount);

      // Clear verification token
      await redis.del(`vendor:verification:${userId}`);

      console.log(`[AUDIT] Email verified for vendor: ${userId}`);

      res.json({
        success: true,
        message: 'Email verified successfully. You can now submit KYC documents.',
        vendor_id: userId,
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
    const redis = redisService.getClient();
    await redis.set(`phone_otp:${phone}`, otp, 'EX', 600);

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

    // Find user by email
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if email exists
      res.json({
        success: true,
        message: 'If the email is registered, you will receive a verification link shortly.',
      });
      return;
    }

    // Check if already verified (VendorAccount status)
    const vendorAccountRepo = AppDataSource.getRepository(VendorAccount);
    const vendorAccount = await vendorAccountRepo.findOne({ where: { vendor_id: user.id } });

    if (vendorAccount && vendorAccount.status !== VendorAccountStatus.PENDING) {
      res.status(400).json({ error: 'Email already verified' });
      return;
    }

    // Generate new token
    const verificationToken = jwt.sign(
      { userId: user.id, email },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '24h' }
    );

    const redis = redisService.getClient();
    await redis.set(`vendor:verification:${user.id}`, verificationToken, 'EX', 86400);

    console.log('[VENDOR] Verification email resent', { userId: user.id, email });

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
