-- Migration: Add client and company short name fields
-- Description: Adds short_name columns for clean filename generations.

ALTER TABLE clients_suppliers ADD COLUMN short_name VARCHAR(100) NULL AFTER name;
ALTER TABLE company_information ADD COLUMN short_name VARCHAR(100) NULL AFTER company_name;
