# End-to-End Testing Guide

This guide outlines the steps to manually verify the complete flow of the BazaarHub application, from Vendor Registration to Payout.

## Prerequisites

1.  Ensure all services are running:
    ```bash
    docker-compose up -d
    ```
2.  Add the following to your `/etc/hosts` file (for local Nginx routing):
    ```
    127.0.0.1 vendor.localhost
    127.0.0.1 admin.localhost
    ```

## Test Scenarios

### 1. Vendor Registration & Approval
*   **Actor**: Vendor
*   **URL**: `http://vendor.localhost/register` (or `http://localhost:3002/register`)
*   **Steps**:
    1.  Fill out the registration form.
    2.  Upload KYC documents (PAN, GSTIN).
    3.  Submit.
*   **Actor**: Admin
*   **URL**: `http://admin.localhost/dashboard/kyc` (or `http://localhost:3003/dashboard/kyc`)
*   **Steps**:
    1.  Login as Admin.
    2.  View the new KYC request.
    3.  Click "Approve".

### 2. Product Listing
*   **Actor**: Vendor
*   **URL**: `http://vendor.localhost/dashboard/products/create`
*   **Steps**:
    1.  Login as Vendor.
    2.  Create a new product (Title, Price, Description, Images).
    3.  Submit.
*   **Verification**:
    *   Check `http://localhost/` (Storefront). The product should appear in "Featured Products" or Search.

### 3. Customer Purchase
*   **Actor**: Customer
*   **URL**: `http://localhost/`
*   **Steps**:
    1.  Search for the product.
    2.  Click on the product to view details.
    3.  Add to Cart.
    4.  Proceed to Checkout.
    5.  Login/Register as Customer.
    6.  Enter Shipping Address.
    7.  Pay using Razorpay (Test Mode).
*   **Verification**:
    *   Customer is redirected to Order History.
    *   Order status is "Pending" or "Processing".

### 4. Order Fulfillment
*   **Actor**: Vendor
*   **URL**: `http://vendor.localhost/dashboard/orders`
*   **Steps**:
    1.  View the new order.
    2.  Mark as "Shipped".
    3.  Mark as "Delivered".

### 5. Payouts
*   **Actor**: Vendor
*   **URL**: `http://vendor.localhost/dashboard/earnings`
*   **Steps**:
    1.  Verify the sale amount is reflected.
    2.  Check "Net Payout" calculation (Price - Commission).

## Troubleshooting

*   **Services not starting**: Check `docker-compose logs -f`.
*   **Elasticsearch issues**: Ensure `vm.max_map_count` is set to at least 262144 on the host.
*   **Payment failures**: Verify Razorpay Test Keys in `.env`.
