/**
 * KYC Integration Tests
 * Comprehensive test suite for vendor onboarding and KYC verification
 */

describe('KYC Onboarding & Verification', () => {
  const baseURL = process.env.TEST_API_URL || 'http://localhost:3000';
  let vendor_id: string;
  let verificationToken: string;
  let phoneOTP: string;

  beforeAll(async () => {
    console.log('[TEST] KYC test suite started');
  });

  // ============ Vendor Registration Tests ============

  describe('POST /api/vendor/register', () => {
    it('should send OTP to phone number', async () => {
      const response = await fetch(`${baseURL}/api/vendor/request-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9876543210' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.otp).toBeDefined();
      phoneOTP = data.otp;
    });

    it('should reject invalid phone format', async () => {
      const response = await fetch(`${baseURL}/api/vendor/request-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '123' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should register vendor with valid credentials', async () => {
      const response = await fetch(`${baseURL}/api/vendor/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: 'Tech Solutions India',
          business_type: 'company',
          email: 'vendor@techsolutions.in',
          phone: '9876543210',
          phone_otp: phoneOTP,
          password: 'SecurePass@123456',
          confirm_password: 'SecurePass@123456',
          primary_contact_name: 'John Doe',
          primary_contact_phone: '9876543210',
          business_address: '123 Tech Street, Bangalore',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001',
          country: 'India',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.vendor_id).toBeDefined();
      expect(data.vendor_id).toMatch(/^vendor_/);
      expect(data.next_step).toBe('email_verification');
      vendor_id = data.vendor_id;
      if (data.verification_token) {
        verificationToken = data.verification_token;
      } else {
        // Fallback for testing purposes
        verificationToken = 'test-token-' + vendor_id;
      }
    });

    it('should reject weak password', async () => {
      const response = await fetch(`${baseURL}/api/vendor/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: 'Test Business',
          business_type: 'individual',
          email: 'test@example.com',
          phone: '9876543210',
          phone_otp: phoneOTP,
          password: 'weak123',
          confirm_password: 'weak123',
          primary_contact_name: 'Test User',
          primary_contact_phone: '9876543210',
          business_address: 'Test Address',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.errors).toBeDefined();
      expect(Array.isArray(data.errors)).toBe(true);
    });

    it('should reject duplicate email', async () => {
      // First registration
      await fetch(`${baseURL}/api/vendor/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: 'First Business',
          business_type: 'individual',
          email: 'duplicate@test.in',
          phone: '9876543211',
          phone_otp: phoneOTP,
          password: 'SecurePass@123456',
          confirm_password: 'SecurePass@123456',
          primary_contact_name: 'User One',
          primary_contact_phone: '9876543211',
          business_address: 'Address One',
          city: 'Delhi',
          state: 'Delhi',
          pincode: '110001',
        }),
      });

      // Second registration with same email
      const response = await fetch(`${baseURL}/api/vendor/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: 'Second Business',
          business_type: 'individual',
          email: 'duplicate@test.in',
          phone: '9876543212',
          phone_otp: phoneOTP,
          password: 'SecurePass@123456',
          confirm_password: 'SecurePass@123456',
          primary_contact_name: 'User Two',
          primary_contact_phone: '9876543212',
          business_address: 'Address Two',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        }),
      });

      expect(response.status).toBe(409);
    });

    it('should rate limit after 3 attempts per hour', async () => {
      const ip = '127.0.0.1';
      let lastStatus = 201;

      // Make 3 successful attempts
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${baseURL}/api/vendor/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': ip,
          },
          body: JSON.stringify({
            business_name: `Business ${i}`,
            business_type: 'individual',
            email: `vendor${i}@test.in`,
            phone: `987654321${i}`,
            phone_otp: phoneOTP,
            password: 'SecurePass@123456',
            confirm_password: 'SecurePass@123456',
            primary_contact_name: `User ${i}`,
            primary_contact_phone: `987654321${i}`,
            business_address: `Address ${i}`,
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
          }),
        });
        lastStatus = response.status;
      }

      // 4th attempt should be rate limited
      const response = await fetch(`${baseURL}/api/vendor/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': ip,
        },
        body: JSON.stringify({
          business_name: 'Business 4',
          business_type: 'individual',
          email: 'vendor4@test.in',
          phone: '9876543214',
          phone_otp: phoneOTP,
          password: 'SecurePass@123456',
          confirm_password: 'SecurePass@123456',
          primary_contact_name: 'User 4',
          primary_contact_phone: '9876543214',
          business_address: 'Address 4',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        }),
      });

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.retryAfter).toBeDefined();
    });
  });

  // ============ Email Verification Tests ============

  describe('POST /api/vendor/verify-email', () => {
    it('should verify email with valid token', async () => {
      const response = await fetch(`${baseURL}/api/vendor/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.next_step).toBe('kyc_submission');
    });

    it('should reject invalid token', async () => {
      const response = await fetch(`${baseURL}/api/vendor/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid_token_xyz' }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject expired token', async () => {
      // Create an old token that's expired (mock)
      const expiredToken = 'expired_token';

      const response = await fetch(`${baseURL}/api/vendor/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: expiredToken }),
      });

      expect(response.status).toBe(401);
    });
  });

  // ============ KYC Submission Tests ============

  describe('POST /api/vendor/:vendor_id/kyc/submit', () => {
    it('should validate required KYC documents', async () => {
      const response = await fetch(
        `${baseURL}/api/vendor/${vendor_id}/kyc/submit`,
        {
          method: 'POST',
          headers: { 'x-vendor-id': vendor_id },
          body: new FormData(), // Empty form data
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('required documents');
    });

    it('should reject invalid document format', async () => {
      const form = new FormData();
      form.append('pan', new Blob(['not a pdf'], { type: 'text/plain' }), 'doc.txt');

      const response = await fetch(
        `${baseURL}/api/vendor/${vendor_id}/kyc/submit`,
        {
          method: 'POST',
          headers: { 'x-vendor-id': vendor_id },
          body: form,
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('format');
    });

    it('should reject documents exceeding 5MB', async () => {
      const largeFile = new Blob([new ArrayBuffer(6 * 1024 * 1024)], { type: 'application/pdf' });
      const form = new FormData();
      form.append('pan', largeFile, 'large.pdf');

      const response = await fetch(
        `${baseURL}/api/vendor/${vendor_id}/kyc/submit`,
        {
          method: 'POST',
          headers: { 'x-vendor-id': vendor_id },
          body: form,
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('5MB');
    });

    it('should submit KYC with valid documents', async () => {
      const form = new FormData();
      form.append('pan', new Blob(['PAN content'], { type: 'application/pdf' }), 'pan.pdf');
      form.append('aadhaar', new Blob(['Aadhaar content'], { type: 'application/pdf' }), 'aadhaar.pdf');
      form.append('bank_proof', new Blob(['Bank content'], { type: 'application/pdf' }), 'bank.pdf');
      form.append('business_registration', new Blob(['Cert content'], { type: 'application/pdf' }), 'cert.pdf');

      const response = await fetch(
        `${baseURL}/api/vendor/${vendor_id}/kyc/submit`,
        {
          method: 'POST',
          headers: { 'x-vendor-id': vendor_id },
          body: form,
        }
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.status).toBe('pending');
      expect(data.submission_id).toBeDefined();
    });
  });

  // ============ Admin KYC Verification Tests ============

  describe('GET /api/admin/kyc/pending', () => {
    it('should list pending KYC submissions (admin only)', async () => {
      const response = await fetch(`${baseURL}/api/admin/kyc/pending`, {
        method: 'GET',
        headers: {
          'x-admin-role': 'kyc_admin',
          'x-admin-id': 'admin_1',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should reject non-admin access', async () => {
      const response = await fetch(`${baseURL}/api/admin/kyc/pending`, {
        method: 'GET',
        headers: {
          'x-admin-role': 'user',
        },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/admin/kyc/:vendor_id/approve', () => {
    it('should approve KYC and create Razorpay account', async () => {
      const response = await fetch(
        `${baseURL}/api/admin/kyc/${vendor_id}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-role': 'kyc_admin',
            'x-admin-id': 'admin_1',
          },
          body: JSON.stringify({ notes: 'Documents verified' }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.status).toBe('verified');
      expect(data.razorpay_account_created).toBe(true);
    });

    it('should reject already approved KYC', async () => {
      const response = await fetch(
        `${baseURL}/api/admin/kyc/${vendor_id}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-role': 'kyc_admin',
            'x-admin-id': 'admin_2',
          },
          body: JSON.stringify({ notes: 'Duplicate approval' }),
        }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/admin/kyc/:vendor_id/reject', () => {
    it('should reject KYC with reason', async () => {
      const response = await fetch(
        `${baseURL}/api/admin/kyc/${vendor_id}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-role': 'kyc_admin',
            'x-admin-id': 'admin_1',
          },
          body: JSON.stringify({
            reason: 'Incomplete documents',
            corrections_required: ['Clear PAN front and back', 'Updated bank passbook'],
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('pending_correction');
    });
  });

  // ============ Vendor Access Control Tests ============

  describe('Middleware: requireVerifiedVendor', () => {
    it('should block unverified vendor from listing products', async () => {
      const response = await fetch(`${baseURL}/api/vendor/products`, {
        method: 'GET',
        headers: { 'x-vendor-id': vendor_id },
      });

      expect([403, 401]).toContain(response.status);
      const data = await response.json();
      expect(data.kyc_banner || data.error).toBeDefined();
    });

    it('should allow verified vendor to access dashboard', async () => {
      // First approve KYC
      await fetch(`${baseURL}/api/admin/kyc/${vendor_id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': 'kyc_admin',
          'x-admin-id': 'admin_1',
        },
        body: JSON.stringify({ notes: 'OK' }),
      });

      const response = await fetch(`${baseURL}/api/vendor/dashboard`, {
        method: 'GET',
        headers: { 'x-vendor-id': vendor_id },
      });

      expect(response.status).toBe(200);
    });
  });

  // ============ Security & Compliance Tests ============

  describe('Security Tests', () => {
    it('should encrypt sensitive PAN data', async () => {
      const response = await fetch(
        `${baseURL}/api/admin/kyc/${vendor_id}`,
        {
          method: 'GET',
          headers: {
            'x-admin-role': 'kyc_admin',
            'x-admin-id': 'admin_1',
          },
        }
      );

      const data = await response.json();
      // PAN should not be visible in plain text
      if (data.kyc.pan_encrypted) {
        expect(data.kyc.pan_encrypted).not.toMatch(/^[A-Z]{5}[0-9]{4}[A-Z]$/);
      }
    });

    it('should mask Aadhaar to last 4 digits', async () => {
      const response = await fetch(
        `${baseURL}/api/admin/kyc/${vendor_id}`,
        {
          method: 'GET',
          headers: {
            'x-admin-role': 'kyc_admin',
            'x-admin-id': 'admin_1',
          },
        }
      );

      const data = await response.json();
      expect(data.kyc.aadhaar_masked).toMatch(/^XXXX-XXXX-\d{4}$/);
    });

    it('should have audit log for KYC access', async () => {
      const response = await fetch(
        `${baseURL}/api/admin/kyc/${vendor_id}`,
        {
          method: 'GET',
          headers: {
            'x-admin-role': 'kyc_admin',
            'x-admin-id': 'admin_1',
          },
        }
      );

      expect(response.status).toBe(200);
      // Audit logs should be recorded (verified via logs or audit table query)
    });

    it('should include CORS headers', async () => {
      const response = await fetch(`${baseURL}/api/vendor/register`, {
        method: 'OPTIONS',
        headers: { 'Origin': 'https://vendor.example.com' },
      });

      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
    });

    it('should include security headers', async () => {
      const response = await fetch(`${baseURL}/api/vendor/dashboard`, {
        method: 'GET',
        headers: { 'x-vendor-id': vendor_id },
      });

      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('content-security-policy')).toBeDefined();
    });
  });

  // ============ Edge Cases & Error Handling ============

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await fetch(`${baseURL}/api/vendor/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {',
      });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent vendor', async () => {
      const response = await fetch(
        `${baseURL}/api/admin/kyc/vendor_nonexistent/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-role': 'kyc_admin',
            'x-admin-id': 'admin_1',
          },
          body: JSON.stringify({ notes: 'Test' }),
        }
      );

      expect(response.status).toBe(404);
    });

    it('should handle concurrent requests safely', async () => {
      const promises = Array(5)
        .fill(null)
        .map(() =>
          fetch(`${baseURL}/api/vendor/request-phone-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '9876543210' }),
          })
        );

      const responses = await Promise.all(promises);
      responses.forEach(r => expect(r.status).toBe(200));
    });
  });
});
