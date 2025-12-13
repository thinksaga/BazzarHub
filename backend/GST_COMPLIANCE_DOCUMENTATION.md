# GST Compliance Module Documentation

## Overview

Complete GST (Goods and Services Tax) compliance system for BazaarHub marketplace with support for:
- GST calculation (CGST+SGST for same state, IGST for different states)
- Invoice generation with tax breakdowns
- GST return filing (GSTR-1, GSTR-3B)
- TDS (Tax Deducted at Source) tracking
- Compliance validation middleware
- Audit trails and reporting

## Table of Contents

1. [GST Calculation Service](#gst-calculation-service)
2. [Invoice Generation](#invoice-generation)
3. [GST Reports](#gst-reports)
4. [TDS Calculation](#tds-calculation)
5. [Compliance Middleware](#compliance-middleware)
6. [Test Cases](#test-cases)
7. [API Integration](#api-integration)

---

## GST Calculation Service

### Location
`backend/src/services/gst.service.ts`

### Key Features

#### 1. Calculate GST
```typescript
const gstService = GSTService.getInstance();

// Calculate GST for a product
const calculation = await gstService.calculateGST(
  'product_123',
  100000,      // Base price (₹1000 in paise)
  'maharashtra',
  'maharashtra'
);

// Returns:
// {
//   product_id: 'product_123',
//   hsn_code: '8517',
//   gst_rate: 12,
//   buyer_state: 'maharashtra',
//   seller_state: 'maharashtra',
//   tax_type: 'cgst_sgst',
//   base_price: 100000,
//   cgst_amount: 6000,    // 6% = 12% / 2
//   sgst_amount: 6000,    // 6% = 12% / 2
//   igst_amount: undefined,
//   total_tax: 12000,
//   total_price: 112000,
//   calculated_at: Date
// }
```

#### 2. Tax Type Logic

**Same State (Maharashtra → Maharashtra):**
```
GST Rate: 12%
CGST (Central): 6%
SGST (State): 6%
Total Tax: 12%
```

**Different State (Maharashtra → Delhi):**
```
GST Rate: 12%
IGST (Integrated): 12%
Total Tax: 12%
```

#### 3. GST Rates by Category

| Category | HSN Code | GST Rate | Notes |
|----------|----------|----------|-------|
| Books | 4901 | 0% | Exempt |
| Food Items | 1905, 2009 | 5% | Essentials |
| Clothing | 6203, 6204 | 5% | Apparel |
| Electronics | 8517, 8471 | 12% | Gadgets |
| Cosmetics | 3304 | 18% | Beauty |
| Furniture | 9403 | 12% | Furnishings |

#### 4. GSTIN Validation

```typescript
// Validate GSTIN format and checksum
const validation = gstService.validateGSTIN('27BSPAUL007D1Z5');

// Returns:
// {
//   valid: true,
//   gstin: '27BSPAUL007D1Z5',
//   format_valid: true,
//   checksum_valid: true,
//   state_code: '27',
//   error: undefined
// }
```

**GSTIN Format:**
- 2 characters: State code (01-37)
- 10 characters: PAN (Permanent Account Number)
- 1 character: Entity type (Z, C, S, H, A, B, G, J, F, P, T, N, E, U, D, etc.)
- 1 character: Check digit (Verhoeff algorithm)

**Valid State Codes:**
```
27: Maharashtra
28: Andhra Pradesh
07: Delhi
06: Haryana
29: Karnataka
32: Kerala
33: Tamil Nadu
36: Telangana
19: West Bengal
```

#### 5. HSN Code Management

```typescript
// Get HSN code by category
const mapping = await gstService.getHSNCodeByCategory('electronics');
// Returns: { category: 'electronics', hsn_code: '8517', description: 'Mobile phones', standard_rate: 12 }

// Set HSN code for product
await gstService.setProductHSNCode('prod_123', '8517');

// Get all HSN mappings
const allMappings = gstService.getAllHSNMappings();
```

#### 6. Batch Processing

```typescript
// Calculate GST for multiple items
const items = [
  {
    product_id: 'prod_1',
    quantity: 2,
    unit_price: 50000,
    buyer_state: 'maharashtra',
    seller_state: 'maharashtra'
  },
  {
    product_id: 'prod_2',
    quantity: 1,
    unit_price: 100000,
    buyer_state: 'maharashtra',
    seller_state: 'delhi'
  }
];

const calculations = await gstService.calculateGSTBatch(items);
```

---

## Invoice Generation

### Location
`backend/src/services/invoice.service.ts`

### Invoice Number Format

```
VENDOR_ID/FY/SEQUENCE

Example: VENDOR123/2024-25/00001
```

**Components:**
- `VENDOR_ID`: Unique vendor identifier
- `FY`: Fiscal year (April to March)
  - April 2024 → "2024-25"
  - December 2023 → "2023-24"
- `SEQUENCE`: Zero-padded sequence number (00001, 00002, ...)

### Generate Invoice

```typescript
const invoiceService = InvoiceService.getInstance();

const invoice = await invoiceService.generateInvoice('order_123');

// Returns:
// {
//   id: 'uuid',
//   invoice_number: 'VENDOR123/2024-25/00001',
//   invoice_date: Date,
//   order_id: 'order_123',
//   vendor_id: 'vendor_123',
//   vendor_name: 'Business Name',
//   vendor_gstin: '27BSPAUL007D1Z5',
//   vendor_address: '...',
//   customer_id: 'cust_456',
//   customer_name: 'Customer Name',
//   customer_gstin: '07AABCU9603R1Z0',  // Optional for B2C
//   shipping_address: '...',
//   line_items: [
//     {
//       order_item_id: 'item_1',
//       product_id: 'prod_1',
//       product_name: 'Product Name',
//       hsn_code: '8517',
//       quantity: 2,
//       unit_price: 50000,
//       taxable_value: 100000,
//       gst_rate: 12,
//       cgst_amount: 6000,
//       sgst_amount: 6000,
//       igst_amount: undefined,
//       total_amount: 112000
//     }
//   ],
//   taxable_value: 100000,
//   cgst_total: 6000,
//   sgst_total: 6000,
//   igst_total: 0,
//   gross_total: 112000,
//   bank_details: {...},
//   created_at: Date,
//   status: 'generated',
//   file_path: '/path/to/invoice.txt',
//   pdf_url: '/invoices/VENDOR123_2024-25_00001.txt'
// }
```

### Invoice Types

**B2B Invoice** (Business to Business)
- Buyer has valid GSTIN
- Includes buyer's GSTIN on invoice
- Separate invoice numbering for audit
- Used for ITC (Input Tax Credit) claims

**B2C Large Invoice** (Business to Consumer, >₹2500)
- Buyer typically doesn't have GSTIN
- Shows buyer details
- Separate reporting requirement

**B2C Small Invoice** (Business to Consumer, <₹2500)
- Consolidated in GST reports
- Simplified invoice format
- Grouped in GSTR-1 as consolidated supply

### Send Invoice Email

```typescript
// Send invoice to customer (CC vendor)
const result = await invoiceService.sendInvoiceEmail('order_123');

// Returns:
// {
//   success: true,
//   message: 'Invoice VENDOR123/2024-25/00001 sent successfully'
// }
```

### Bulk Invoice Generation

```typescript
// Generate invoices for multiple orders
const orderIds = ['order_1', 'order_2', 'order_3'];
const invoices = await invoiceService.generateInvoicesBatch(orderIds);

// Returns array of generated invoices
```

### Invoice Statistics

```typescript
// Get invoice statistics for vendor
const stats = await invoiceService.getInvoiceStatistics(
  'vendor_123',
  1,    // Month (Jan)
  2024  // Year
);

// Returns:
// {
//   total_invoices: 45,
//   total_taxable_value: 450000000,  // ₹45 lakhs
//   total_cgst: 27000000,             // CGST
//   total_sgst: 27000000,             // SGST
//   total_igst: 5400000,              // IGST
//   total_gross: 510400000            // Total with tax
// }
```

---

## GST Reports

### Location
`backend/src/services/gst-reports.service.ts`

### GSTR-1 (Outward Supplies Report)

**Categories:**
1. **B2B Invoices**: All invoices with customer GSTIN
2. **B2C Large**: >₹2,500 invoices without GSTIN
3. **B2C Small**: Consolidated <₹2,500 invoices

```typescript
const gstReportsService = GSTReportsService.getInstance();

const gstr1 = await gstReportsService.generateGSTR1(
  'vendor_123',
  1,     // Month
  2024   // Year
);

// Returns:
// {
//   id: 'uuid',
//   vendor_id: 'vendor_123',
//   month: 1,
//   year: 2024,
//   b2b_invoices: [...],        // Array of B2B records
//   b2c_large_invoices: [...],  // Array of B2C large records
//   b2c_small_invoices: [...],  // Consolidated B2C small
//   total_b2b_value: 400000000,
//   total_b2b_tax: 48000000,
//   total_b2c_value: 100000000,
//   total_b2c_tax: 18000000,
//   generated_at: Date
// }
```

### GSTR-3B (Summary Return)

Contains outward supplies, ITC, and net tax payable.

```typescript
const gstr3b = await gstReportsService.generateGSTR3B(
  'vendor_123',
  1,     // Month
  2024   // Year
);

// Returns:
// {
//   id: 'uuid',
//   vendor_id: 'vendor_123',
//   month: 1,
//   year: 2024,
//   outward_supplies: 500000000,  // ₹50 lakhs
//   inward_supplies: 100000000,   // ₹10 lakhs (purchases)
//   input_tax_credit: 6000000,    // ITC available
//   tax_payable: 60000000,        // Tax due
//   net_payment: 60000000,        // Amount to be paid
//   generated_at: Date
// }
```

### Download Reports

```typescript
// Export as CSV
const report = await gstReportsService.downloadGSTReport(
  'vendor_123',
  'gstr1',  // 'gstr1' or 'gstr3b'
  1,        // Month
  2024      // Year
);

// Returns:
// {
//   file_path: '/path/to/GSTR1_vendor_123_2024_1.csv',
//   file_name: 'GSTR1_vendor_123_2024_1.csv'
// }
```

### Annual GST Summary

```typescript
const summary = await gstReportsService.getAnnualGSTSummary(
  'vendor_123',
  2024
);

// Returns summary across all 12 months of fiscal year
```

---

## TDS Calculation

### Location
`backend/src/services/tds.service.ts`

### TDS Rates (Section 194O)

**Definition:** Tax Deducted at Source on e-commerce supplies

| Vendor Type | TDS Rate | Threshold |
|-------------|----------|-----------|
| With PAN | 1% | ₹50,000 |
| Without PAN | 5% | ₹50,000 |
| Below threshold | 0% | < ₹50,000 |

### Calculate TDS

```typescript
const tdsService = TDSService.getInstance();

const tds = await tdsService.calculateTDS('vendor_123', 1000000);

// Returns:
// {
//   id: 'uuid',
//   vendor_id: 'vendor_123',
//   payout_amount: 1000000,      // ₹10,000
//   vendor_pan: 'ABCDE1234F',
//   has_pan: true,
//   tds_rate: 1,                 // 1% with PAN
//   tds_amount: 10000,           // 1% of ₹10,000
//   net_payout: 990000,
//   transaction_date: Date,
//   reference_number: 'TDS_1234567890_vendor_123'
// }
```

### Quarterly TDS Report

```typescript
const quarterlyReport = await tdsService.generateQuarterlyTDSReport(
  'vendor_123',
  1,     // Q1 (Apr-Jun)
  2024
);

// Returns:
// {
//   id: 'uuid',
//   vendor_id: 'vendor_123',
//   quarter: 1,
//   year: 2024,
//   total_payouts: 5000000,
//   total_tds: 50000,
//   tds_records: [...],  // All TDS deductions in quarter
//   generated_at: Date
// }
```

### Form 16A Certificate

Generated quarterly for vendor tax records.

```typescript
const certificate = await tdsService.generateForm16A(
  'vendor_123',
  1,     // Q1
  2024
);

// Returns:
// {
//   id: 'uuid',
//   vendor_id: 'vendor_123',
//   certificate_number: '16A_vendor_123_2024_Q1',
//   form_16a_data: {
//     certificate_number: '16A_vendor_123_2024_Q1',
//     financial_year: '2024-25',
//     vendor_name: 'Vendor Name',
//     vendor_pan: 'ABCDE1234F',
//     total_amount: 5000000,
//     total_tds: 50000,
//     period: 'Apr 2024 - Jun 2024',
//     quarterly_tds_records: [...]
//   },
//   file_path: '/path/to/Form_16A_...',
//   generated_at: Date
// }
```

### Annual TDS Summary

```typescript
const summary = await tdsService.getAnnualTDSSummary('vendor_123', 2024);

// Returns summary across all 4 quarters
```

### Download TDS Report

```typescript
const report = await tdsService.downloadTDSReport(
  'vendor_123',
  1,     // Quarter
  2024
);

// Returns CSV file
```

---

## Compliance Middleware

### Location
`backend/src/middleware/gst-compliance.middleware.ts`

### Middleware Functions

#### 1. Validate Product HSN

```typescript
import { validateProductHSN } from '../middleware/gst-compliance.middleware';

// Usage in Express
app.post('/products/publish', validateProductHSN, (req, res) => {
  // req.gstValidation will contain validation data
  // {
  //   hsn_code: '8517',
  //   gst_rate: 12,
  //   cess_rate: 0
  // }
});

// Request body:
// {
//   product_id: 'prod_123',
//   name: 'Mobile Phone',
//   category: 'electronics',
//   hsn_code: '8517',
//   price: 50000,
//   vendor_id: 'vendor_123'
// }
```

#### 2. Verify Vendor GSTIN

```typescript
import { verifyVendorGSTIN } from '../middleware/gst-compliance.middleware';

app.post('/vendors/approve', verifyVendorGSTIN, (req, res) => {
  // req.gstCompliance will contain validation data
  // {
  //   gstin_valid: true,
  //   state_code: '27',
  //   pan_valid: true
  // }
});

// Request body:
// {
//   vendor_id: 'vendor_123',
//   gstin: '27BSPAUL007D1Z5',
//   business_name: 'Business Name',
//   pan: 'ABCDE1234F',
//   address: '...',
//   state: 'maharashtra'
// }
```

#### 3. Validate Order GST Compliance

```typescript
import { validateOrderGSTCompliance } from '../middleware/gst-compliance.middleware';

app.post('/orders', validateOrderGSTCompliance, (req, res) => {
  // req.orderGSTCompliance will contain validation data
});

// Request body:
// {
//   order_id: 'order_123',
//   vendor_id: 'vendor_123',
//   customer_id: 'cust_456',
//   items: [
//     {
//       product_id: 'prod_1',
//       hsn_code: '8517',
//       quantity: 2,
//       price: 50000
//     }
//   ]
// }
```

#### 4. Enforce GST Compliance

```typescript
import { enforceGSTCompliance } from '../middleware/gst-compliance.middleware';

// Blocks orders if GST details are invalid
app.post('/orders/checkout', enforceGSTCompliance, (req, res) => {
  // Only valid orders proceed
});
```

#### 5. Audit GST Compliance

```typescript
import { auditGSTCompliance } from '../middleware/gst-compliance.middleware';

// Logs all GST-related actions for audit trail
app.use(auditGSTCompliance);
```

---

## API Integration Examples

### Create Product with GST

```bash
curl -X POST http://localhost:3001/api/products \
  -H "Content-Type: application/json" \
  -d {
    "product_id": "prod_123",
    "name": "Mobile Phone",
    "category": "electronics",
    "hsn_code": "8517",
    "price": 50000,
    "vendor_id": "vendor_123"
  }
```

### Generate Invoice

```bash
curl -X POST http://localhost:3001/api/invoices/generate \
  -H "Content-Type: application/json" \
  -d {
    "order_id": "order_123"
  }
```

### Generate GST Reports

```bash
# GSTR-1
curl -X POST http://localhost:3001/api/gst-reports/gstr1 \
  -H "Content-Type: application/json" \
  -d {
    "vendor_id": "vendor_123",
    "month": 1,
    "year": 2024
  }

# GSTR-3B
curl -X POST http://localhost:3001/api/gst-reports/gstr3b \
  -H "Content-Type: application/json" \
  -d {
    "vendor_id": "vendor_123",
    "month": 1,
    "year": 2024
  }
```

### Calculate TDS

```bash
curl -X POST http://localhost:3001/api/tds/calculate \
  -H "Content-Type: application/json" \
  -d {
    "vendor_id": "vendor_123",
    "payout_amount": 1000000
  }
```

---

## Error Handling

### GST Calculation Errors

```
Error: HSN code not found for product
- Ensure product has valid HSN code
- HSN codes must be 4-8 digits
- Check HSN code exists in GST database
```

### GSTIN Validation Errors

```
Error: Invalid GSTIN checksum
- GSTIN format must be 15 characters
- First 2 characters must be valid state code
- Checksum (digit 15) must be valid
```

### Invoice Generation Errors

```
Error: Vendor GSTIN invalid
- Vendor must have valid GSTIN before invoice generation
- Customer GSTIN optional (B2C)
- All products must have HSN codes
```

### TDS Calculation Errors

```
Error: Vendor PAN not found
- TDS rate 5% if no PAN
- TDS rate 1% if PAN available
- Check threshold (₹50,000)
```

---

## Compliance Checklist

- ✅ All products have valid HSN codes
- ✅ All vendors have valid GSTIN
- ✅ All invoices include correct tax breakdown
- ✅ TDS calculated for all vendor payouts
- ✅ Quarterly GST reports filed
- ✅ Quarterly TDS certificates issued
- ✅ Audit trail maintained
- ✅ State-wise sales tracked
- ✅ B2B/B2C invoices separated
- ✅ ITC tracked for eligible vendors

---

## Regulatory References

- **GST Act, 2017**: Goods and Services Tax framework
- **IGST Rules**: Inter-state GST rules
- **CGST Rules**: Central GST rules
- **SGST Rules**: State GST rules
- **Section 194O**: TDS on E-commerce supplies
- **GST Council Notifications**: Latest amendments

---

## Testing

Run test cases:

```bash
npm test -- src/__tests__/gst-compliance.test.ts
```

---

## Support

For questions or issues, contact:
- Tax Compliance Team
- Finance Department
- Vendor Support

