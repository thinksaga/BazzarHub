# Complete Razorpay Integration with Split Payments

## Overview

This document provides comprehensive documentation for the complete Razorpay integration implemented for BazaarHub, including payment processing, Route API for split payments, COD support, webhook handling, and automated payout system.

## Table of Contents

1. [Architecture](#architecture)
2. [Setup & Configuration](#setup--configuration)
3. [Payment Service](#payment-service)
4. [Route Service (Split Payments)](#route-service-split-payments)
5. [COD Service](#cod-service)
6. [Webhook Handler](#webhook-handler)
7. [Payout Automation](#payout-automation)
8. [API Endpoints](#api-endpoints)
9. [Testing](#testing)
10. [Security](#security)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Razorpay Integration                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐ │
│  │   Payment    │────▶│    Route     │───▶│     COD      │ │
│  │   Service    │     │   Service    │    │   Service    │ │
│  └──────────────┘     └──────────────┘    └──────────────┘ │
│         │                     │                    │        │
│         └─────────────────────┼────────────────────┘        │
│                               │                             │
│                       ┌───────▼───────┐                     │
│                       │   Webhook     │                     │
│                       │   Handler     │                     │
│                       └───────┬───────┘                     │
│                               │                             │
│                       ┌───────▼───────┐                     │
│                       │    Payout     │                     │
│                       │  Automation   │                     │
│                       └───────────────┘                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Redis Store   │
                    └─────────────────┘
```

### Data Flow

1. **Order Creation** → Payment Service creates Razorpay order
2. **Payment Capture** → Payment verification and signature validation
3. **Split Payment** → Route Service creates transfers to vendor accounts
4. **Webhook Processing** → Automatic status updates and reconciliation
5. **Payout Generation** → Scheduled vendor payout reports

---

## Setup & Configuration

### Environment Variables

```bash
# Razorpay Credentials
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Payout Configuration
MIN_PAYOUT_AMOUNT=100000  # ₹1000 in paise
COD_CHARGES_PERCENTAGE=2
DEFAULT_COMMISSION_RATE=10
```

### Installation

```bash
# Install dependencies (already included in package.json)
npm install razorpay redis uuid

# Run migrations (if needed)
npm run migrate

# Start development server
npm run dev
```

---

## Payment Service

### Location
`backend/src/services/payment/payment.service.ts`

### Features
- Order creation with unique receipts
- Payment capture and verification
- Signature validation for security
- Refund processing (full and partial)
- Transaction logging with 30-day retention

### Usage Examples

#### Create Order
```typescript
import { PaymentService } from './services/payment/payment.service';

const paymentService = PaymentService.getInstance();

const order = await paymentService.createOrder(
  50000,  // ₹500 in paise
  'INR',
  {
    customer_id: 'cust_123',
    product_id: 'prod_456',
    vendor_id: 'vendor_789'
  }
);

// Returns: { id, razorpay_order_id, amount, currency, receipt, status, notes }
```

#### Capture Payment
```typescript
const payment = await paymentService.capturePayment(
  'pay_xxxxxxxxxxxxx',  // Razorpay Payment ID
  50000,                 // Amount in paise
  'INR'
);
```

#### Verify Payment Signature
```typescript
const isValid = await paymentService.verifyPaymentSignature(
  'order_xxxxxxxxxxxxx',  // Order ID
  'pay_xxxxxxxxxxxxx',    // Payment ID
  'signature_string'      // Signature from frontend
);
```

#### Process Refund
```typescript
const refund = await paymentService.refundPayment(
  'pay_xxxxxxxxxxxxx',  // Payment ID
  50000,                 // Amount (optional, full refund if not provided)
  'Customer requested refund'
);
```

### Redis Keys
- `order:{id}` - Order by internal ID
- `order:razorpay:{razorpay_order_id}` - Order by Razorpay ID
- `payment:{id}` - Payment by internal ID
- `payment:razorpay:{razorpay_payment_id}` - Payment by Razorpay ID
- `refund:{id}` - Refund record

---

## Route Service (Split Payments)

### Location
`backend/src/services/payment/route.service.ts`

### Features
- Vendor account linking with bank verification
- Automatic commission and TDS calculation
- On-hold transfers (released after delivery)
- Transfer reversal for cancellations
- Transfer status tracking

### Commission & TDS Logic

```
Order Amount: ₹1000 (100000 paise)
Commission Rate: 10%
Vendor has PAN: Yes

Calculations:
- Order Amount: 100000
- Commission: 10000 (10%)
- TDS: 0 (0% with PAN)
- Net Transfer to Vendor: 90000 (₹900)
```

### Usage Examples

#### Create Linked Account
```typescript
import { RouteService } from './services/payment/route.service';

const routeService = RouteService.getInstance();

const linkedAccount = await routeService.createLinkedAccount({
  vendor_id: 'vendor_123',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '9999999999',
  bank_account_number: '1234567890',
  bank_ifsc: 'HDFC0001234',
  bank_account_name: 'John Doe',
  pan: 'ABCDE1234F'
});
```

#### Create Transfer
```typescript
const transfer = await routeService.createTransfer(
  'pay_xxxxxxxxxxxxx',   // Payment ID
  'order_123',            // Order ID
  'vendor_789',           // Vendor ID
  100000,                 // Amount
  10,                     // Commission Rate (%)
  true,                   // On Hold
  new Date('2024-12-31')  // Release Date
);
```

#### Release On-Hold Transfer
```typescript
// Release after delivery confirmation
await routeService.releaseTransfer(
  'trf_xxxxxxxxxxxxx',
  'delivery_confirmed'
);
```

#### Reverse Transfer
```typescript
// Reverse for order cancellation
await routeService.reverseTransfer(
  'trf_xxxxxxxxxxxxx',
  'Order cancelled by customer'
);
```

### TDS Rates
- **With PAN**: 0%
- **Without PAN**: 1%

### Redis Keys
- `linked_account:vendor:{vendor_id}` - Vendor's linked account
- `transfer:{id}` - Transfer record
- `transfer:razorpay:{razorpay_transfer_id}` - Transfer by Razorpay ID
- `transfer:vendor:{vendor_id}:{transfer_id}` - Vendor's transfers
- `transfer:order:{order_id}:{transfer_id}` - Order's transfers

---

## COD Service

### Location
`backend/src/services/payment/cod.service.ts`

### Features
- Pincode serviceability check
- Customer risk scoring
- COD limits based on customer history
- Remittance tracking and reconciliation
- Risk profile updates

### Risk Scoring

```
Risk Score Calculation:
- Base Score: 50 (medium risk)
- Successful Orders: -5 per order (max -30)
- Failed Orders: +10 per order (max +40)
- Return Rate: +20 per 100% return rate

Risk Levels:
- Low: 0-29
- Medium: 30-69
- High: 70-100
```

### COD Limits
- **New Customers**: ₹2,000
- **Trusted Customers** (3+ successful orders): ₹10,000
- **High Risk**: COD disabled

### Usage Examples

#### Validate COD Availability
```typescript
import CODService from './services/payment/cod.service';

const codService = CODService.getInstance();

const result = await codService.validateCODAvailability(
  '400001',    // Pincode
  200000,      // Order value (₹2000 in paise)
  'cust_123'   // Customer ID
);

// Returns: { available, reason?, max_cod_value?, delivery_charges? }
```

#### Record COD Remittance
```typescript
const remittance = await codService.recordCODRemittance(
  'order_123',         // Order ID
  'vendor_789',        // Vendor ID
  200000,              // Amount collected
  'Delhivery',        // Logistics partner
  'AWB123456'         // AWB number
);
```

#### Update Risk Profile
```typescript
// After successful delivery
await codService.updateCustomerRiskProfile(
  'cust_123',
  true,    // Order completed
  false    // Not returned
);
```

### Redis Keys
- `customer:risk:{customer_id}` - Customer risk profile (24h cache)
- `pincode:serviceable:{pincode}` - Pincode serviceability (7 days cache)
- `cod:remittance:{id}` - Remittance record
- `cod:remittance:order:{order_id}` - Remittance by order
- `cod:remittance:vendor:{vendor_id}:{id}` - Vendor's remittances

---

## Webhook Handler

### Location
`backend/src/api/webhooks/razorpay.ts`

### Supported Events
1. `payment.captured` - Payment successful
2. `payment.failed` - Payment failed
3. `transfer.processed` - Vendor transfer successful
4. `transfer.failed` - Vendor transfer failed
5. `refund.processed` - Refund successful
6. `order.paid` - Order fully paid

### Features
- Signature verification
- Idempotent processing (duplicate detection)
- Automatic transfer creation on payment
- Transfer reversal on refund
- Event logging with 7-day retention

### Setup Webhook URL

```
POST https://yourdomain.com/api/webhooks/razorpay

Headers:
- X-Razorpay-Signature: <signature>
- Content-Type: application/json

Body: Razorpay webhook payload
```

### Integration

```typescript
// In your main router file (index.ts)
import razorpayWebhook from './api/webhooks/razorpay';

app.use('/api/webhooks', razorpayWebhook);
```

### Event Processing Flow

```
1. Receive webhook → Verify signature
2. Check duplicate → Skip if already processed
3. Mark as received → Store in Redis
4. Process event → Execute business logic
5. Mark as processed → Store result
6. Return 200 OK → Confirm to Razorpay
```

### Redis Keys
- `webhook:event:{event}:{entity_id}` - Event deduplication (7 days)
- `transfer:failure:{transfer_id}` - Failed transfers (30 days)

---

## Payout Automation

### Location
`backend/src/services/payment/payout.service.ts`

### Features
- Period-based payout calculation
- Scheduled payouts (daily, weekly, monthly)
- Text-based report generation
- Minimum payout threshold
- Payout history tracking

### Usage Examples

#### Calculate Payouts
```typescript
import PayoutService from './services/payment/payout.service';

const payoutService = PayoutService.getInstance();

const calculation = await payoutService.calculateVendorPayouts(
  'vendor_123',
  new Date('2024-01-01'),
  new Date('2024-01-31')
);

// Returns: VendorPayoutCalculation with all details
```

#### Schedule Automatic Payouts
```typescript
const schedule = await payoutService.schedulePayouts(
  'vendor_123',
  'weekly',    // daily | weekly | biweekly | monthly
  100000       // Minimum amount (₹1000)
);
```

#### Generate Payout Report
```typescript
const report = await payoutService.generatePayoutReport(
  'vendor_123',
  new Date('2024-01-01'),
  new Date('2024-01-31'),
  'detailed'   // 'summary' | 'detailed'
);

// Report saved to: backend/reports/payouts/payout_vendor_123_2024-01-01_2024-01-31.txt
```

#### Process Scheduled Payouts (Cron Job)
```typescript
// Run this from a cron job or scheduler
await payoutService.processScheduledPayouts();
```

### Report Format

```
===============================================
         VENDOR PAYOUT REPORT
===============================================

Period: 1/1/2024 to 1/31/2024
Vendor ID: vendor_123
Generated: 2/1/2024, 10:00:00 AM

-----------------------------------------------
SUMMARY
-----------------------------------------------
Total Orders: 10
Total Sales: ₹10,000.00
Commission: ₹1,000.00
TDS: ₹0.00
-----------------------------------------------
NET PAYOUT: ₹9,000.00
-----------------------------------------------

-----------------------------------------------
ORDER DETAILS
-----------------------------------------------

1. Order ID: order_123
   Date: 1/15/2024
   Amount: ₹1,000.00
   Commission (10%): ₹100.00
   TDS: ₹0.00
   Net: ₹900.00
   Transfer Status: processed

...
```

### Cron Job Setup

```javascript
// Example using node-cron
import cron from 'node-cron';
import PayoutService from './services/payment/payout.service';

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Processing scheduled payouts...');
  const payoutService = PayoutService.getInstance();
  await payoutService.processScheduledPayouts();
});
```

### Redis Keys
- `payout:calculation:vendor:{vendor_id}:{calculation_id}` - Calculations (1 year)
- `payout:schedule:vendor:{vendor_id}` - Payout schedule
- `payout:report:{report_id}` - Report metadata (1 year)
- `payout:cod:{payout_id}` - COD payout entries

---

## API Endpoints

### Payment Endpoints

```typescript
// Create Order
POST /api/payments/orders
Body: { amount, currency, notes }
Response: Order object

// Verify Payment
POST /api/payments/verify
Body: { order_id, payment_id, signature }
Response: { verified: boolean, payment }

// Refund Payment
POST /api/payments/refund
Body: { payment_id, amount?, reason }
Response: Refund object
```

### Vendor Endpoints

```typescript
// Create Linked Account
POST /api/vendors/{vendor_id}/linked-account
Body: Vendor details
Response: Linked account object

// Create Transfer
POST /api/vendors/{vendor_id}/transfers
Body: { payment_id, order_id, amount, commission_rate, on_hold }
Response: Transfer object

// Get Vendor Transfers
GET /api/vendors/{vendor_id}/transfers
Response: Array of transfers

// Release Transfer
POST /api/vendors/transfers/{transfer_id}/release
Response: Updated transfer
```

### COD Endpoints

```typescript
// Validate COD
POST /api/cod/validate
Body: { pincode, order_value, customer_id }
Response: { available, reason?, max_cod_value?, delivery_charges? }

// Record Remittance
POST /api/cod/remittance
Body: { order_id, vendor_id, amount, logistics_partner, awb_number }
Response: Remittance object

// Get COD Statistics
GET /api/cod/statistics?vendor_id={vendor_id}
Response: Statistics object
```

### Payout Endpoints

```typescript
// Calculate Payouts
POST /api/payouts/calculate
Body: { vendor_id, period_start, period_end }
Response: Calculation object

// Schedule Payouts
POST /api/payouts/schedule
Body: { vendor_id, frequency, minimum_amount }
Response: Schedule object

// Generate Report
POST /api/payouts/report
Body: { vendor_id, period_start, period_end, report_type }
Response: Report object with file_path

// Get Payout History
GET /api/payouts/history?vendor_id={vendor_id}&limit=50
Response: Array of calculations
```

---

## Testing

### Unit Tests

Create test file: `backend/src/__tests__/payment.test.ts`

```typescript
import { PaymentService } from '../services/payment/payment.service';
import { RouteService } from '../services/payment/route.service';

describe('Payment Service', () => {
  let paymentService: PaymentService;

  beforeAll(() => {
    paymentService = PaymentService.getInstance();
  });

  test('should create order', async () => {
    const order = await paymentService.createOrder(50000, 'INR', {});
    expect(order).toHaveProperty('razorpay_order_id');
    expect(order.amount).toBe(50000);
  });

  test('should verify payment signature', async () => {
    // Test signature verification logic
  });
});

describe('Route Service', () => {
  let routeService: RouteService;

  beforeAll(() => {
    routeService = RouteService.getInstance();
  });

  test('should calculate splits correctly', () => {
    const splits = routeService.calculateSplits(100000, 10, true);
    
    expect(splits.commission_amount).toBe(10000);
    expect(splits.tds_amount).toBe(0);
    expect(splits.vendor_amount).toBe(90000);
  });

  test('should apply TDS for vendors without PAN', () => {
    const splits = routeService.calculateSplits(100000, 10, false);
    
    expect(splits.tds_amount).toBe(1000); // 1% TDS
    expect(splits.vendor_amount).toBe(89000);
  });
});

describe('COD Service', () => {
  test('should validate COD for serviceable pincode', async () => {
    // Test COD validation
  });

  test('should calculate risk score correctly', () => {
    // Test risk scoring
  });
});
```

### Run Tests

```bash
npm test
```

---

## Security

### Signature Verification

All webhooks and payment verifications use HMAC SHA256 with timing-safe comparison:

```typescript
import crypto from 'crypto';

const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');

// Timing-safe comparison
const isValid = crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expectedSignature)
);
```

### Replay Attack Prevention

Webhooks are validated within a 5-minute window:

```typescript
const timestamp = parseInt(body.created_at);
const currentTime = Math.floor(Date.now() / 1000);

if (Math.abs(currentTime - timestamp) > 300) {
  throw new Error('Webhook timestamp too old');
}
```

### Idempotent Processing

All webhook events are deduplicated using Redis:

```typescript
const eventKey = `webhook:event:${event}:${entity_id}`;
const exists = await redis.exists(eventKey);

if (exists) {
  return { status: 'duplicate' };
}

await redis.set(eventKey, JSON.stringify(event), 'EX', 86400 * 7);
```

### Environment Variables

Never commit sensitive credentials. Use `.env` file:

```bash
# .gitignore
.env
.env.local
.env.*.local
```

---

## Error Handling

### Retry Logic

Exponential backoff for API calls:

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      // Don't retry client errors (4xx)
      if (error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }
      
      if (i === maxRetries - 1) throw error;
      
      const delay = delayMs * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Transaction Logging

All operations are logged for 30 days:

```typescript
await logTransaction('payment_created', {
  order_id,
  payment_id,
  amount,
  timestamp: new Date()
});
```

---

## Production Checklist

- [ ] Configure production Razorpay credentials
- [ ] Set up webhook URL in Razorpay Dashboard
- [ ] Configure Redis persistence
- [ ] Set up cron job for scheduled payouts
- [ ] Enable transaction logging
- [ ] Configure backup strategy for Redis
- [ ] Set up monitoring and alerts
- [ ] Test webhook signature validation
- [ ] Verify commission calculations
- [ ] Test refund and reversal flows
- [ ] Configure SSL for webhook endpoint
- [ ] Set up rate limiting
- [ ] Enable Redis clustering (if needed)
- [ ] Configure log rotation
- [ ] Set up error tracking (e.g., Sentry)

---

## Support & Resources

### Razorpay Documentation
- [API Documentation](https://razorpay.com/docs/api/)
- [Route API](https://razorpay.com/docs/route/)
- [Webhooks](https://razorpay.com/docs/webhooks/)

### Internal Documentation
- Payment Service: `backend/src/services/payment/payment.service.ts`
- Route Service: `backend/src/services/payment/route.service.ts`
- COD Service: `backend/src/services/payment/cod.service.ts`
- Webhook Handler: `backend/src/api/webhooks/razorpay.ts`
- Payout Service: `backend/src/services/payment/payout.service.ts`

---

## License

Copyright © 2024 BazaarHub. All rights reserved.
