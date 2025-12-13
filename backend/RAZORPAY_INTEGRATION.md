# Razorpay Payment Gateway Integration

Complete Razorpay integration for MercurJS multivendor marketplace, replacing Stripe Connect with Indian payment methods.

## Features

### 1. **Payment Methods Supported**
- ✅ **UPI** (Google Pay, PhonePe, Paytm, BHIM)
- ✅ **Cards** (Credit/Debit - Visa, Mastercard, RuPay, Amex)
- ✅ **Net Banking** (All major Indian banks)
- ✅ **Wallets** (Paytm, PhonePe, Mobikwik, Freecharge, etc.)
- ✅ **EMI Options** (3, 6, 9, 12 months)
- ✅ **Cardless EMI** (ZestMoney, FlexMoney)

### 2. **Automatic Features**
- ✅ **Webhook Handlers** for all payment events
- ✅ **Automatic Retries** for failed payments (up to 3 attempts)
- ✅ **Payment Method Tracking** and analytics
- ✅ **Popular Payment Methods** display
- ✅ **Signature Verification** for security
- ✅ **Refund Support** with tracking

### 3. **Analytics & Insights**
- Payment success/failure rates
- Popular payment methods
- Average transaction value
- Retry attempts tracking
- Method-wise performance

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MercurJS Backend                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐        ┌──────────────────────────────┐   │
│  │   Customer   │───────▶│    Razorpay Checkout         │   │
│  │   Frontend   │        │    (Standard Checkout)        │   │
│  └──────────────┘        └──────────────────────────────┘   │
│         │                              │                     │
│         │                              ▼                     │
│         │                   ┌────────────────────┐          │
│         └──────────────────▶│  Razorpay Service  │          │
│                             │  • Create Order    │          │
│                             │  • Verify Payment  │          │
│                             │  • Handle Refunds  │          │
│                             │  • Track Methods   │          │
│                             └────────────────────┘          │
│                                       │                      │
│                             ┌────────────────────┐          │
│                             │  Webhook Handler   │          │
│                             │  • payment.success │          │
│                             │  • payment.failed  │          │
│                             │  • refund.created  │          │
│                             └────────────────────┘          │
│                                       │                      │
│                             ┌────────────────────┐          │
│                             │   Redis Storage    │          │
│                             │  • Preferences     │          │
│                             │  • Retry Tracking  │          │
│                             └────────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Get Razorpay Credentials

1. Sign up at [https://razorpay.com](https://razorpay.com)
2. Get your **Key ID** and **Key Secret** from the Dashboard
3. Generate a **Webhook Secret** for webhook verification

### 2. Configure Environment Variables

Add to your `.env` file:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

### 3. Configure Webhooks

1. Go to Razorpay Dashboard → Settings → Webhooks
2. Add webhook URL: `https://yourdomain.com/api/payment/webhook`
3. Select events:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `refund.created`
   - `refund.processed`
   - `order.paid`

## API Endpoints

### 1. Create Order

**POST** `/api/payment/create-order`

Create a Razorpay order for checkout.

**Request Body:**
```json
{
  "amount": 1000.00,
  "currency": "INR",
  "receipt": "order_rcpt_123",
  "notes": {
    "customer_name": "John Doe",
    "order_id": "ORD123"
  },
  "partial_payment": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "order_xxxxxxxxxxxxx",
    "amount": 100000,
    "currency": "INR",
    "key_id": "rzp_test_xxxxxxxxxxxxx"
  }
}
```

### 2. Verify Payment

**POST** `/api/payment/verify`

Verify payment signature after payment completion.

**Request Body:**
```json
{
  "order_id": "order_xxxxxxxxxxxxx",
  "payment_id": "pay_xxxxxxxxxxxxx",
  "signature": "xxxxxxxxxxxxxxxxxxxxx"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "payment_id": "pay_xxxxxxxxxxxxx",
    "order_id": "order_xxxxxxxxxxxxx",
    "amount": 1000.00,
    "method": "upi",
    "status": "captured"
  }
}
```

### 3. Get Payment Details

**GET** `/api/payment/details/:paymentId`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pay_xxxxxxxxxxxxx",
    "order_id": "order_xxxxxxxxxxxxx",
    "amount": 1000.00,
    "currency": "INR",
    "status": "captured",
    "method": "upi",
    "email": "customer@example.com",
    "contact": "+919876543210",
    "fee": 23.60,
    "tax": 4.25,
    "created_at": "2025-12-07T10:30:00.000Z"
  }
}
```

### 4. Create Refund

**POST** `/api/payment/refund`

**Request Body:**
```json
{
  "payment_id": "pay_xxxxxxxxxxxxx",
  "amount": 500.00,
  "notes": {
    "reason": "Customer requested refund",
    "refund_type": "partial"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Refund initiated successfully",
  "data": {
    "refund_id": "rfnd_xxxxxxxxxxxxx",
    "payment_id": "pay_xxxxxxxxxxxxx",
    "amount": 500.00,
    "status": "processed",
    "created_at": "2025-12-07T11:00:00.000Z"
  }
}
```

### 5. Get Refund Details

**GET** `/api/payment/refund/:refundId`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "rfnd_xxxxxxxxxxxxx",
    "payment_id": "pay_xxxxxxxxxxxxx",
    "amount": 500.00,
    "currency": "INR",
    "status": "processed",
    "created_at": "2025-12-07T11:00:00.000Z"
  }
}
```

### 6. Get Payment Method Preferences

**GET** `/api/payment/preferences`

Get analytics on payment method usage.

**Response:**
```json
{
  "success": true,
  "data": {
    "preferences": [
      {
        "method": "upi",
        "count": 1523,
        "success_rate": "94.50%",
        "avg_amount": "850.25"
      },
      {
        "method": "card",
        "count": 892,
        "success_rate": "91.20%",
        "avg_amount": "1450.75"
      },
      {
        "method": "netbanking",
        "count": 456,
        "success_rate": "89.80%",
        "avg_amount": "2100.50"
      }
    ]
  }
}
```

### 7. Get Popular Payment Methods

**GET** `/api/payment/popular-methods?limit=5`

Get the most popular payment methods for Indian customers.

**Response:**
```json
{
  "success": true,
  "data": {
    "popular_methods": [
      {
        "method": "upi",
        "label": "UPI (Google Pay, PhonePe, Paytm)"
      },
      {
        "method": "card",
        "label": "Credit/Debit Card"
      },
      {
        "method": "netbanking",
        "label": "Net Banking"
      },
      {
        "method": "wallet",
        "label": "Wallets (Paytm, PhonePe)"
      },
      {
        "method": "emi",
        "label": "EMI Options"
      }
    ]
  }
}
```

### 8. Get Payment Statistics

**GET** `/api/payment/statistics`

Get comprehensive payment statistics (admin only).

**Response:**
```json
{
  "success": true,
  "data": {
    "total_payments": 2871,
    "successful_payments": 2650,
    "failed_payments": 221,
    "success_rate": "92.30%",
    "total_amount": "3250000.00",
    "avg_transaction_value": "1132.15",
    "payment_methods": [...]
  }
}
```

### 9. Check Retry Status

**GET** `/api/payment/retry-status/:orderId`

Check if a failed payment can be retried.

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "order_xxxxxxxxxxxxx",
    "can_retry": true,
    "attempts": 1,
    "max_attempts": 3,
    "remaining_attempts": 2
  }
}
```

### 10. Webhook Endpoint

**POST** `/api/payment/webhook`

Receives webhook events from Razorpay (called automatically by Razorpay servers).

## Frontend Integration

### React/Next.js Example

```javascript
import React, { useState } from 'react';

function RazorpayCheckout() {
  const [loading, setLoading] = useState(false);

  const handlePayment = async (orderAmount, orderDetails) => {
    setLoading(true);

    try {
      // Step 1: Create order on your backend
      const orderResponse = await fetch('http://localhost:3001/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: orderAmount,
          currency: 'INR',
          receipt: `order_${Date.now()}`,
          notes: orderDetails,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderData.success) {
        throw new Error('Failed to create order');
      }

      // Step 2: Configure Razorpay checkout
      const options = {
        key: orderData.data.key_id,
        amount: orderData.data.amount,
        currency: orderData.data.currency,
        name: 'MercurJS Marketplace',
        description: 'Order Payment',
        order_id: orderData.data.order_id,
        
        // Customer details
        prefill: {
          name: 'Customer Name',
          email: 'customer@example.com',
          contact: '+919876543210',
        },

        // Payment methods configuration
        config: {
          display: {
            preferences: {
              show_default_blocks: true, // Show all payment methods
            },
          },
        },

        // Theme
        theme: {
          color: '#3399cc',
        },

        // Success handler
        handler: async function (response) {
          // Step 3: Verify payment on your backend
          const verifyResponse = await fetch('http://localhost:3001/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          });

          const verifyData = await verifyResponse.json();

          if (verifyData.success) {
            alert('Payment successful!');
            // Redirect to success page
            window.location.href = '/order-success';
          } else {
            alert('Payment verification failed!');
          }
        },

        // Modal closed handler
        modal: {
          ondismiss: function () {
            alert('Payment cancelled');
            setLoading(false);
          },
        },
      };

      // Step 4: Open Razorpay checkout
      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to initiate payment');
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={() => handlePayment(1000, { product: 'Test Product' })}
      disabled={loading}
    >
      {loading ? 'Processing...' : 'Pay ₹1000'}
    </button>
  );
}

export default RazorpayCheckout;
```

### Include Razorpay Script

Add this to your HTML head:

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

Or install via npm:

```bash
npm install react-razorpay
```

## Webhook Events

### payment.authorized
Payment has been authorized but not captured. Use auto-capture or manually capture later.

### payment.captured / payment.success
Payment successfully captured. Update order status to "paid" and trigger fulfillment.

### payment.failed
Payment attempt failed. System automatically tracks retry attempts (max 3).

**Actions:**
- Retry count incremented
- Customer notified if retry available
- Admin notified if max retries reached

### refund.created
Refund has been initiated.

### refund.processed
Refund successfully processed and money returned to customer.

### refund.failed
Refund failed. Manual intervention required.

## Automatic Retry Logic

The system automatically handles payment failures:

1. **First Failure**: Retry allowed immediately
2. **Second Failure**: Retry allowed after 5 minutes (recommended)
3. **Third Failure**: Final retry attempt
4. **After 3 Failures**: Order marked as "payment_failed", manual intervention required

Check retry status:
```bash
curl http://localhost:3001/api/payment/retry-status/order_xxxxxxxxxxxxx
```

## Payment Method Tracking

The system automatically tracks:

- **Usage Count**: How many times each method is used
- **Success Rate**: Percentage of successful payments per method
- **Average Amount**: Average transaction value per method

This data powers:
- Popular payment methods display
- Payment analytics dashboard
- Method performance insights

## Security

### Signature Verification

All payments are verified using HMAC SHA256 signature:

```
signature = hmac_sha256(order_id + "|" + payment_id, secret_key)
```

### Webhook Verification

Webhooks are verified using:

```
expected_signature = hmac_sha256(webhook_body, webhook_secret)
```

## Testing

### Test Cards

**Credit Cards:**
- **Success**: 4111 1111 1111 1111
- **Failure**: 4000 0000 0000 0002

**CVV**: Any 3 digits  
**Expiry**: Any future date

### Test UPI

**UPI ID**: `success@razorpay`

### Test Modes

1. **Test Mode**: Use test credentials (rzp_test_xxx)
2. **Live Mode**: Use live credentials (rzp_live_xxx)

## Common Use Cases

### 1. Standard Checkout
```javascript
// Create order → Open Razorpay → Verify payment → Complete order
```

### 2. Partial Payments
```javascript
{
  "amount": 10000,
  "partial_payment": true,
  // Customer can pay minimum 50% upfront
}
```

### 3. Subscription Payments
Use Razorpay Plans and Subscriptions API (requires separate integration).

### 4. Split Payments (Marketplace)
Use Razorpay Route API to split payments between vendors (requires separate integration).

## Monitoring & Analytics

### Key Metrics

1. **Payment Success Rate**: Track overall success rate
2. **Method Performance**: Which methods have higher success rates
3. **Average Transaction Value**: Understand customer spending
4. **Retry Success Rate**: How often retries succeed
5. **Refund Rate**: Track refund frequency

### Dashboard Queries

```bash
# Get statistics
curl http://localhost:3001/api/payment/statistics

# Get popular methods
curl http://localhost:3001/api/payment/popular-methods

# Get preferences
curl http://localhost:3001/api/payment/preferences
```

## Troubleshooting

### Payment Verification Failed

**Cause**: Invalid signature  
**Solution**: Check RAZORPAY_KEY_SECRET is correct

### Webhook Not Received

**Cause**: Incorrect webhook URL or signature  
**Solution**: 
1. Verify webhook URL in Razorpay Dashboard
2. Check RAZORPAY_WEBHOOK_SECRET

### Payment Fails Repeatedly

**Cause**: Various (card declined, insufficient funds, etc.)  
**Solution**:
1. Check error_description in payment object
2. Suggest alternative payment methods
3. Contact Razorpay support for persistent issues

## Compliance & Regulations

### PCI DSS Compliance
Razorpay is PCI DSS Level 1 certified. You don't handle card data directly.

### RBI Guidelines
Razorpay complies with all RBI guidelines for payment aggregators.

### Data Storage
- **DO NOT** store card numbers, CVV, or OTP
- Store only: payment_id, order_id, status, method

## Production Checklist

- [ ] Switch to live Razorpay credentials
- [ ] Configure webhooks with production URL
- [ ] Enable required payment methods in Razorpay Dashboard
- [ ] Test all payment methods in live mode
- [ ] Set up monitoring and alerts
- [ ] Configure refund policies
- [ ] Train support team on payment issues
- [ ] Set up automatic settlement reconciliation

## Support

### Razorpay Support
- Dashboard: https://dashboard.razorpay.com
- Docs: https://razorpay.com/docs
- Support: support@razorpay.com

### Common Issues
- **Integration**: Check Razorpay docs
- **Webhooks**: Test using Razorpay webhook simulator
- **Refunds**: Process within 7 days for instant refunds

## Future Enhancements

- [ ] Razorpay Route integration for marketplace splits
- [ ] Subscription support for recurring payments
- [ ] QR Code payments for offline stores
- [ ] Payment links for easy sharing
- [ ] Smart collect for automated bank transfers
- [ ] International card support

## License

MIT
