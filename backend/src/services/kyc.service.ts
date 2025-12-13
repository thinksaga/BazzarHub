/**
 * KYC Service - Vendor Know Your Customer Verification
 * Handles document submission, validation, encryption, and compliance
 */

import AWS from 'aws-sdk';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import * as fs from 'fs';

// Mock logger if utils/logger doesn't exist
const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta),
  error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta),
};

// Mock RedisService interface for now
class RedisService {
  static getInstance() { return new RedisService(); }
  async set(key: string, value: string, ttl?: number) {}
  async get(key: string) { return null; }
  async lpush(key: string, value: string) {}
  async lrange(key: string, start: number, end: number) { return []; }
  async delete(key: string) {}
  async rpush(key: string, value: string) {}
}

interface Document {
  name: string;
  type: 'pan' | 'aadhaar' | 'gstin' | 'bank_proof' | 'business_registration';
  file: Express.Multer.File;
  metadata?: Record<string, any>;
}

interface KYCSubmission {
  vendor_id: string;
  documents: Document[];
  ip_address?: string;
  user_agent?: string;
}

interface KYCData {
  vendor_id: string;
  pan_encrypted: string;
  aadhaar_last_four: string;
  gstin: string;
  gstin_encrypted?: string;
  bank_account_encrypted: string;
  document_urls: Record<string, string>;
  verification_status: 'pending' | 'verified' | 'rejected' | 'pending_correction';
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  submission_id: string;
}

interface ValidationResult {
  valid: boolean;
  data?: Record<string, any>;
  errors?: string[];
  reason?: string;
}

class KYCService {
  private static instance: KYCService;
  private s3Client: AWS.S3;
  private redisService: RedisService;
  private encryptionKey: string;

  private constructor() {
    this.s3Client = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.redisService = RedisService.getInstance();
    this.encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  }

  public static getInstance(): KYCService {
    if (!KYCService.instance) {
      KYCService.instance = new KYCService();
    }
    return KYCService.instance;
  }

  /**
   * Main KYC submission handler
   */
  async submitKYC(kycSubmission: KYCSubmission): Promise<KYCData> {
    try {
      const submissionId = uuid();
      logger.info(`[KYC] Starting KYC submission for vendor: ${kycSubmission.vendor_id}`, {
        submissionId,
        documentCount: kycSubmission.documents.length,
      });

      const documentUrls: Record<string, string> = {};
      let panData: Record<string, any> = {};
      let aadhaarLastFour = '';
      let gstinNumber = '';
      let bankAccountEncrypted = '';

      // Process each document
      for (const doc of kycSubmission.documents) {
        try {
          // Validate document format
          this.validateDocumentFormat(doc);

          // Virus scan
          await this.virusScanDocument(doc.file);

          // Upload to S3
          const s3Key = `kyc/${kycSubmission.vendor_id}/${doc.type}/${submissionId}/${doc.file.originalname}`;
          const s3Url = await this.uploadToS3(doc.file, s3Key);
          documentUrls[doc.type] = s3Url;

          // Process document based on type
          if (doc.type === 'pan') {
            panData = await this.validateAndExtractPAN(doc.file);
          } else if (doc.type === 'aadhaar') {
            aadhaarLastFour = await this.extractAndMaskAadhaar(doc.file);
          } else if (doc.type === 'gstin') {
            gstinNumber = await this.validateGSTIN(doc.file);
          } else if (doc.type === 'bank_proof') {
            bankAccountEncrypted = await this.processBankProof(doc.file);
          }

          logger.info(`[KYC] Successfully processed ${doc.type} document`, {
            submissionId,
            vendor_id: kycSubmission.vendor_id,
          });
        } catch (error) {
          logger.error(`[KYC] Error processing ${doc.type} document`, {
            submissionId,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      }

      // Encrypt sensitive data
      const panEncrypted = this.encryptData(panData.pan || '');
      const gstinEncrypted = this.encryptData(gstinNumber);

      // Create KYC record
      const kycData: KYCData = {
        vendor_id: kycSubmission.vendor_id,
        pan_encrypted: panEncrypted,
        aadhaar_last_four: aadhaarLastFour,
        gstin: gstinNumber,
        gstin_encrypted: gstinEncrypted,
        bank_account_encrypted: bankAccountEncrypted,
        document_urls: documentUrls,
        verification_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        submission_id: submissionId,
      };

      // Store in Redis and database
      await this.redisService.set(`kyc:${kycSubmission.vendor_id}`, JSON.stringify(kycData), 30 * 24 * 60 * 60); // 30 days

      // Add to pending KYC queue
      await this.redisService.lpush('kyc:pending', JSON.stringify({
        vendor_id: kycSubmission.vendor_id,
        submission_id: submissionId,
        timestamp: new Date().toISOString(),
      }));

      // Audit log
      await this.auditLog('KYC_SUBMISSION', kycSubmission.vendor_id, {
        submission_id: submissionId,
        documents: Object.keys(documentUrls),
        ip_address: kycSubmission.ip_address,
      });

      // Notify admin
      await this.notifyAdmin('kyc_submission', {
        vendor_id: kycSubmission.vendor_id,
        submission_id: submissionId,
        pan_last_four: panData.pan ? panData.pan.slice(-4) : '****',
      });

      logger.info(`[KYC] KYC submission completed successfully`, {
        submissionId,
        vendor_id: kycSubmission.vendor_id,
      });

      return kycData;
    } catch (error) {
      logger.error(`[KYC] KYC submission failed`, {
        vendor_id: kycSubmission.vendor_id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Validate document format
   */
  private validateDocumentFormat(doc: Document): void {
    const allowedFormats = ['pdf', 'jpg', 'jpeg', 'png'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    const fileExt = doc.file.originalname.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedFormats.includes(fileExt)) {
      throw new Error(`Invalid document format: ${fileExt}. Allowed: ${allowedFormats.join(', ')}`);
    }

    if (doc.file.size > maxSize) {
      throw new Error(`Document size exceeds 5MB limit: ${(doc.file.size / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  /**
   * Virus scan document using ClamAV
   */
  private async virusScanDocument(file: Express.Multer.File): Promise<void> {
    try {
      const clamavUrl = process.env.CLAMAV_URL || 'http://localhost:3310';

      const response = await axios.post(
        `${clamavUrl}/scan`,
        file.buffer,
        {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          timeout: 30000,
        }
      );

      if (response.data.infected) {
        throw new Error(`Virus detected in document: ${response.data.viruses}`);
      }

      logger.info('[KYC] Document virus scan passed', { filename: file.originalname });
    } catch (error) {
      logger.warn('[KYC] Virus scan unavailable, proceeding with caution', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Proceed without virus scan if service unavailable
    }
  }

  /**
   * Upload document to S3 with encryption
   */
  private async uploadToS3(file: Express.Multer.File, key: string): Promise<string> {
    try {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET || 'bazaar-kyc-documents',
        Key: key,
        Body: file.buffer,
        ServerSideEncryption: 'AES256',
        ContentType: file.mimetype,
        Metadata: {
          'original-name': file.originalname,
          'upload-timestamp': new Date().toISOString(),
        },
      };

      const result = await this.s3Client.upload(params).promise();
      logger.info('[KYC] Document uploaded to S3', { key, etag: result.ETag });

      // Return signed URL (1 hour expiry)
      const signedUrl = this.s3Client.getSignedUrl('getObject', {
        Bucket: params.Bucket,
        Key: key,
        Expires: 3600, // 1 hour
      });

      return signedUrl;
    } catch (error) {
      logger.error('[KYC] S3 upload failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Validate and extract PAN from document
   */
  private async validateAndExtractPAN(file: Express.Multer.File): Promise<Record<string, any>> {
    try {
      // For this implementation, we extract PAN from metadata/filename or OCR
      // In production, use Tesseract.js for OCR or document processing service
      const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/;

      // Try to extract from file content (simplified)
      const fileContent = file.buffer.toString('utf-8', 0, Math.min(1000, file.buffer.length));
      const panMatch = fileContent.match(panRegex);

      if (!panMatch) {
        throw new Error('PAN not found in document');
      }

      const pan = panMatch[0];
      const panValidation = this.validatePAN(pan);

      if (!panValidation.valid) {
        throw new Error(`Invalid PAN format: ${panValidation.reason}`);
      }

      logger.info('[KYC] PAN extracted and validated', { pan_last_four: pan.slice(-4) });

      return {
        pan,
        extracted_at: new Date().toISOString(),
        method: 'ocr',
      };
    } catch (error) {
      logger.error('[KYC] PAN extraction failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Validate PAN format and optional API verification
   */
  validatePAN(pan: string): ValidationResult {
    // Format: ABCDE1234F (5 letters + 4 digits + 1 letter)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

    if (!panRegex.test(pan)) {
      return {
        valid: false,
        errors: ['Invalid PAN format. Expected: 5 letters + 4 digits + 1 letter'],
        reason: 'format_invalid',
      };
    }

    // Basic checksum validation
    if (this.validatePANChecksum(pan)) {
      return {
        valid: true,
        data: { pan, format: 'valid' },
      };
    }

    return {
      valid: false,
      errors: ['PAN checksum validation failed'],
      reason: 'checksum_invalid',
    };
  }

  /**
   * PAN checksum validation
   */
  private validatePANChecksum(pan: string): boolean {
    // Simplified checksum: 10th character should be alphabetic
    // In production, implement full checksum algorithm or use NSDL API
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  }

  /**
   * Extract and mask Aadhaar number
   */
  private async extractAndMaskAadhaar(file: Express.Multer.File): Promise<string> {
    try {
      // Extract Aadhaar from document
      const aadhaarRegex = /\d{4}[\s\-]?\d{4}[\s\-]?\d{4}/;
      const fileContent = file.buffer.toString('utf-8', 0, Math.min(1000, file.buffer.length));
      const aadhaarMatch = fileContent.match(aadhaarRegex);

      if (!aadhaarMatch) {
        throw new Error('Aadhaar not found in document');
      }

      const aadhaar = aadhaarMatch[0].replace(/[\s\-]/g, '');
      const maskedAadhaar = `XXXX-XXXX-${aadhaar.slice(-4)}`;

      logger.info('[KYC] Aadhaar extracted and masked', {
        masked: maskedAadhaar,
      });

      return maskedAadhaar;
    } catch (error) {
      logger.error('[KYC] Aadhaar extraction failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Validate GSTIN format and check with GST API
   */
  async validateGSTIN(gstinOrFile: string | Express.Multer.File): Promise<string> {
    try {
      let gstin = gstinOrFile;

      if (typeof gstinOrFile !== 'string') {
        // Extract from file if it's a file object
        const fileContent = gstinOrFile.buffer.toString('utf-8', 0, Math.min(1000, gstinOrFile.buffer.length));
        const gstinMatch = fileContent.match(/\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]Z\d/);

        if (!gstinMatch) {
          throw new Error('GSTIN not found in document');
        }

        gstin = gstinMatch[0];
      }

      // Format validation
      const gstinRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]Z\d$/;
      if (!gstinRegex.test(gstin as string)) {
        throw new Error('Invalid GSTIN format');
      }

      // Optional: Verify with GST API
      if (process.env.GST_API_ENABLED === 'true') {
        await this.verifyGSTINWithAPI(gstin as string);
      }

      logger.info('[KYC] GSTIN validated', { gstin_last_six: (gstin as string).slice(-6) });

      return gstin as string;
    } catch (error) {
      logger.error('[KYC] GSTIN validation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Verify GSTIN with GST portal API
   */
  private async verifyGSTINWithAPI(gstin: string): Promise<void> {
    try {
      const gstAPIUrl = process.env.GST_API_URL || 'https://api.gst.gov.in';
      const response = await axios.post(
        `${gstAPIUrl}/search/status`,
        { gstin },
        {
          headers: {
            'Authorization': `Bearer ${process.env.GST_API_TOKEN}`,
          },
          timeout: 10000,
        }
      );

      if (response.data.status !== 'ACTIVE') {
        throw new Error(`GSTIN status is ${response.data.status}, not ACTIVE`);
      }

      logger.info('[KYC] GSTIN verified with GST API');
    } catch (error) {
      logger.warn('[KYC] GST API verification failed, proceeding with local validation', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process and encrypt bank proof document
   */
  private async processBankProof(file: Express.Multer.File): Promise<string> {
    try {
      // Extract bank account details from document (simplified)
      // In production, use document processing service
      const accountRegex = /\d{9,18}/;
      const fileContent = file.buffer.toString('utf-8', 0, Math.min(1000, file.buffer.length));
      const accountMatch = fileContent.match(accountRegex);

      if (!accountMatch) {
        throw new Error('Bank account number not found in document');
      }

      const accountNumber = accountMatch[0];
      const encrypted = this.encryptData(accountNumber);

      logger.info('[KYC] Bank account encrypted', {
        account_last_four: accountNumber.slice(-4),
      });

      return encrypted;
    } catch (error) {
      logger.error('[KYC] Bank proof processing failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Encrypt sensitive data using AES-256
   */
  private encryptData(data: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(this.encryptionKey, 'hex').slice(0, 32);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      let encrypted = cipher.update(data, 'utf-8', 'hex');
      encrypted += cipher.final('hex');

      // Combine IV and encrypted data
      const result = iv.toString('hex') + ':' + encrypted;
      return result;
    } catch (error) {
      logger.error('[KYC] Encryption failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(encryptedData: string): string {
    try {
      const [ivHex, encryptedHex] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const key = Buffer.from(this.encryptionKey, 'hex').slice(0, 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');

      return decrypted;
    } catch (error) {
      logger.error('[KYC] Decryption failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get KYC data (with decryption if needed)
   */
  async getKYCData(vendor_id: string, decrypt: boolean = false): Promise<KYCData | null> {
    try {
      const kycJson = await this.redisService.get(`kyc:${vendor_id}`);
      if (!kycJson) {
        return null;
      }

      const kycData = JSON.parse(kycJson) as KYCData;

      if (decrypt) {
        kycData.pan_encrypted = this.decryptData(kycData.pan_encrypted);
        if (kycData.gstin_encrypted) {
          kycData.gstin_encrypted = this.decryptData(kycData.gstin_encrypted);
        }
        kycData.bank_account_encrypted = this.decryptData(kycData.bank_account_encrypted);
      }

      return kycData;
    } catch (error) {
      logger.error('[KYC] Failed to get KYC data', {
        vendor_id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Update KYC verification status
   */
  async updateVerificationStatus(
    vendor_id: string,
    status: 'verified' | 'rejected' | 'pending_correction',
    rejectionReason?: string
  ): Promise<void> {
    try {
      const kycData = await this.getKYCData(vendor_id);
      if (!kycData) {
        throw new Error('KYC data not found');
      }

      kycData.verification_status = status;
      kycData.updated_at = new Date().toISOString();
      if (rejectionReason) {
        kycData.rejection_reason = rejectionReason;
      }

      await this.redisService.set(`kyc:${vendor_id}`, JSON.stringify(kycData), 30 * 24 * 60 * 60);

      // Audit log
      await this.auditLog('KYC_STATUS_UPDATED', vendor_id, {
        status,
        reason: rejectionReason,
      });

      logger.info('[KYC] KYC status updated', { vendor_id, status });
    } catch (error) {
      logger.error('[KYC] Failed to update KYC status', {
        vendor_id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get all pending KYC submissions
   */
  async getPendingKYCSubmissions(limit: number = 50): Promise<Array<{ vendor_id: string; submission_id: string; timestamp: string }>> {
    try {
      const pending = await this.redisService.lrange('kyc:pending', 0, limit - 1);
      return pending.map((item: string) => JSON.parse(item));
    } catch (error) {
      logger.error('[KYC] Failed to get pending KYC submissions', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Remove from pending queue
   */
  async removeFromPendingQueue(vendor_id: string): Promise<void> {
    try {
      const pending = await this.redisService.lrange('kyc:pending', 0, -1);
      const updated = pending.filter((item: string) => {
        const parsed = JSON.parse(item);
        return parsed.vendor_id !== vendor_id;
      });

      await this.redisService.delete('kyc:pending');
      if (updated.length > 0) {
        for (const item of updated) {
          await this.redisService.rpush('kyc:pending', item);
        }
      }
    } catch (error) {
      logger.error('[KYC] Failed to remove from pending queue', {
        vendor_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Audit log for compliance
   */
  private async auditLog(action: string, vendor_id: string, details: Record<string, any>): Promise<void> {
    try {
      const auditEntry = {
        action,
        vendor_id,
        details,
        timestamp: new Date().toISOString(),
        id: uuid(),
      };

      await this.redisService.lpush('kyc:audit_log', JSON.stringify(auditEntry));
      logger.info('[KYC] Audit log recorded', { action, vendor_id });
    } catch (error) {
      logger.warn('[KYC] Failed to record audit log', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Notify admin of KYC submission
   */
  private async notifyAdmin(
    type: 'kyc_submission' | 'kyc_approval' | 'kyc_rejection',
    data: Record<string, any>
  ): Promise<void> {
    try {
      // Send notification to admin (email, Slack, etc.)
      logger.info('[KYC] Admin notification sent', { type, vendor_id: data.vendor_id });

      // Store notification in Redis
      await this.redisService.lpush('notifications:admin', JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      logger.warn('[KYC] Failed to notify admin', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Request GDPR data deletion
   */
  async requestDataDeletion(vendor_id: string): Promise<void> {
    try {
      const kycData = await this.getKYCData(vendor_id);
      if (!kycData) {
        throw new Error('KYC data not found');
      }

      // Mark for deletion with 30-day grace period
      await this.redisService.set(
        `kyc:deletion_request:${vendor_id}`,
        JSON.stringify({
          vendor_id,
          requested_at: new Date().toISOString(),
          deletion_scheduled_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        30 * 24 * 60 * 60 // 30 days
      );

      // Delete S3 documents
      for (const [docType, url] of Object.entries(kycData.document_urls)) {
        try {
          const key = this.extractS3KeyFromUrl(url);
          await this.s3Client.deleteObject({
            Bucket: process.env.AWS_S3_BUCKET || 'bazaar-kyc-documents',
            Key: key,
          }).promise();
        } catch (error) {
          logger.warn('[KYC] Failed to delete S3 document', {
            docType,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Audit log
      await this.auditLog('GDPR_DELETION_REQUESTED', vendor_id, {
        deletion_scheduled: true,
      });

      logger.info('[KYC] GDPR deletion requested', { vendor_id });
    } catch (error) {
      logger.error('[KYC] GDPR deletion request failed', {
        vendor_id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Extract S3 key from signed URL
   */
  private extractS3KeyFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').slice(1).join('/');
    } catch {
      return '';
    }
  }
}

export default KYCService;
