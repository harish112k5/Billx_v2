-- BillX V2 — Seed Data
-- Run AFTER schema.sql
-- Creates demo organizations, users, and one sample project
-- All passwords are bcrypt hash of "password"

USE billx_v2;

-- ============================================================
-- Organizations
-- ============================================================
INSERT IGNORE INTO organizations
  (organization_id, org_name, org_type, pan_number, gst_number, contact_person, contact_phone, contact_email)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'BillX Constructions Pvt Ltd', 'main_contractor',
   'AABCB1234P', '33AABCB1234P1ZR',
   'Rajesh Kumar', '9876543210', 'admin@billx.com'),
  ('00000000-0000-0000-0000-000000000002',
   'TK Toll Road Pvt Ltd', 'owner',
   'AABCT5678P', '33AABCT5678P1ZS',
   'Venkat Subramanian', '9876543211', 'client@tktollroad.com'),
  ('00000000-0000-0000-0000-000000000003',
   'NIP Infra Subcontractors', 'subcontractor',
   'AABCN9012P', '33AABCN9012P1ZT',
   'Suresh Pillai', '9876543212', 'nip@infra.com');

-- ============================================================
-- Users  (password = "password" for all)
-- bcrypt hash generated with 10 rounds
-- ============================================================
INSERT IGNORE INTO users
  (user_id, organization_id, name, email, password_hash, role)
VALUES
  ('00000000-0000-0001-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Admin User', 'admin@billx.com',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
   'super_admin'),
  ('00000000-0000-0001-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'Project Manager', 'manager@billx.com',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
   'manager'),
  ('00000000-0000-0001-0000-000000000003',
   '00000000-0000-0000-0000-000000000001',
   'Site Engineer', 'engineer@billx.com',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
   'engineer'),
  ('00000000-0000-0001-0000-000000000004',
   '00000000-0000-0000-0000-000000000002',
   'Client Viewer', 'viewer@billx.com',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
   'viewer');

-- ============================================================
-- Sample Project
-- ============================================================
INSERT IGNORE INTO projects
  (project_id, project_code, project_name, project_location, client_name,
   work_order_number, contract_value, start_date, end_date, status,
   description, created_by)
VALUES
  ('00000000-0000-0002-0000-000000000001',
   'TKTR-NIP-001',
   'Construction of Loop Road & Footpath at BHS Bypass',
   'BHS Bypass, Tamil Nadu',
   'TK Toll Road Pvt Ltd',
   'SERC/MSC/23578746',
   46329919.93,
   '2024-09-01', '2025-12-31',
   'ongoing',
   'Road widening and loop road construction at the BHS toll plaza bypass stretch.',
   '00000000-0000-0001-0000-000000000001');

-- ============================================================
-- Sample Contract (Main)
-- ============================================================
INSERT IGNORE INTO project_contracts
  (contract_id, project_id, organization_id, contract_type, contract_number,
   contract_value, scope_description, start_date, end_date, status)
VALUES
  ('00000000-0000-0003-0000-000000000001',
   '00000000-0000-0002-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'main', 'SERC/MSC/23578746',
   46329919.93,
   'Complete road construction, storm water drains, footpath, kerb stones and road furniture',
   '2024-09-01', '2025-12-31', 'active');

SELECT 'Seed data inserted successfully!' AS status;
SELECT 'Login with admin@billx.com / password' AS note;
