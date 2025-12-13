# BazaarHub - Production-Ready Multivendor Marketplace for India

A comprehensive, secure, and scalable multivendor marketplace platform built with Node.js/TypeScript, PostgreSQL, Redis, and Elasticsearch. Designed specifically for the Indian market with complete GST compliance, KYC verification, Razorpay integration, and Shiprocket shipping.

## 🌟 Features

### Core Marketplace Features
- ✅ **Multivendor Management**: Complete vendor lifecycle from registration to payouts
- ✅ **Secure KYC Verification**: Document-based vendor verification with AES-256 encryption
- ✅ **Product Management**: Vendor product catalog with attributes and certifications
- ✅ **Order Management**: Complete order processing with order tracking
- ✅ **Shopping Cart & Checkout**: Multi-vendor cart with split payments

### India-Specific Compliance
- ✅ **GST Integration**: CGST+SGST (intra-state) and IGST (inter-state) calculations
- ✅ **TDS Compliance**: Section 194O with automatic deduction (1% with PAN, 5% without)
- ✅ **Product Certifications**: BIS and FSSAI certification tracking
- ✅ **Country of Origin**: Mandatory field for all products
- ✅ **Aadhaar Masking**: Secure handling of Aadhaar (last 4 digits only)

### Payment & Payout
- ✅ **Razorpay Integration**: Payment gateway with Route-based split payments
- ✅ **Automatic Payouts**: Scheduled weekly/bi-weekly/monthly vendor payouts
- ✅ **Payment Reconciliation**: Detailed payment reconciliation reports
- ✅ **COD Support**: Cash-on-Delivery with pincode eligibility

### Shipping
- ✅ **Shiprocket Integration**: Real-time shipping rate calculation
- ✅ **Pincode Serviceability**: Automated COD and shipping feasibility checks
- ✅ **Order Tracking**: Real-time order status updates

### Security & Compliance
- ✅ **AES-256 Encryption**: PAN, bank details, and Aadhaar fragments encrypted at rest
- ✅ **Rate Limiting**: Prevent abuse with configurable rate limits
- ✅ **RBAC**: Role-based access control (super_admin, kyc_admin, ops_admin, finance_admin)
- ✅ **Audit Logging**: Complete audit trail for compliance
- ✅ **Input Validation**: Server-side validation for all inputs
- ✅ **HTTPS Ready**: Configured for SSL/TLS in production

### Scalability & Performance
- ✅ **Database Pooling**: PostgreSQL connection pooling
- ✅ **Redis Caching**: Multi-tier caching strategy
- ✅ **Elasticsearch**: Full-text search with analytics
- ✅ **Horizontal Scaling**: Docker-ready architecture
- ✅ **Structured Logging**: JSON-based logs for aggregation

## ✅ Project Status

The project has completed the following development phases:
- **Phase 1: Backend Core** (GST, Payments, Search, Auth) - ✅ Completed
- **Phase 2: Vendor Panel** (Onboarding, Products, Orders) - ✅ Completed
- **Phase 3: Admin Panel** (KYC, Reports, User Management) - ✅ Completed
- **Phase 4: Storefront** (Discovery, Cart, Checkout, Account) - ✅ Completed
- **Phase 5: Integration** (Docker, Nginx, E2E Testing) - ✅ Completed

## 🏗 Architecture

### Tech Stack
- **Backend**: Node.js 20 + TypeScript
- **Database**: PostgreSQL 15 (primary)
- **Cache**: Redis 7 (sessions, rate limiting, caching)
- **Search**: Elasticsearch 8 (product search, analytics)
- **Payments**: Razorpay API (v2)
- **Shipping**: Shiprocket API v2
- **Frontend**: Next.js 14 (3 applications - Storefront, Vendor Panel, Admin Panel)
- **Infrastructure**: Docker + docker-compose, Nginx reverse proxy

### Services

- **PostgreSQL 15**: Database with persistent storage and RLS
- **Redis 7**: Session storage, rate limiting, and caching
- **Elasticsearch 8**: Full-text product search
- **Backend API**: Node.js/TypeScript (port 3000)
- **Storefront**: Next.js PWA (port 3001)
- **Vendor Panel**: Next.js dashboard (port 3002)
- **Admin Panel**: Next.js admin (port 3003)
- **Nginx**: Reverse proxy for routing (ports 80/443)

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose 20.10+
- Node.js 20+ (for local development)
- Git

### Development Setup

1. **Clone and Configure**
```bash
git clone <repository-url>
cd BazaarHub
cp .env.example .env

# Edit .env with your local configuration
nano .env
```

2. **Start All Services**
```bash
docker-compose up -d
```

This will automatically:
- Create PostgreSQL database with schema
- Initialize Redis
- Start Elasticsearch
- Build and run backend API
- Build and run all frontends
- Configure Nginx reverse proxy

3. **Wait for Services**
```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
```

4. **Access Applications**
- **Storefront**: http://localhost (or http://localhost:3001)
- **Vendor Panel**: http://vendor.localhost (or http://localhost:3002)
- **Admin Panel**: http://admin.localhost (or http://localhost:3003)
- **Backend API**: http://localhost/api (or http://localhost:5004)
- **API Documentation**: http://localhost:5004/docs

*Note: For subdomain access (`vendor.localhost`, `admin.localhost`), add them to your `/etc/hosts` file pointing to `127.0.0.1`.*

5. **First Steps**
```bash
# Create admin user
docker-compose exec backend npm run seed:admin

# View logs
docker-compose logs -f backend
```

## 📖 API Documentation

### Authentication
All vendor and admin endpoints require JWT token:

```bash
# Vendor Registration (Public)
curl -X POST http://localhost/api/vendor/register \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "MyBusiness",
    "business_type": "individual",
    "email": "vendor@example.com",
    "phone": "9876543210",
    "password": "SecurePass123!@#"
  }'

# Vendor Login
curl -X POST http://localhost/api/vendor/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendor@example.com",
    "password": "SecurePass123!@#"
  }'

# Response includes:
# {
#   "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
#   "refresh_token": "eyJ0eXAiOiJSZWZyZXNoIiwi...",
#   "vendor_id": "uuid",
#   "status": "pending_kyc"
# }
```

### Vendor KYC Submission
```bash
# Send Phone OTP (Step 1)
curl -X POST http://localhost/api/vendor/send-phone-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'

# Verify Phone OTP (Step 2)
curl -X POST http://localhost/api/vendor/verify-phone-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "otp": "123456"}'

# Submit KYC Documents (Step 3)
curl -X POST http://localhost/api/vendor/kyc/submit \
  -H "Authorization: Bearer {access_token}" \
  -F "pan_document=@pan.pdf" \
  -F "aadhaar_document=@aadhaar.pdf" \
  -F "gstin_document=@gstin.pdf" \
  -F "bank_proof_document=@bank_proof.pdf" \
  -F "pan=ABCDE1234F" \
  -F "gstin=06AABCU9603R1Z0" \
  -F "bank_account_holder=Name" \
  -F "bank_account_number=1234567890" \
  -F "bank_ifsc_code=HDFC0000001"
```

### Admin KYC Review
```bash
# List pending KYC submissions
curl -X GET "http://localhost/api/admin/kyc/pending?limit=10&offset=0" \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-Admin-Role: kyc_admin"

# View vendor KYC details
curl -X GET http://localhost/api/admin/kyc/{vendor_id} \
  -H "Authorization: Bearer {admin_token}" \
  -H "X-Admin-Role: kyc_admin"

# Approve KYC (automatically creates Razorpay account)
curl -X POST http://localhost/api/admin/kyc/{vendor_id}/approve \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"notes": "All documents verified"}'

# Reject KYC
curl -X POST http://localhost/api/admin/kyc/{vendor_id}/reject \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Aadhaar document not clear. Please resubmit."}'
```

### Product Management
```bash
# Add Product (Verified Vendor Only)
curl -X POST http://localhost/api/vendor/products \
  -H "Authorization: Bearer {vendor_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cotton T-Shirt",
    "sku": "TSHIRT-001",
    "description": "Premium cotton t-shirt",
    "price": 499.00,
    "stock_quantity": 50,
    "hsn_code": "61091090",
    "gst_rate": 5,
    "country_of_origin": "IN",
    "images": ["s3://bucket/image1.jpg"]
  }'

# List Products
curl -X GET "http://localhost/api/vendor/products?limit=10" \
  -H "Authorization: Bearer {vendor_token}"

# Update Product
curl -X PUT http://localhost/api/vendor/products/{product_id} \
  -H "Authorization: Bearer {vendor_token}" \
  -H "Content-Type: application/json" \
  -d '{"price": 549.00, "stock_quantity": 75}'
```

### Order Management
```bash
# Create Order (Customer)
curl -X POST http://localhost/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "product_id": "uuid",
        "quantity": 2,
        "vendor_id": "uuid"
      }
    ],
    "shipping_address": {
      "name": "John Doe",
      "phone": "9876543210",
      "address": "123 Main St",
      "city": "Bangalore",
      "state": "Karnataka",
      "postal_code": "560001"
    },
    "payment_method": "razorpay",
    "cod_eligible": true
  }'

# Get Order Details
curl -X GET http://localhost/api/vendor/orders/{order_id} \
  -H "Authorization: Bearer {vendor_token}"

# Update Order Status
curl -X PATCH http://localhost/api/vendor/orders/{order_id} \
  -H "Authorization: Bearer {vendor_token}" \
  -H "Content-Type: application/json" \
  -d '{"status": "shipped", "tracking_id": "TRACK123"}'
```

### Payment Processing
```bash
# Create Razorpay Payment Order
curl -X POST http://localhost/api/payments/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "uuid",
    "amount": 5000,
    "currency": "INR"
  }'

# Verify Payment (after Razorpay callback)
curl -X POST http://localhost/api/payments/verify \
  -H "Content-Type: application/json" \
  -d '{
    "razorpay_payment_id": "pay_xxx",
    "razorpay_signature": "signature_xxx"
  }'
```

## 🔐 Security

### KYC Document Security
- **Storage**: AES-256 encrypted S3 buckets with signed URLs
- **Virus Scanning**: ClamAV integration for malware detection
- **Access Control**: 1-hour expiring signed URLs for document downloads
- **Audit Trail**: Complete audit logging for document access

### Data Encryption
- **PAN**: Encrypted with AES-256, only last 4 digits visible
- **Bank Details**: Full encryption of account number and IFSC
- **Aadhaar**: Only last 4 digits stored (encrypted)

### Authentication & Authorization
- **JWT Tokens**: 24-hour expiry with refresh token rotation
- **Strong Passwords**: Minimum 12 characters with complexity requirements
- **RBAC**: 4 admin roles (super_admin, kyc_admin, ops_admin, finance_admin)
- **Rate Limiting**: 3 registration attempts per IP per hour

### Compliance
- **GDPR Ready**: PII handling and data retention policies
- **India Compliance**: GST, TDS, KYC requirements
- **Audit Logging**: All sensitive operations logged
- **Data Residency**: Option to keep data within India

## 🧪 Testing

### End-to-End (E2E) Testing
We have a comprehensive guide for manual E2E testing of the entire platform flow.
👉 **[Read the E2E Testing Guide](./E2E_TESTING_GUIDE.md)**

### Health Checks
Run the automated health check script to verify all services are up:
```bash
./scripts/test-health.sh
```

### Automated Tests
```bash
# Unit tests
docker-compose exec backend npm test

# Integration tests
docker-compose exec backend npm run test:integration

# Test coverage
docker-compose exec backend npm run test:coverage
```

### Test Coverage
- ✅ Vendor registration and authentication
- ✅ KYC document submission and verification
- ✅ Product CRUD operations
- ✅ Order processing and fulfillment
- ✅ Payment integration with Razorpay
- ✅ Commission calculations and payouts
- ✅ Access control and RBAC
- ✅ Rate limiting and abuse prevention

## 📊 Monitoring

### Health Checks
```bash
# Application health
curl http://localhost/api/health

# Database
curl http://localhost/api/health/db

# Cache
curl http://localhost/api/health/cache

# Search
curl http://localhost/api/health/search
```

### Logging
- **Format**: JSON (structured logging)
- **Location**: `backend/logs/`
- **Level**: Configurable (error, warn, info, debug)
- **Retention**: 14 days (configurable)

### Metrics (Optional)
```bash
# Enable in .env
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090

# Access metrics
curl http://localhost:9090/metrics
```

## 🛠 Troubleshooting

### Services Not Starting
```bash
# Check service logs
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f redis

# Verify health
docker-compose ps

# Rebuild services
docker-compose up -d --build
```

### Database Connection Issues
```bash
# Test PostgreSQL connection
docker-compose exec postgres psql -U bazaarhub -d bazaarhub -c "SELECT 1;"

# Check database migrations
docker-compose logs postgres
```

### Redis Connection Issues
```bash
# Test Redis connection
docker-compose exec redis redis-cli ping

# Check Redis info
docker-compose exec redis redis-cli info
```

### Port Conflicts
```bash
# Check ports in use
lsof -i :80 -i :3000 -i :5432

# Modify ports in docker-compose.yml or .env
```

## 📝 Environment Variables

See `.env.example` for all available options. Essential variables:

```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=bazaarhub
DB_USER=bazaarhub
DB_PASSWORD=secure_password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# JWT
JWT_SECRET=your-secret-key-min-32-chars

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=bazaarhub-products
```

## 🚀 Production Deployment

### Pre-Deployment Checklist
- [ ] SSL/TLS certificates configured
- [ ] Database backups scheduled
- [ ] Environment variables set for production
- [ ] Security scanning completed
- [ ] Load testing performed
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented

### Deploy to Production
```bash
# Build images
docker-compose build --no-cache

# Start services in production
NODE_ENV=production docker-compose up -d

# Run migrations
docker-compose exec backend npm run migrate

# Verify all services
docker-compose ps
docker-compose exec backend npm run health
```

### Backup & Recovery
```bash
# Database backup
docker-compose exec postgres pg_dump bazaarhub > backup-$(date +%Y%m%d).sql

# Database restore
docker-compose exec -T postgres psql bazaarhub < backup.sql

# Volume backup
docker run --rm -v bazaarhub_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

## 📦 Database Schema

### Core Tables
- **vendors**: Vendor information with KYC status
- **vendors_kyc**: KYC documents and verification status
- **vendors_kyc_audit**: Audit trail for KYC operations
- **products**: Product catalog
- **orders**: Order management
- **commissions**: Commission configuration
- **commission_ledger**: Commission tracking
- **payout_records**: Vendor payouts
- **razorpay_accounts**: Linked Razorpay accounts
- **product_certifications**: BIS/FSSAI certifications
- **gst_rates**: HSN-based GST rates

### Audit Tables
- **audit.audit_logs**: Complete audit trail of all changes

## 🔄 API Versions

### v1.0.0 (Current)
- Complete vendor onboarding with KYC
- Product and order management
- Payment processing with split payments
- Commission and payout management
- GST and TDS compliance
- Shipping integration

## 📚 Documentation

- **API Docs**: http://localhost:3000/docs (Swagger)
- **KYC Flow**: [KYC_FLOW.md](./KYC_FLOW.md)
- **GST Compliance**: [GST_COMPLIANCE_DOCUMENTATION.md](./GST_COMPLIANCE_DOCUMENTATION.md)
- **Redis Integration**: [REDIS_INTEGRATION.md](./REDIS_INTEGRATION.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Submit pull request

## 📄 License

Proprietary - All Rights Reserved

## 🆘 Support

For issues:
1. Check logs: `docker-compose logs [service]`
2. Review documentation
3. Create GitHub issue with details

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Real-time chat system
- [ ] Recommendation engine
- [ ] Affiliate program
- [ ] Subscription products
- [ ] Live streaming
- [ ] AI-powered search

---

**Built with ❤️ for Indian E-commerce**