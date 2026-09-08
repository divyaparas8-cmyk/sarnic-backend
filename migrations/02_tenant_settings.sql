-- ==========================================
-- 02_tenant_settings.sql
-- ==========================================
-- This script creates the tenant_settings table to allow dynamic industry labels per tenant.

CREATE TABLE IF NOT EXISTS tenant_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    label_brand VARCHAR(255) DEFAULT 'Brand',
    label_sub_brand VARCHAR(255) DEFAULT 'Sub-Brand',
    label_flavour VARCHAR(255) DEFAULT 'Flavour',
    label_pack_type VARCHAR(255) DEFAULT 'Pack Type',
    label_pack_code VARCHAR(255) DEFAULT 'Pack Code',
    label_industry VARCHAR(255) DEFAULT 'Industry',
    label_client VARCHAR(255) DEFAULT 'Client',
    label_job VARCHAR(255) DEFAULT 'Job',
    label_project VARCHAR(255) DEFAULT 'Project',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Note: When a new tenant is created, you may optionally insert a default row,
-- or handle the fallback defaults in the backend/frontend.
