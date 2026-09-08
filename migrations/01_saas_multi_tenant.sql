-- ==========================================
-- 01_saas_multi_tenant.sql
-- ==========================================
-- This script transforms the single-tenant database into a multi-tenant database.
-- It creates the `tenants` table and adds a `tenant_id` column to all existing operational tables.

-- 1. Create Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(255) UNIQUE,
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Add tenant_id to all major tables
-- Replace these table names with your exact database table names if they differ slightly.

-- Users
ALTER TABLE users ADD COLUMN tenant_id INT NULL;
ALTER TABLE users ADD CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Projects & Jobs
ALTER TABLE projects ADD COLUMN tenant_id INT NULL;
ALTER TABLE projects ADD CONSTRAINT fk_project_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE jobs ADD COLUMN tenant_id INT NULL;
ALTER TABLE jobs ADD CONSTRAINT fk_job_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE assign_jobs ADD COLUMN tenant_id INT NULL;
ALTER TABLE assign_jobs ADD CONSTRAINT fk_assignjob_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Financials
ALTER TABLE estimates ADD COLUMN tenant_id INT NULL;
ALTER TABLE estimates ADD CONSTRAINT fk_estimate_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE purchase_orders ADD COLUMN tenant_id INT NULL;
ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE invoices ADD COLUMN tenant_id INT NULL;
ALTER TABLE invoices ADD CONSTRAINT fk_invoice_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Clients & Suppliers
ALTER TABLE clients_suppliers ADD COLUMN tenant_id INT NULL;
ALTER TABLE clients_suppliers ADD CONSTRAINT fk_cs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Configuration & Assets
ALTER TABLE brands ADD COLUMN tenant_id INT NULL;
ALTER TABLE brands ADD CONSTRAINT fk_brand_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE sub_brands ADD COLUMN tenant_id INT NULL;
ALTER TABLE sub_brands ADD CONSTRAINT fk_subbrand_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE industries ADD COLUMN tenant_id INT NULL;
ALTER TABLE industries ADD CONSTRAINT fk_industry_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE flavours ADD COLUMN tenant_id INT NULL;
ALTER TABLE flavours ADD CONSTRAINT fk_flavour_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE packtypes ADD COLUMN tenant_id INT NULL;
ALTER TABLE packtypes ADD CONSTRAINT fk_packtype_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE packcodes ADD COLUMN tenant_id INT NULL;
ALTER TABLE packcodes ADD CONSTRAINT fk_packcode_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE tax_categories ADD COLUMN tenant_id INT NULL;
ALTER TABLE tax_categories ADD CONSTRAINT fk_tax_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE number_sequences ADD COLUMN tenant_id INT NULL;
ALTER TABLE number_sequences ADD CONSTRAINT fk_seq_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE company_information ADD COLUMN tenant_id INT NULL;
ALTER TABLE company_information ADD CONSTRAINT fk_companyinfo_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE time_logs ADD COLUMN tenant_id INT NULL;
ALTER TABLE time_logs ADD CONSTRAINT fk_timelog_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- NOTE: 
-- 1. When running this on an existing database with data, the `tenant_id` will be NULL.
-- 2. You will need to manually insert a default tenant in the `tenants` table.
-- 3. Then, run an UPDATE script to assign all existing records to that default `tenant_id`.
