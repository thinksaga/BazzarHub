-- BazaarHub Database Initialization Script
-- Initialize extensions and base schema for production-ready multivendor marketplace

-- ============ Extensions ============
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "plpgsql";

-- ============ Schemas ============
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS search;

-- ============ Custom Types ============
DO $$ BEGIN
    CREATE TYPE vendor_status AS ENUM ('pending', 'kyc_pending', 'kyc_verified', 'active', 'suspended', 'deactivated');
    EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE kyc_status AS ENUM ('pending', 'submitted', 'under_review', 'verified', 'rejected', 'expired');
    EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('pan', 'aadhaar', 'gstin', 'bank_proof', 'business_registration', 'other');
    EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');
    EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
    EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded');
    EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE commission_type AS ENUM ('default', 'category', 'vendor');
    EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE certification_status AS ENUM ('pending', 'approved', 'rejected', 'expired', 'revoked');
    EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL;
END $$;

-- ============ Audit Logging Functions ============
CREATE OR REPLACE FUNCTION audit.audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit.audit_logs (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        user_id,
        created_at
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        to_jsonb(OLD),
        to_jsonb(NEW),
        CURRENT_USER,
        CURRENT_TIMESTAMP
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============ Enable Row Level Security ============
ALTER DATABASE ${POSTGRES_DB} SET rls.enabled = on;

-- ============ Grant Permissions ============
GRANT CREATE ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};
GRANT USAGE ON SCHEMA public TO ${POSTGRES_USER};
GRANT USAGE ON SCHEMA audit TO ${POSTGRES_USER};
GRANT USAGE ON SCHEMA search TO ${POSTGRES_USER};

-- ============ Create Audit Table ============
CREATE TABLE IF NOT EXISTS audit.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit.audit_logs(created_at);

-- ============ Create Vendors Table ============
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Info
    business_name TEXT NOT NULL,
    business_type VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- Contact
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL UNIQUE,
    alternate_phone VARCHAR(15),
    
    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(10),
    
    -- Status & Verification
    status vendor_status DEFAULT 'pending',
    kyc_status kyc_status DEFAULT 'pending',
    verification_status VARCHAR(50) DEFAULT 'pending',
    
    -- Bank Details (encrypted)
    bank_account_holder TEXT,
    bank_account_number_encrypted TEXT,
    bank_ifsc_code VARCHAR(11),
    bank_name TEXT,
    
    -- Tax Info
    pan_encrypted TEXT,
    gstin VARCHAR(15),
    tan VARCHAR(10),
    
    -- Profile
    logo_url TEXT,
    banner_url TEXT,
    website_url TEXT,
    
    -- Metadata
    commission_rate DECIMAL(5, 2),
    tds_applicable BOOLEAN DEFAULT false,
    cod_enabled BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Soft delete constraint
    CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT valid_phone CHECK (phone ~ '^\d{10}$'),
    CONSTRAINT valid_gstin CHECK (gstin IS NULL OR gstin ~ '^\d{15}$'),
    CONSTRAINT valid_pan CHECK (pan_encrypted IS NULL OR length(pan_encrypted) > 0)
);

CREATE INDEX IF NOT EXISTS idx_vendors_email ON public.vendors(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_gstin ON public.vendors(gstin) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_status ON public.vendors(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_kyc_status ON public.vendors(kyc_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_created_at ON public.vendors(created_at) WHERE deleted_at IS NULL;

-- ============ Create Vendors KYC Table ============
CREATE TABLE IF NOT EXISTS public.vendors_kyc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    
    -- Personal/Business Info
    full_name TEXT,
    date_of_birth DATE,
    gender VARCHAR(20),
    
    -- Document Storage (S3 URLs)
    pan_document_url TEXT,
    aadhaar_document_url TEXT,
    aadhaar_last_four VARCHAR(4),
    gstin_document_url TEXT,
    bank_proof_document_url TEXT,
    business_registration_url TEXT,
    additional_documents JSONB DEFAULT '[]'::jsonb,
    
    -- Verification
    pan_verified BOOLEAN DEFAULT false,
    gstin_verified BOOLEAN DEFAULT false,
    bank_verified BOOLEAN DEFAULT false,
    documents_verified BOOLEAN DEFAULT false,
    
    -- Status
    submission_status kyc_status DEFAULT 'pending',
    verification_date TIMESTAMP WITH TIME ZONE,
    verified_by UUID,
    rejection_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_vendors_kyc_vendor_id ON public.vendors_kyc(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_kyc_status ON public.vendors_kyc(submission_status);
CREATE INDEX IF NOT EXISTS idx_vendors_kyc_created_at ON public.vendors_kyc(created_at);

-- ============ Create KYC Audit Table ============
CREATE TABLE IF NOT EXISTS public.vendors_kyc_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    kyc_id UUID REFERENCES public.vendors_kyc(id) ON DELETE SET NULL,
    
    -- Action Details
    action VARCHAR(50) NOT NULL,
    action_by UUID,
    action_reason TEXT,
    
    -- Data Changes
    old_data JSONB,
    new_data JSONB,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendors_kyc_audit_vendor_id ON public.vendors_kyc_audit(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_kyc_audit_created_at ON public.vendors_kyc_audit(created_at);

-- ============ Create Razorpay Accounts Table ============
CREATE TABLE IF NOT EXISTS public.razorpay_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL UNIQUE REFERENCES public.vendors(id) ON DELETE CASCADE,
    razorpay_account_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Account Details
    phone VARCHAR(15),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'created',
    
    -- Bank Details Reference
    bank_account_id UUID,
    
    -- Linked At
    linked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_razorpay_accounts_vendor_id ON public.razorpay_accounts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_accounts_status ON public.razorpay_accounts(status);

-- ============ Create Products Table ============
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    
    -- Basic Info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID,
    
    -- Pricing
    price DECIMAL(12, 2) NOT NULL,
    compare_at_price DECIMAL(12, 2),
    cost_price DECIMAL(12, 2),
    
    -- SKU
    sku VARCHAR(100),
    barcode VARCHAR(100),
    
    -- Inventory
    stock_quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    reorder_point INTEGER DEFAULT 10,
    
    -- Attributes
    attributes JSONB DEFAULT '{}'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    
    -- Tax & Compliance
    hsn_code VARCHAR(8),
    gst_rate DECIMAL(5, 2),
    country_of_origin VARCHAR(2) DEFAULT 'IN',
    
    -- Certifications
    requires_fssai BOOLEAN DEFAULT false,
    requires_bis BOOLEAN DEFAULT false,
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft',
    visibility VARCHAR(50) DEFAULT 'hidden',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(vendor_id, sku),
    UNIQUE(vendor_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at) WHERE deleted_at IS NULL;

-- ============ Create Orders Table ============
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    customer_id UUID,
    
    -- Order Info
    order_number VARCHAR(50) NOT NULL UNIQUE,
    status order_status DEFAULT 'pending',
    
    -- Amounts
    subtotal DECIMAL(12, 2) NOT NULL,
    shipping_amount DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    
    -- Payment
    payment_method VARCHAR(50),
    payment_status payment_status DEFAULT 'pending',
    razorpay_payment_id VARCHAR(255),
    
    -- Shipping
    shipping_method VARCHAR(50),
    shipping_tracking_id VARCHAR(100),
    
    -- Fulfillment
    items JSONB NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON public.orders(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at) WHERE deleted_at IS NULL;

-- ============ Create Commissions Table ============
CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commission_type commission_type NOT NULL,
    
    -- Applicable To
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    category_id UUID,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    
    -- Rates
    percentage DECIMAL(5, 2) NOT NULL,
    
    -- Tiers (for volume-based)
    tier_min_amount DECIMAL(12, 2),
    tier_max_amount DECIMAL(12, 2),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commissions_vendor_id ON public.commissions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_commissions_category_id ON public.commissions(category_id);
CREATE INDEX IF NOT EXISTS idx_commissions_type ON public.commissions(commission_type);
CREATE INDEX IF NOT EXISTS idx_commissions_active ON public.commissions(is_active);

-- ============ Create Commission Ledger ============
CREATE TABLE IF NOT EXISTS public.commission_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    
    -- Commission Details
    commission_amount DECIMAL(12, 2) NOT NULL,
    commission_rate DECIMAL(5, 2) NOT NULL,
    
    -- TDS
    tds_amount DECIMAL(12, 2) DEFAULT 0,
    tds_rate DECIMAL(5, 2) DEFAULT 0,
    
    -- Net
    net_commission DECIMAL(12, 2) NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'calculated',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_vendor_id ON public.commission_ledger(vendor_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_order_id ON public.commission_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_status ON public.commission_ledger(status);

-- ============ Create Payout Records ============
CREATE TABLE IF NOT EXISTS public.payout_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    
    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    payout_date DATE,
    
    -- Amounts
    gross_earnings DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_commission DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_tds DECIMAL(12, 2) NOT NULL DEFAULT 0,
    net_payout DECIMAL(12, 2) NOT NULL DEFAULT 0,
    
    -- Transfer
    razorpay_transfer_id VARCHAR(255),
    razorpay_payout_id VARCHAR(255),
    
    -- Status
    status payout_status DEFAULT 'pending',
    
    -- Metadata
    order_count INTEGER DEFAULT 0,
    commission_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payout_records_vendor_id ON public.payout_records(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payout_records_status ON public.payout_records(status);
CREATE INDEX IF NOT EXISTS idx_payout_records_period ON public.payout_records(period_start, period_end);

-- ============ Create Product Certifications ============
CREATE TABLE IF NOT EXISTS public.product_certifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    
    -- Certification Details
    certification_type VARCHAR(50) NOT NULL,
    certification_number VARCHAR(100),
    issuer_name TEXT,
    issue_date DATE,
    expiry_date DATE,
    
    -- Document
    certificate_url TEXT,
    
    -- Status
    status certification_status DEFAULT 'pending',
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_certifications_product_id ON public.product_certifications(product_id);
CREATE INDEX IF NOT EXISTS idx_product_certifications_vendor_id ON public.product_certifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_product_certifications_status ON public.product_certifications(status);
CREATE INDEX IF NOT EXISTS idx_product_certifications_expiry ON public.product_certifications(expiry_date);

-- ============ Create GST Rates Table ============
CREATE TABLE IF NOT EXISTS public.gst_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hsn_code VARCHAR(8) NOT NULL,
    product_type VARCHAR(100),
    
    -- Tax Rates
    cgst_rate DECIMAL(5, 2),
    sgst_rate DECIMAL(5, 2),
    igst_rate DECIMAL(5, 2),
    
    -- Metadata
    effective_from DATE NOT NULL,
    effective_to DATE,
    description TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(hsn_code, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_gst_rates_hsn_code ON public.gst_rates(hsn_code);

-- ============ Grant Permissions ============
ALTER TABLE public.vendors OWNER TO ${POSTGRES_USER};
ALTER TABLE public.vendors_kyc OWNER TO ${POSTGRES_USER};
ALTER TABLE public.vendors_kyc_audit OWNER TO ${POSTGRES_USER};
ALTER TABLE public.razorpay_accounts OWNER TO ${POSTGRES_USER};
ALTER TABLE public.products OWNER TO ${POSTGRES_USER};
ALTER TABLE public.orders OWNER TO ${POSTGRES_USER};
ALTER TABLE public.commissions OWNER TO ${POSTGRES_USER};
ALTER TABLE public.commission_ledger OWNER TO ${POSTGRES_USER};
ALTER TABLE public.payout_records OWNER TO ${POSTGRES_USER};
ALTER TABLE public.product_certifications OWNER TO ${POSTGRES_USER};
ALTER TABLE public.gst_rates OWNER TO ${POSTGRES_USER};

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${POSTGRES_USER};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${POSTGRES_USER};

-- ============ Create Triggers for Updated_At ============
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
    CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TRIGGER update_vendors_kyc_updated_at BEFORE UPDATE ON public.vendors_kyc
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TRIGGER update_commissions_updated_at BEFORE UPDATE ON public.commissions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TRIGGER update_payout_records_updated_at BEFORE UPDATE ON public.payout_records
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TRIGGER update_product_certifications_updated_at BEFORE UPDATE ON public.product_certifications
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    EXCEPTION WHEN OTHERS THEN NULL;
END $$;
