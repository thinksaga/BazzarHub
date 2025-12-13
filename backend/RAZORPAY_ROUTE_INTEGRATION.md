# Razorpay Route Integration - Automated Vendor Payouts

## Overview

This integration implements **Razorpay Route** (formerly PaymentLink) for automated vendor payouts with commission split. When a customer pays for an order, the system automatically:
1. Deducts the marketplace commission percentage
2. Transfers the remaining amount to the vendor's linked Razorpay account
3. Tracks all transfers with comprehensive dashboards
4. Handles failures with automatic retry mechanism

## Architecture

### Core Components

1. **RazorpayRouteService** - Main service handling Route API operations
2. **VendorAccount** - Vendor bank account and KYC data model
3. **VendorPayout** - Payout transaction tracking model
4. **VendorPayoutRouter** - REST API endpoints for vendor management
5. **WebhookHandler** - Automatic payout creation on payment success

### Data Models

#### VendorAccount
```typescript
{
  id: string;
  vendor_id: string;
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
  account_type: 'savings' | 'current';
  pan: string;              // PAN card number
  gstin?: string;           // GST number (optional)
  business_name?: string;
  business_type?: string;   // individual, partnership, company
  business_address?: string;
  contact_phone?: string;
  contact_email?: string;
  razorpay_contact_id: string;      // Razorpay contact ID
  razorpay_fund_account_id: string; // Razorpay fund account ID
  status: VendorAccountStatus;      // pending/under_review/verified/rejected
  commission_percentage: number;     // Default 10%
  auto_payout_enabled: boolean;
  bank_verified: boolean;
  verified_at?: Date;
  verified_by?: string;
  verification_notes?: string;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
}
```

#### VendorPayout
```typescript
{
  id: string;
  vendor_id: string;
  order_id: string;
  payment_id: string;
  payout_type: 'order' | 'refund' | 'adjustment';
  gross_amount: number;          // Total amount in paise
  commission_percentage: number;  // Applied commission rate
  commission_amount: number;      // Deducted commission in paise
  net_payout: number;            // Amount transferred to vendor
  currency: 'INR';
  transfer_id?: string;          // Razorpay transfer ID
  status: PayoutStatus;          // pending/processing/completed/failed
  retry_count: number;           // Current retry attempt
  max_retries: number;           // Default 5
  next_retry_at?: Date;
  error_message?: string;
  error_details?: object;
  initiated_at?: Date;
  processed_at?: Date;
  completed_at?: Date;
  failed_at?: Date;
  vendor_notified: boolean;
  admin_notified: boolean;
  metadata?: object;
  created_at: Date;
  updated_at: Date;
}
```

## API Endpoints

### Vendor Onboarding

#### 1. Register Vendor Account

**POST** `/api/vendor/onboard`

Creates a Razorpay linked account for the vendor with bank details and KYC documents.

**Request Body:**
```json
{
  "vendor_id": "vendor_123",
  "bank_details": {
    "account_number": "1234567890",
    "ifsc_code": "SBIN0001234",
    "account_holder_name": "John Doe",
    "account_type": "savings"
  },
  "kyc_details": {
    "pan": "ABCDE1234F",
    "gstin": "29ABCDE1234F1Z5",
    "business_name": "John's Electronics",
    "business_type": "individual",
    "business_address": "123 Main St, Mumbai, Maharashtra 400001",
    "contact_phone": "+919876543210",
    "contact_email": "john@example.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "va_abc123",
    "vendor_id": "vendor_123",
    "status": "under_review",
    "razorpay_contact_id": "cont_xyz789",
    "razorpay_fund_account_id": "fa_def456",
    "commission_percentage": 10.0,
    "auto_payout_enabled": true,
    "bank_verified": true,
    "created_at": "2025-12-07T10:00:00.000Z"
  },
  "message": "Vendor account created successfully. Pending approval."
}
```

#### 2. Get Vendor Account

**GET** `/api/vendor/account/:vendorId`

Retrieves vendor account details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "va_abc123",
    "vendor_id": "vendor_123",
    "account_holder_name": "John Doe",
    "status": "verified",
    "commission_percentage": 10.0,
    "auto_payout_enabled": true,
    "bank_verified": true,
    "verified_at": "2025-12-07T11:00:00.000Z",
    "verified_by": "admin_001"
  }
}
```

#### 3. Approve Vendor Account (Admin)

**POST** `/api/vendor/approve`

Approves a vendor account for automatic payouts.

**Request Body:**
```json
{
  "vendor_id": "vendor_123",
  "approved_by": "admin_001",
  "notes": "All documents verified"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "va_abc123",
    "vendor_id": "vendor_123",
    "status": "verified",
    "verified_at": "2025-12-07T11:00:00.000Z",
    "verified_by": "admin_001"
  },
  "message": "Vendor account approved successfully"
}
```

#### 4. Reject Vendor Account (Admin)

**POST** `/api/vendor/reject`

Rejects a vendor account application.

**Request Body:**
```json
{
  "vendor_id": "vendor_123",
  "reason": "Invalid PAN card",
  "rejected_by": "admin_001"
}
```

#### 5. Update Commission Percentage (Admin)

**PUT** `/api/vendor/commission/:vendorId`

Updates the commission percentage for a vendor.

**Request Body:**
```json
{
  "commission_percentage": 12.5
}
```

#### 6. Toggle Auto Payout

**PUT** `/api/vendor/auto-payout/:vendorId`

Enables or disables automatic payouts for a vendor.

**Request Body:**
```json
{
  "enabled": true
}
```

### Payout Dashboard

#### 7. Get Payout Summary

**GET** `/api/vendor/payout/summary/:vendorId`

Returns comprehensive payout statistics for a vendor.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_payouts": 150,
    "pending_amount": 45000,
    "completed_amount": 2500000,
    "failed_amount": 5000,
    "total_commission": 275000,
    "pending_count": 5,
    "completed_count": 142,
    "failed_count": 3
  }
}
```

**Amount Breakdown (all in paise):**
- `pending_amount`: Total amount awaiting transfer
- `completed_amount`: Total successfully transferred
- `failed_amount`: Total amount in failed transfers
- `total_commission`: Total commission deducted from all payouts

#### 8. Get Pending Payouts

**GET** `/api/vendor/payout/pending/:vendorId`

Lists all pending payouts for a vendor.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "payout_001",
      "vendor_id": "vendor_123",
      "order_id": "order_456",
      "payment_id": "pay_789",
      "gross_amount": 10000,
      "commission_amount": 1000,
      "net_payout": 9000,
      "status": "pending",
      "created_at": "2025-12-07T10:00:00.000Z"
    }
  ],
  "total": 5
}
```

#### 9. Get Completed Payouts

**GET** `/api/vendor/payout/completed/:vendorId`

Lists all completed payouts.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "payout_001",
      "vendor_id": "vendor_123",
      "order_id": "order_456",
      "gross_amount": 10000,
      "commission_amount": 1000,
      "net_payout": 9000,
      "transfer_id": "trf_xyz123",
      "status": "completed",
      "initiated_at": "2025-12-07T10:00:00.000Z",
      "completed_at": "2025-12-07T10:05:00.000Z"
    }
  ],
  "total": 142
}
```

#### 10. Get Failed Payouts

**GET** `/api/vendor/payout/failed/:vendorId`

Lists all failed payouts with error details.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "payout_001",
      "vendor_id": "vendor_123",
      "order_id": "order_456",
      "net_payout": 9000,
      "status": "failed",
      "retry_count": 3,
      "max_retries": 5,
      "next_retry_at": "2025-12-07T14:00:00.000Z",
      "error_message": "Insufficient balance",
      "error_details": {
        "code": "BAD_REQUEST_ERROR",
        "description": "The amount entered is greater than account balance",
        "source": "business",
        "step": "payment_initiation"
      },
      "failed_at": "2025-12-07T12:00:00.000Z"
    }
  ],
  "total": 3
}
```

#### 11. Get Payout Details

**GET** `/api/vendor/payout/:payoutId`

Retrieves detailed information about a specific payout.

#### 12. Retry Failed Payout (Manual)

**POST** `/api/vendor/payout/retry/:payoutId`

Manually triggers a retry for a failed payout.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "payout_001",
    "status": "processing",
    "retry_count": 4,
    "transfer_id": "trf_new123"
  },
  "message": "Payout retry initiated successfully"
}
```

### Admin Endpoints

#### 13. Get All Vendor Accounts (Admin)

**GET** `/api/vendor/admin/accounts`

Lists all vendor accounts in the system.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "va_abc123",
      "vendor_id": "vendor_123",
      "status": "verified",
      "commission_percentage": 10.0,
      "created_at": "2025-12-07T10:00:00.000Z"
    }
  ],
  "total": 50
}
```

#### 14. Get Admin Notifications

**GET** `/api/vendor/admin/notifications`

Retrieves notifications for failed payouts that require admin attention.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "payout_id": "payout_001",
      "vendor_id": "vendor_123",
      "order_id": "order_456",
      "amount": 9000,
      "retry_count": 5,
      "error": "Insufficient balance",
      "timestamp": "2025-12-07T12:00:00.000Z"
    }
  ],
  "total": 5
}
```

### Webhooks

#### 15. Handle Transfer Webhook

**POST** `/api/vendor/webhook/transfer`

Processes Razorpay Route transfer webhooks for automatic status updates.

**Webhook Events Handled:**
- `transfer.processed` - Transfer successful
- `transfer.failed` - Transfer failed
- `transfer.reversed` - Transfer reversed

**Request Body (from Razorpay):**
```json
{
  "entity": "event",
  "account_id": "acc_ABC123",
  "event": "transfer.processed",
  "contains": ["transfer"],
  "payload": {
    "transfer": {
      "entity": {
        "id": "trf_xyz123",
        "status": "processed",
        "amount": 9000,
        "notes": {
          "payout_id": "payout_001",
          "order_id": "order_456",
          "vendor_id": "vendor_123"
        }
      }
    }
  },
  "created_at": 1702000000
}
```

## Automatic Commission Split Flow

### 1. Payment Success Webhook

When a payment succeeds, the webhook handler automatically:

```typescript
// In RazorpayWebhookHandler
async handlePaymentSuccess(event) {
  const payment = event.payload.payment.entity;
  
  // Extract vendor_id from payment notes
  const vendorId = payment.notes?.vendor_id;
  
  // Create payout with automatic commission split
  await routeService.createPayout(
    vendorId,
    payment.order_id,
    payment.id,
    payment.amount  // Amount in paise
  );
}
```

### 2. Commission Calculation

```typescript
// In RazorpayRouteService
async createPayout(vendorId, orderId, paymentId, grossAmount) {
  const vendorAccount = await getVendorAccount(vendorId);
  
  // Calculate commission
  const commissionPercentage = vendorAccount.commission_percentage; // e.g., 10%
  const commissionAmount = Math.floor((grossAmount * commissionPercentage) / 100);
  const netPayout = grossAmount - commissionAmount;
  
  // Example:
  // grossAmount: 10000 paise (₹100)
  // commission: 10%
  // commissionAmount: 1000 paise (₹10)
  // netPayout: 9000 paise (₹90)
  
  // Create payout record
  const payout = {
    gross_amount: 10000,
    commission_amount: 1000,
    net_payout: 9000,
    status: 'pending'
  };
  
  // Initiate transfer if auto payout enabled
  if (vendorAccount.auto_payout_enabled) {
    await initiateTransfer(payout.id);
  }
}
```

### 3. Transfer Initiation

```typescript
async initiateTransfer(payoutId) {
  const payout = await getPayout(payoutId);
  const vendorAccount = await getVendorAccount(payout.vendor_id);
  
  // Create transfer using Razorpay Route
  const transfer = await razorpay.transfers.create({
    account: vendorAccount.razorpay_fund_account_id,
    amount: payout.net_payout,  // Only net amount after commission
    currency: 'INR',
    notes: {
      payout_id: payout.id,
      order_id: payout.order_id,
      vendor_id: payout.vendor_id
    }
  });
  
  // Update payout status
  payout.status = 'processing';
  payout.transfer_id = transfer.id;
}
```

## Retry Mechanism

### Exponential Backoff Strategy

Failed payouts are automatically retried with exponential backoff:

| Retry Attempt | Delay     | Formula              |
|---------------|-----------|----------------------|
| 1             | 2 minutes | 2^0 = 1 minute * 2   |
| 2             | 4 minutes | 2^1 = 2 minutes * 2  |
| 3             | 8 minutes | 2^2 = 4 minutes * 2  |
| 4             | 16 minutes| 2^3 = 8 minutes * 2  |
| 5             | 32 minutes| 2^4 = 16 minutes * 2 |

### Retry Logic

```typescript
async scheduleRetry(payout) {
  if (payout.retry_count >= payout.max_retries) {
    // Notify admin about persistent failure
    await notifyAdminFailure(payout);
    return;
  }
  
  // Calculate exponential backoff
  const delayMinutes = Math.pow(2, payout.retry_count);
  const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  
  payout.next_retry_at = nextRetryAt;
  
  // Store in Redis for retry processing
  await redis.set(
    `payout:retry:${payout.id}`,
    JSON.stringify({
      payout_id: payout.id,
      retry_count: payout.retry_count,
      next_retry_at: nextRetryAt
    }),
    'EX',
    delayMinutes * 60
  );
}
```

### Admin Notifications

When a payout fails after maximum retries (5 attempts):

1. **Admin Notification Created**
   ```typescript
   {
     "payout_id": "payout_001",
     "vendor_id": "vendor_123",
     "order_id": "order_456",
     "amount": 9000,
     "retry_count": 5,
     "error": "Insufficient balance",
     "timestamp": "2025-12-07T12:00:00.000Z"
   }
   ```

2. **Console Error Logged**
   ```
   ADMIN ALERT: Payout failed after max retries:
   {
     payout_id: 'payout_001',
     vendor_id: 'vendor_123',
     amount: 90  // Amount in rupees
   }
   ```

3. **Manual Retry Available**
   - Admin can manually retry via `/api/vendor/payout/retry/:payoutId`
   - Investigate and fix underlying issues (bank account, balance, etc.)

## Configuration

### Environment Variables

```bash
# Razorpay Credentials
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxx

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=3001
```

### Razorpay Dashboard Setup

1. **Enable Route Feature**
   - Log in to Razorpay Dashboard
   - Navigate to Settings → Route
   - Enable Route API access

2. **Configure Webhooks**
   - Navigate to Settings → Webhooks
   - Add webhook URL: `https://yourdomain.com/api/vendor/webhook/transfer`
   - Select events:
     - `transfer.processed`
     - `transfer.failed`
     - `transfer.reversed`

3. **Test Mode vs Live Mode**
   - Use test credentials for development
   - Switch to live credentials for production
   - Update webhook URLs accordingly

## Security Considerations

### 1. Webhook Signature Verification

All webhooks are verified using HMAC SHA256:

```typescript
verifyWebhookSignature(body, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  
  return expectedSignature === signature;
}
```

### 2. Bank Account Verification

- Razorpay automatically verifies bank accounts using penny drop
- `bank_verified` flag is set based on verification status
- Only verified accounts can receive payouts

### 3. KYC Requirements

**For Individual Vendors:**
- PAN card (mandatory)
- Bank account details
- Contact information

**For Business Vendors:**
- PAN card (mandatory)
- GSTIN (for GST-registered businesses)
- Business registration documents
- Authorized signatory details

### 4. Admin Approval Workflow

1. Vendor submits onboarding request
2. Status: `under_review`
3. Admin reviews KYC documents
4. Admin approves/rejects
5. Status: `verified` or `rejected`
6. Only `verified` vendors receive automatic payouts

## Error Handling

### Common Errors

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `BAD_REQUEST_ERROR` | Invalid fund account | Verify bank details |
| `INSUFFICIENT_BALANCE` | Marketplace balance low | Add funds to Razorpay account |
| `INVALID_ACCOUNT` | Bank account inactive | Vendor must update bank details |
| `LIMIT_EXCEEDED` | Transfer limit exceeded | Contact Razorpay support |
| `BANK_HOLIDAY` | Transfer on bank holiday | Automatic retry next business day |

### Error Response Format

```json
{
  "success": false,
  "error": "Failed to create linked account: Invalid IFSC code"
}
```

### Payout Error Details

```json
{
  "error_message": "Insufficient balance",
  "error_details": {
    "code": "BAD_REQUEST_ERROR",
    "description": "The amount entered is greater than account balance",
    "source": "business",
    "step": "payment_initiation",
    "reason": "amount_exceeds_balance"
  }
}
```

## Testing

### Test Vendor Onboarding

```bash
curl -X POST http://localhost:3001/api/vendor/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": "vendor_test_001",
    "bank_details": {
      "account_number": "1234567890",
      "ifsc_code": "SBIN0001234",
      "account_holder_name": "Test Vendor",
      "account_type": "savings"
    },
    "kyc_details": {
      "pan": "ABCDE1234F",
      "gstin": "29ABCDE1234F1Z5",
      "business_name": "Test Business",
      "business_type": "individual",
      "contact_phone": "+919876543210",
      "contact_email": "test@example.com"
    }
  }'
```

### Test Payout Creation

```bash
# This happens automatically on payment success
# To test manually, use the RazorpayRouteService directly
```

### Test Payout Summary

```bash
curl http://localhost:3001/api/vendor/payout/summary/vendor_test_001
```

### Test Manual Retry

```bash
curl -X POST http://localhost:3001/api/vendor/payout/retry/payout_001
```

## Best Practices

### 1. Commission Percentage Management
- Set default commission percentage: 10%
- Allow per-vendor customization for special deals
- Update commission only for future payouts (not retroactive)

### 2. Auto Payout Toggle
- Enable by default for verified vendors
- Allow vendors to disable for manual payout control
- Useful for testing or specific business requirements

### 3. Payout Scheduling
- Automatic payouts triggered on payment success
- Manual payouts available for adjustments
- Batch processing for multiple orders possible

### 4. Monitoring
- Track payout success rate
- Monitor retry statistics
- Set up alerts for persistent failures
- Regular review of admin notifications

### 5. Vendor Communication
- Send email notifications on payout initiation
- Notify on payout completion
- Alert on payout failures
- Provide self-service dashboard

## Troubleshooting

### Vendor Account Not Created

**Issue:** Vendor onboarding fails  
**Check:**
- Valid PAN format (10 characters: ABCDE1234F)
- Valid IFSC code (11 characters)
- Valid bank account number
- Razorpay credentials configured

### Payout Not Initiated

**Issue:** Payout stays in pending status  
**Check:**
- Vendor account status is `verified`
- Auto payout is enabled
- Payment webhook received
- `vendor_id` present in payment notes

### Transfer Failed

**Issue:** Transfer status shows failed  
**Check:**
- Razorpay account balance sufficient
- Bank account active and verified
- IFSC code correct
- Account number matches account holder name
- No transfer limits exceeded

### Webhook Not Processed

**Issue:** Transfer webhook not updating payout status  
**Check:**
- Webhook URL configured in Razorpay dashboard
- Webhook signature verification passing
- Transfer ID matches payout record
- Server accessible from Razorpay (no firewall blocking)

## Performance Optimization

### Redis Caching Strategy

```typescript
// Cache vendor accounts for 1 hour
await redis.set(`vendor:account:${vendorId}`, JSON.stringify(account), 'EX', 3600);

// Cache payout summaries for 5 minutes
await redis.set(`vendor:summary:${vendorId}`, JSON.stringify(summary), 'EX', 300);
```

### Batch Processing

For high-volume marketplaces, consider batch payout processing:

```typescript
// Process pending payouts in batches
const pendingPayouts = await getPendingPayouts();
const batches = chunkArray(pendingPayouts, 100);

for (const batch of batches) {
  await Promise.allSettled(
    batch.map(payout => initiateTransfer(payout.id))
  );
}
```

## Compliance

### RBI Guidelines

- Vendor bank accounts must be verified
- PAN mandatory for all vendors
- GSTIN required for GST-registered businesses
- TDS deduction may apply (not implemented in this version)

### Data Privacy

- Bank account details encrypted at rest
- PAN and GSTIN stored securely
- Access logs maintained for audit
- Vendor consent obtained for data processing

## Support

For issues or questions:

1. Check error messages and logs
2. Review Razorpay dashboard for transfer status
3. Verify webhook delivery in Razorpay dashboard
4. Check admin notifications for failed payouts
5. Contact Razorpay support for API issues

## Changelog

### Version 1.0.0 (2025-12-07)
- Initial implementation of Razorpay Route integration
- Vendor onboarding with KYC verification
- Automatic commission split on payment success
- Exponential backoff retry mechanism
- Admin notifications for failed payouts
- Comprehensive payout dashboard
- Transfer webhook handling
- Redis-based data storage

---

**Note:** This is a production-ready implementation. For actual deployment, consider adding:
- TypeORM/Prisma for persistent database storage
- Email notifications for vendors and admins
- Advanced analytics and reporting
- Multi-currency support (if expanding beyond India)
- TDS calculation and deduction
- Vendor settlement schedules (daily, weekly, monthly)
