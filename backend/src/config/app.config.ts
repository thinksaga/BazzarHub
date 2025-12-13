/**
 * Environment Configuration
 * Supports development, staging, and production environments
 */

interface AppConfig {
  // Server
  NODE_ENV: 'development' | 'staging' | 'production';
  PORT: number;
  HOST: string;

  // Database
  DATABASE_URL: string;
  DATABASE_POOL_MIN: number;
  DATABASE_POOL_MAX: number;

  // Redis
  REDIS_URL: string;
  REDIS_CACHE_TTL: number;

  // Elasticsearch
  ELASTICSEARCH_URL: string;
  ELASTICSEARCH_USERNAME: string;
  ELASTICSEARCH_PASSWORD: string;

  // Authentication
  JWT_SECRET: string;
  JWT_EXPIRY: string;
  MFA_SECRET: string;

  // Razorpay
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;

  // Shiprocket
  SHIPROCKET_API_KEY: string;
  SHIPROCKET_API_URL: string;

  // AWS S3
  AWS_REGION: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_S3_BUCKET: string;
  AWS_S3_KYC_BUCKET: string;

  // Encryption
  ENCRYPTION_KEY: string;
  ENCRYPTION_IV: string;

  // Email
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASSWORD: string;
  SMTP_FROM_EMAIL: string;

  // SMS
  SMS_PROVIDER: 'twilio' | 'exotel' | 'msg91';
  SMS_API_KEY: string;
  SMS_API_URL: string;

  // CDN
  CDN_URL: string;

  // External APIs
  GST_API_URL: string;
  GST_API_TOKEN: string;
  GST_API_ENABLED: boolean;

  // ClamAV (virus scanning)
  CLAMAV_URL: string;
  CLAMAV_ENABLED: boolean;

  // Monitoring
  SENTRY_DSN: string;
  PROMETHEUS_ENABLED: boolean;

  // Logging
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  LOG_FORMAT: 'json' | 'text';

  // Security
  CORS_ORIGINS: string[];
  ALLOWED_PAYMENT_METHODS: string[];
  MIN_PASSWORD_LENGTH: number;
  SESSION_TIMEOUT: number;
  MAX_LOGIN_ATTEMPTS: number;
  ACCOUNT_LOCKOUT_DURATION: number;

  // Business Rules
  DEFAULT_COMMISSION_PERCENTAGE: number;
  DEFAULT_TDS_PERCENTAGE: number;
  MIN_PAYOUT_THRESHOLD: number;
  PAYOUT_FREQUENCY: 'weekly' | 'bi-weekly' | 'monthly';

  // Feature Flags
  FEATURE_FLAGS: {
    enable_split_payments: boolean;
    enable_cod: boolean;
    enable_wishlists: boolean;
    enable_reviews: boolean;
    enable_referrals: boolean;
    enable_chat: boolean;
    enable_recommendations: boolean;
  };

  // URLs
  APP_URL: string;
  STOREFRONT_URL: string;
  VENDOR_PANEL_URL: string;
  ADMIN_PANEL_URL: string;

  // File Upload
  MAX_FILE_SIZE: number;
  ALLOWED_FILE_EXTENSIONS: string[];
  UPLOAD_DIRECTORY: string;

  // Compliance
  GDPR_ENABLED: boolean;
  DATA_RETENTION_DAYS: number;
  AUDIT_LOG_RETENTION_DAYS: number;
}

const defaultConfig: AppConfig = {
  // Server
  NODE_ENV: 'development',
  PORT: 3000,
  HOST: '0.0.0.0',

  // Database
  DATABASE_URL: 'postgresql://user:password@localhost:5432/bazaarhub',
  DATABASE_POOL_MIN: 5,
  DATABASE_POOL_MAX: 20,

  // Redis
  REDIS_URL: 'redis://localhost:6379',
  REDIS_CACHE_TTL: 24 * 60 * 60, // 24 hours

  // Elasticsearch
  ELASTICSEARCH_URL: 'http://localhost:9200',
  ELASTICSEARCH_USERNAME: 'elastic',
  ELASTICSEARCH_PASSWORD: 'changeme',

  // Authentication
  JWT_SECRET: 'your-secret-key-change-in-production',
  JWT_EXPIRY: '24h',
  MFA_SECRET: 'mfa-secret-key',

  // Razorpay
  RAZORPAY_KEY_ID: '',
  RAZORPAY_KEY_SECRET: '',
  RAZORPAY_WEBHOOK_SECRET: '',

  // Shiprocket
  SHIPROCKET_API_KEY: '',
  SHIPROCKET_API_URL: 'https://apiv2.shiprocket.in',

  // AWS S3
  AWS_REGION: 'ap-south-1',
  AWS_ACCESS_KEY_ID: '',
  AWS_SECRET_ACCESS_KEY: '',
  AWS_S3_BUCKET: 'bazaarhub-products',
  AWS_S3_KYC_BUCKET: 'bazaarhub-kyc-documents',

  // Encryption
  ENCRYPTION_KEY: '',
  ENCRYPTION_IV: '',

  // Email
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: 587,
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  SMTP_FROM_EMAIL: 'noreply@bazaarhub.com',

  // SMS
  SMS_PROVIDER: 'msg91',
  SMS_API_KEY: '',
  SMS_API_URL: 'https://api.msg91.com/api',

  // CDN
  CDN_URL: 'https://cdn.bazaarhub.com',

  // External APIs
  GST_API_URL: 'https://api.gst.gov.in',
  GST_API_TOKEN: '',
  GST_API_ENABLED: false,

  // ClamAV
  CLAMAV_URL: 'http://localhost:3310',
  CLAMAV_ENABLED: false,

  // Monitoring
  SENTRY_DSN: '',
  PROMETHEUS_ENABLED: false,

  // Logging
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',

  // Security
  CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  ALLOWED_PAYMENT_METHODS: ['upi', 'card', 'netbanking', 'wallet', 'emi'],
  MIN_PASSWORD_LENGTH: 12,
  SESSION_TIMEOUT: 24 * 60 * 60, // 24 hours
  MAX_LOGIN_ATTEMPTS: 5,
  ACCOUNT_LOCKOUT_DURATION: 15 * 60, // 15 minutes

  // Business Rules
  DEFAULT_COMMISSION_PERCENTAGE: 10,
  DEFAULT_TDS_PERCENTAGE: 1,
  MIN_PAYOUT_THRESHOLD: 10000, // ₹100 in paise
  PAYOUT_FREQUENCY: 'weekly',

  // Feature Flags
  FEATURE_FLAGS: {
    enable_split_payments: true,
    enable_cod: true,
    enable_wishlists: true,
    enable_reviews: true,
    enable_referrals: false,
    enable_chat: true,
    enable_recommendations: true,
  },

  // URLs
  APP_URL: 'http://localhost:3000',
  STOREFRONT_URL: 'http://localhost:3001',
  VENDOR_PANEL_URL: 'http://localhost:3002',
  ADMIN_PANEL_URL: 'http://localhost:3003',

  // File Upload
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_EXTENSIONS: ['pdf', 'jpg', 'jpeg', 'png', 'csv', 'xlsx'],
  UPLOAD_DIRECTORY: '/tmp/uploads',

  // Compliance
  GDPR_ENABLED: true,
  DATA_RETENTION_DAYS: 365,
  AUDIT_LOG_RETENTION_DAYS: 2555, // 7 years
};

/**
 * Load and validate environment configuration
 */
export function loadConfig(): AppConfig {
  const config = { ...defaultConfig };

  // Override with environment variables
  if (process.env.NODE_ENV) config.NODE_ENV = process.env.NODE_ENV as any;
  if (process.env.PORT) config.PORT = parseInt(process.env.PORT, 10);
  if (process.env.DATABASE_URL) config.DATABASE_URL = process.env.DATABASE_URL;
  if (process.env.REDIS_URL) config.REDIS_URL = process.env.REDIS_URL;
  if (process.env.ELASTICSEARCH_URL) config.ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL;
  if (process.env.JWT_SECRET) config.JWT_SECRET = process.env.JWT_SECRET;
  if (process.env.RAZORPAY_KEY_ID) config.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
  if (process.env.RAZORPAY_KEY_SECRET) config.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
  if (process.env.AWS_ACCESS_KEY_ID) config.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
  if (process.env.AWS_SECRET_ACCESS_KEY) config.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
  if (process.env.ENCRYPTION_KEY) config.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (process.env.SMTP_HOST) config.SMTP_HOST = process.env.SMTP_HOST;
  if (process.env.SMS_API_KEY) config.SMS_API_KEY = process.env.SMS_API_KEY;
  if (process.env.SENTRY_DSN) config.SENTRY_DSN = process.env.SENTRY_DSN;
  if (process.env.LOG_LEVEL) config.LOG_LEVEL = process.env.LOG_LEVEL as any;
  if (process.env.GST_API_ENABLED) config.GST_API_ENABLED = process.env.GST_API_ENABLED === 'true';
  if (process.env.CLAMAV_ENABLED) config.CLAMAV_ENABLED = process.env.CLAMAV_ENABLED === 'true';

  // Validate critical configs
  if (config.NODE_ENV === 'production') {
    if (!config.JWT_SECRET || config.JWT_SECRET === 'your-secret-key-change-in-production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials must be set in production');
    }
    if (!config.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY must be set in production');
    }
  }

  return config;
}

// Parse JSON arrays from environment variables
function parseJsonEnv(envVar: string | undefined, defaultValue: any[]): any[] {
  if (!envVar) return defaultValue;
  try {
    return JSON.parse(envVar);
  } catch {
    return defaultValue;
  }
}

export default loadConfig();
