-- Migration: Universal SaaS Pivot
-- Purpose: Remove packaging-specific constraints and add universal project fields.

CREATE TABLE IF NOT EXISTS tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(255) UNIQUE,
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 1. Drop foreign keys and columns from 'jobs' table
ALTER TABLE jobs
  DROP COLUMN brand_id,
  DROP COLUMN sub_brand_id,
  DROP COLUMN flavour_id,
  DROP COLUMN pack_type_id,
  DROP COLUMN pack_code_id,
  DROP COLUMN pack_size,
  DROP COLUMN ean_barcode,
  DROP COLUMN pack_code;

-- 2. Drop obsolete packaging tables
DROP TABLE IF EXISTS brands;
DROP TABLE IF EXISTS sub_brands;
DROP TABLE IF EXISTS flavours;
DROP TABLE IF EXISTS pack_types;
DROP TABLE IF EXISTS pack_codes;

-- 3. Create Custom Requirements / Tags Table
CREATE TABLE IF NOT EXISTS custom_requirements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 4. Create Project Categories Table
CREATE TABLE IF NOT EXISTS project_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 5. Add universal columns to 'projects' table
ALTER TABLE projects
  ADD COLUMN category_id INT NULL AFTER client_name,
  ADD COLUMN department VARCHAR(255) NULL AFTER category_id,
  ADD COLUMN progress_percentage INT DEFAULT 0 AFTER budget,
  ADD COLUMN tags JSON NULL AFTER progress_percentage,
  ADD COLUMN assigned_team JSON NULL AFTER tags,
  ADD CONSTRAINT fk_project_category FOREIGN KEY (category_id) REFERENCES project_categories(id) ON DELETE SET NULL;

-- 6. Insert Default Project Categories
INSERT INTO project_categories (name) VALUES 
('Software Development'),
('Marketing Campaign'),
('Design & Creative'),
('Construction'),
('Consulting'),
('Manufacturing');

-- 7. Insert Default Custom Requirements
INSERT INTO custom_requirements (name, category) VALUES 
('UI/UX Design', 'Design'),
('SEO Optimization', 'Marketing'),
('Frontend Development', 'Development'),
('Backend API', 'Development'),
('Quality Assurance', 'Testing'),
('Copywriting', 'Content'),
('Procurement', 'Manufacturing');
