/**
 * PostgreSQL Migrations for BazaarHub Indian Marketplace
 * India-specific schema for KYC, GST, Commissions, Certifications
 */

export const migrations = [
  // ============ Vendor KYC Tables ============
  {
    id: '001_create_vendor_kyc_table',
    up: `
      CREATE TABLE IF NOT EXISTS vendor_kyc (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id VARCHAR(255) NOT NULL UNIQUE,
        submission_id UUID NOT NULL,
        
        -- Personal Information (encrypted)
        pan_encrypted VARCHAR(255) NOT NULL,
        pan_last_four VARCHAR(4),
        aadhaar_last_four VARCHAR(4) NOT NULL,
        
        -- Business Information
        gstin VARCHAR(15) UNIQUE,
        gstin_encrypted VARCHAR(255),
        business_name VARCHAR(255) NOT NULL,
        business_type VARCHAR(50) NOT NULL,
        business_address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        pincode VARCHAR(6) NOT NULL,
        
        -- Bank Details (encrypted)
        bank_account_encrypted VARCHAR(255) NOT NULL,
        bank_account_last_four VARCHAR(4),
        bank_ifsc VARCHAR(11),
        bank_name VARCHAR(255),
        
        -- Document URLs (S3)
        pan_document_url TEXT,
        aadhaar_document_url TEXT,
        gstin_document_url TEXT,
        bank_proof_document_url TEXT,
        business_registration_document_url TEXT,
        
        -- Verification Status
        verification_status VARCHAR(50) NOT NULL DEFAULT 'pending',
        verified_at TIMESTAMP,
        verified_by UUID,
        rejection_reason TEXT,
        corrections_required TEXT[],
        
        -- Audit Fields
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        submitted_at TIMESTAMP,
        ip_address INET,
        user_agent TEXT,
        
        -- Compliance
        gdpr_deletion_requested BOOLEAN DEFAULT FALSE,
        gdpr_deletion_scheduled TIMESTAMP,
        
        CONSTRAINT fk_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
        CONSTRAINT valid_gstin CHECK (gstin IS NULL OR gstin ~ '^\\d{2}[A-Z]{5}\\d{4}[A-Z]\\d[A-Z]Z\\d$'),
        CONSTRAINT valid_pan_last_four CHECK (pan_last_four ~ '^[A-Z0-9]{4}$' OR pan_last_four IS NULL)
      );

      CREATE INDEX idx_vendor_kyc_vendor_id ON vendor_kyc(vendor_id);
      CREATE INDEX idx_vendor_kyc_status ON vendor_kyc(verification_status);
      CREATE INDEX idx_vendor_kyc_created_at ON vendor_kyc(created_at);
      CREATE INDEX idx_vendor_kyc_submission_id ON vendor_kyc(submission_id);
    `,
    down: `DROP TABLE IF EXISTS vendor_kyc CASCADE;`,
  },

  // ============ GST Configuration Tables ============
  {
    id: '002_create_gst_config_table',
    up: `
      CREATE TABLE IF NOT EXISTS gst_hsn_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hsn_code VARCHAR(8) NOT NULL UNIQUE,
        description VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        gst_rate DECIMAL(5, 2) NOT NULL,
        is_exempted BOOLEAN DEFAULT FALSE,
        requires_certification VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT valid_hsn CHECK (hsn_code ~ '^\\d{4,8}$'),
        CONSTRAINT valid_rate CHECK (gst_rate >= 0 AND gst_rate <= 100)
      );

      CREATE INDEX idx_gst_hsn_code ON gst_hsn_codes(hsn_code);
      CREATE INDEX idx_gst_category ON gst_hsn_codes(category);
      
      -- Insert standard HSN codes for India
      INSERT INTO gst_hsn_codes (hsn_code, description, category, gst_rate) VALUES
        ('8471', 'Electronic Computers', 'electronics', 5),
        ('8517', 'Telephone & Communication Equipment', 'electronics', 5),
        ('6204', 'Women Clothing', 'clothing', 5),
        ('6203', 'Men Clothing', 'clothing', 5),
        ('0201', 'Meat & Edible Meat Offal', 'food', 5),
        ('1905', 'Bakery Products', 'food', 0),
        ('4901', 'Books', 'books', 0),
        ('3304', 'Beauty & Cosmetics', 'cosmetics', 18)
      ON CONFLICT (hsn_code) DO NOTHING;
    `,
    down: `DROP TABLE IF EXISTS gst_hsn_codes CASCADE;`,
  },

  // ============ Commission Configuration Tables ============
  {
    id: '003_create_commission_config_table',
    up: `
      CREATE TABLE IF NOT EXISTS commission_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        config_type VARCHAR(50) NOT NULL,
        scope_type VARCHAR(50) NOT NULL,
        scope_id VARCHAR(255),
        
        -- Commission Rules
        commission_percentage DECIMAL(5, 2) NOT NULL,
        tds_percentage DECIMAL(5, 2) DEFAULT 1,
        
        -- Conditions
        min_order_value INT,
        max_order_value INT,
        applicable_categories TEXT[],
        
        -- Status
        is_active BOOLEAN DEFAULT TRUE,
        effective_from DATE NOT NULL,
        effective_to DATE,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID,
        
        CONSTRAINT valid_commission CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
        CONSTRAINT valid_tds CHECK (tds_percentage >= 0 AND tds_percentage <= 100)
      );

      CREATE INDEX idx_commission_scope ON commission_config(scope_type, scope_id);
      CREATE INDEX idx_commission_active ON commission_config(is_active);
    `,
    down: `DROP TABLE IF EXISTS commission_config CASCADE;`,
  },

  // ============ Commission Ledger Tables ============
  {
    id: '004_create_commission_ledger_table',
    up: `
      CREATE TABLE IF NOT EXISTS commission_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id VARCHAR(255) NOT NULL,
        order_id VARCHAR(255) NOT NULL,
        
        -- Amounts (in paise)
        order_value BIGINT NOT NULL,
        commission_amount BIGINT NOT NULL,
        tds_amount BIGINT NOT NULL,
        net_amount BIGINT NOT NULL,
        
        -- Calculation Details
        commission_percentage DECIMAL(5, 2) NOT NULL,
        tds_percentage DECIMAL(5, 2) NOT NULL,
        
        -- Status
        status VARCHAR(50) NOT NULL,
        payment_status VARCHAR(50) DEFAULT 'pending',
        
        created_at TIMESTAMP DEFAULT NOW(),
        recorded_at TIMESTAMP,
        
        CONSTRAINT fk_vendor_commission FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_commission_vendor ON commission_ledger(vendor_id);
      CREATE INDEX idx_commission_order ON commission_ledger(order_id);
      CREATE INDEX idx_commission_date ON commission_ledger(created_at);
    `,
    down: `DROP TABLE IF EXISTS commission_ledger CASCADE;`,
  },

  // ============ Product Certifications Tables ============
  {
    id: '005_create_certifications_table',
    up: `
      CREATE TABLE IF NOT EXISTS product_certifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id VARCHAR(255) NOT NULL,
        certification_type VARCHAR(100) NOT NULL,
        certificate_number VARCHAR(255),
        issuing_authority VARCHAR(255),
        
        -- Validity
        issued_date DATE,
        expiry_date DATE NOT NULL,
        renewal_date DATE,
        
        -- Document
        certificate_url TEXT,
        verification_status VARCHAR(50) DEFAULT 'pending',
        verified_by UUID,
        verified_at TIMESTAMP,
        
        -- Audit
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      -- Certification requirements by category
      CREATE TABLE IF NOT EXISTS certification_requirements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id VARCHAR(255) NOT NULL,
        certification_type VARCHAR(100) NOT NULL,
        is_mandatory BOOLEAN DEFAULT TRUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_certification_product ON product_certifications(product_id);
      CREATE INDEX idx_certification_type ON product_certifications(certification_type);
      CREATE INDEX idx_certification_expiry ON product_certifications(expiry_date);
      CREATE INDEX idx_certification_requirement_category ON certification_requirements(category_id);
    `,
    down: `DROP TABLE IF EXISTS product_certifications CASCADE; DROP TABLE IF EXISTS certification_requirements CASCADE;`,
  },

  // ============ Country of Origin Tables ============
  {
    id: '006_create_coo_tracking_table',
    up: `
      CREATE TABLE IF NOT EXISTS country_of_origin (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id VARCHAR(255) NOT NULL UNIQUE,
        country_code VARCHAR(2) NOT NULL,
        country_name VARCHAR(100) NOT NULL,
        is_india BOOLEAN NOT NULL,
        
        -- Documentation
        origin_certificate_url TEXT,
        verified BOOLEAN DEFAULT FALSE,
        verified_by UUID,
        verified_at TIMESTAMP,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_product_coo FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_coo_product ON country_of_origin(product_id);
      CREATE INDEX idx_coo_country ON country_of_origin(country_code);
    `,
    down: `DROP TABLE IF EXISTS country_of_origin CASCADE;`,
  },

  // ============ GST Compliance Tables ============
  {
    id: '007_create_gst_compliance_table',
    up: `
      -- GST Invoice Storage
      CREATE TABLE IF NOT EXISTS gst_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id VARCHAR(255) NOT NULL,
        vendor_id VARCHAR(255) NOT NULL,
        invoice_number VARCHAR(50) NOT NULL UNIQUE,
        
        -- GST Details
        vendor_gstin VARCHAR(15) NOT NULL,
        customer_gstin VARCHAR(15),
        
        -- Amounts (in paise)
        taxable_value BIGINT NOT NULL,
        cgst_amount BIGINT,
        sgst_amount BIGINT,
        igst_amount BIGINT,
        total_gst BIGINT NOT NULL,
        total_value BIGINT NOT NULL,
        
        -- Invoice Type
        invoice_type VARCHAR(50) NOT NULL,
        
        -- Document
        invoice_pdf_url TEXT,
        
        -- Status
        status VARCHAR(50) DEFAULT 'generated',
        sent_at TIMESTAMP,
        acknowledged_at TIMESTAMP,
        
        created_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_vendor_gst FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      );

      -- GSTR-1 Report Storage
      CREATE TABLE IF NOT EXISTS gstr1_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id VARCHAR(255) NOT NULL,
        financial_year VARCHAR(10) NOT NULL,
        month INT NOT NULL,
        
        -- Report Data (JSON)
        b2b_data JSONB NOT NULL DEFAULT '[]',
        b2c_data JSONB NOT NULL DEFAULT '[]',
        
        -- Summary
        total_invoices INT DEFAULT 0,
        total_value BIGINT DEFAULT 0,
        
        filed BOOLEAN DEFAULT FALSE,
        filed_at TIMESTAMP,
        
        created_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_vendor_gstr1 FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
        CONSTRAINT unique_gstr1_period UNIQUE(vendor_id, financial_year, month)
      );

      -- TDS Tracking
      CREATE TABLE IF NOT EXISTS tds_calculations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id VARCHAR(255) NOT NULL,
        payout_id VARCHAR(255),
        
        -- Amount Details (in paise)
        amount_before_tds BIGINT NOT NULL,
        tds_percentage DECIMAL(5, 2) NOT NULL,
        tds_amount BIGINT NOT NULL,
        amount_after_tds BIGINT NOT NULL,
        
        -- Applicability
        financial_quarter VARCHAR(10) NOT NULL,
        financial_year INT NOT NULL,
        has_pan BOOLEAN DEFAULT FALSE,
        
        created_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_vendor_tds FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_gst_invoice_order ON gst_invoices(order_id);
      CREATE INDEX idx_gst_invoice_vendor ON gst_invoices(vendor_id);
      CREATE INDEX idx_gstr1_vendor_period ON gstr1_reports(vendor_id, financial_year, month);
      CREATE INDEX idx_tds_vendor ON tds_calculations(vendor_id);
      CREATE INDEX idx_tds_quarter ON tds_calculations(financial_quarter, financial_year);
    `,
    down: `DROP TABLE IF EXISTS tds_calculations CASCADE; DROP TABLE IF EXISTS gstr1_reports CASCADE; DROP TABLE IF EXISTS gst_invoices CASCADE;`,
  },

  // ============ Shipping & Fulfillment Tables ============
  {
    id: '008_create_shipping_tables',
    up: `
      -- Pincode Serviceability
      CREATE TABLE IF NOT EXISTS pincode_serviceability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pincode VARCHAR(6) NOT NULL,
        state VARCHAR(100) NOT NULL,
        city VARCHAR(100),
        
        -- COD Availability
        cod_available BOOLEAN DEFAULT TRUE,
        
        -- Delivery SLA (in days)
        standard_delivery_days INT DEFAULT 5,
        express_delivery_days INT DEFAULT 2,
        
        -- Restrictions
        is_restricted BOOLEAN DEFAULT FALSE,
        restriction_reason TEXT,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT unique_pincode UNIQUE(pincode)
      );

      -- Shiprocket Shipments
      CREATE TABLE IF NOT EXISTS shipments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id VARCHAR(255) NOT NULL,
        shiprocket_order_id INT,
        
        -- Shipment Details
        awb_number VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        
        -- Pickup
        pickup_date DATE,
        pickup_scheduled BOOLEAN DEFAULT FALSE,
        
        -- Delivery
        estimated_delivery_date DATE,
        delivered_at TIMESTAMP,
        
        -- Tracking
        tracking_url TEXT,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_shipment_order ON shipments(order_id);
      CREATE INDEX idx_shipment_awb ON shipments(awb_number);
      CREATE INDEX idx_pincode ON pincode_serviceability(pincode);
      CREATE INDEX idx_pincode_state ON pincode_serviceability(state);
    `,
    down: `DROP TABLE IF EXISTS shipments CASCADE; DROP TABLE IF EXISTS pincode_serviceability CASCADE;`,
  },

  // ============ Razorpay Integration Tables ============
  {
    id: '009_create_razorpay_tables',
    up: `
      -- Vendor Razorpay Linked Accounts
      CREATE TABLE IF NOT EXISTS razorpay_linked_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id VARCHAR(255) NOT NULL UNIQUE,
        razorpay_account_id VARCHAR(255) NOT NULL UNIQUE,
        
        -- Account Details
        account_status VARCHAR(50) DEFAULT 'pending_activation',
        activated_at TIMESTAMP,
        
        -- Compliance
        kyc_verification_status VARCHAR(50),
        kyc_submitted_at TIMESTAMP,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_vendor_razorpay FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      );

      -- Payment Split Tracking
      CREATE TABLE IF NOT EXISTS payment_splits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_id VARCHAR(255) NOT NULL,
        razorpay_split_id VARCHAR(255),
        
        -- Allocation
        primary_amount BIGINT,
        vendor_amount BIGINT,
        commission_amount BIGINT,
        tds_amount BIGINT,
        
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_payment_split FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
      );

      -- Vendor Payouts
      CREATE TABLE IF NOT EXISTS vendor_payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id VARCHAR(255) NOT NULL,
        razorpay_payout_id VARCHAR(255),
        
        -- Amount Details (in paise)
        gross_amount BIGINT NOT NULL,
        tds_amount BIGINT DEFAULT 0,
        net_amount BIGINT NOT NULL,
        
        -- Period
        payout_period_start DATE,
        payout_period_end DATE,
        
        -- Status
        status VARCHAR(50) DEFAULT 'scheduled',
        processed_at TIMESTAMP,
        failed_reason TEXT,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_vendor_payout FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_razorpay_account_vendor ON razorpay_linked_accounts(vendor_id);
      CREATE INDEX idx_payment_split_payment ON payment_splits(payment_id);
      CREATE INDEX idx_payout_vendor ON vendor_payouts(vendor_id);
      CREATE INDEX idx_payout_status ON vendor_payouts(status);
      CREATE INDEX idx_payout_date ON vendor_payouts(created_at);
    `,
    down: `DROP TABLE IF EXISTS vendor_payouts CASCADE; DROP TABLE IF EXISTS payment_splits CASCADE; DROP TABLE IF EXISTS razorpay_linked_accounts CASCADE;`,
  },

  // ============ Audit & Compliance Tables ============
  {
    id: '010_create_audit_tables',
    up: `
      -- Admin Audit Log
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(255),
        
        -- Details
        changes JSONB,
        reason TEXT,
        ip_address INET,
        user_agent TEXT,
        
        created_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_admin FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
      );

      -- KYC Audit Trail
      CREATE TABLE IF NOT EXISTS kyc_audit_trail (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        actor_type VARCHAR(50),
        actor_id VARCHAR(255),
        
        details JSONB,
        ip_address INET,
        
        created_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT fk_vendor_audit FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_audit_log_admin ON admin_audit_log(admin_id);
      CREATE INDEX idx_audit_log_action ON admin_audit_log(action);
      CREATE INDEX idx_audit_log_date ON admin_audit_log(created_at);
      CREATE INDEX idx_kyc_audit_vendor ON kyc_audit_trail(vendor_id);
      CREATE INDEX idx_kyc_audit_date ON kyc_audit_trail(created_at);
    `,
    down: `DROP TABLE IF EXISTS kyc_audit_trail CASCADE; DROP TABLE IF EXISTS admin_audit_log CASCADE;`,
  },
];

export default migrations;
