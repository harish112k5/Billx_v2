-- BillX V2 — Complete Database Schema
-- Database: billx_v2
-- Run this file ONCE to create all tables and views

CREATE DATABASE IF NOT EXISTS billx_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE billx_v2;

-- ============================================================
-- TABLE: organizations
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  organization_id   CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  org_name          VARCHAR(200) NOT NULL,
  org_type          ENUM('main_contractor','subcontractor','owner','consultant') NOT NULL,
  pan_number        VARCHAR(20),
  gst_number        VARCHAR(20),
  address           TEXT,
  contact_person    VARCHAR(150),
  contact_phone     VARCHAR(20),
  contact_email     VARCHAR(150),
  is_active         TINYINT(1) DEFAULT 1,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  user_id           CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  organization_id   CHAR(36) NOT NULL,
  name              VARCHAR(100) NOT NULL,
  email             VARCHAR(150) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  role              ENUM('super_admin','admin','manager','engineer','viewer','investor') NOT NULL,
  is_active         TINYINT(1) DEFAULT 1,
  last_login        DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
);

-- ============================================================
-- TABLE: projects
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  project_id        CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  project_code      VARCHAR(50) NOT NULL UNIQUE,
  project_name      VARCHAR(300) NOT NULL,
  project_location  VARCHAR(200),
  client_name       VARCHAR(200),
  work_order_number VARCHAR(100),
  work_order_date   DATE,
  contract_value    DECIMAL(18,2) DEFAULT 0,
  start_date        DATE,
  end_date          DATE,
  status            ENUM('planned','ongoing','on_hold','completed','cancelled') DEFAULT 'planned',
  description       TEXT,
  created_by        CHAR(36),
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_user FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- ============================================================
-- TABLE: project_contracts
-- ============================================================
CREATE TABLE IF NOT EXISTS project_contracts (
  contract_id        CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  project_id         CHAR(36) NOT NULL,
  organization_id    CHAR(36) NOT NULL,
  contract_type      ENUM('main','subcontract') NOT NULL,
  contract_number    VARCHAR(100),
  contract_value     DECIMAL(18,2) DEFAULT 0,
  scope_description  TEXT,
  start_date         DATE,
  end_date           DATE,
  status             ENUM('active','completed','terminated') DEFAULT 'active',
  parent_contract_id CHAR(36) NULL,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_contracts_project    FOREIGN KEY (project_id)         REFERENCES projects(project_id),
  CONSTRAINT fk_contracts_org        FOREIGN KEY (organization_id)    REFERENCES organizations(organization_id),
  CONSTRAINT fk_contracts_parent     FOREIGN KEY (parent_contract_id) REFERENCES project_contracts(contract_id),
  INDEX idx_contracts_project  (project_id, organization_id),
  INDEX idx_contracts_parent   (parent_contract_id)
);

-- ============================================================
-- TABLE: boq_items
-- ============================================================
CREATE TABLE IF NOT EXISTS boq_items (
  boq_id            CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  project_id        CHAR(36) NOT NULL,
  contract_id       CHAR(36) NOT NULL,
  item_code         VARCHAR(50) NOT NULL,
  item_number       INT,
  description       TEXT NOT NULL,
  unit              VARCHAR(30) NOT NULL,
  planned_quantity  DECIMAL(15,4) NOT NULL DEFAULT 0,
  unit_rate         DECIMAL(15,2) NOT NULL DEFAULT 0,
  planned_amount    DECIMAL(18,2) GENERATED ALWAYS AS (planned_quantity * unit_rate) STORED,
  category          VARCHAR(100),
  phase             VARCHAR(100),
  is_non_boq        TINYINT(1) DEFAULT 0,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_boq_project   FOREIGN KEY (project_id)  REFERENCES projects(project_id),
  CONSTRAINT fk_boq_contract  FOREIGN KEY (contract_id) REFERENCES project_contracts(contract_id),
  UNIQUE KEY uq_boq_item (project_id, item_code),
  INDEX idx_boq_project  (project_id),
  INDEX idx_boq_contract (contract_id)
);

-- ============================================================
-- TABLE: boq_allocations
-- ============================================================
CREATE TABLE IF NOT EXISTS boq_allocations (
  allocation_id      CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  boq_id             CHAR(36) NOT NULL,
  organization_id    CHAR(36) NOT NULL,
  allocated_quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
  allocation_percent DECIMAL(5,2),
  allocated_rate     DECIMAL(15,2),
  notes              TEXT,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alloc_boq  FOREIGN KEY (boq_id)           REFERENCES boq_items(boq_id),
  CONSTRAINT fk_alloc_org  FOREIGN KEY (organization_id)   REFERENCES organizations(organization_id),
  INDEX idx_alloc_boq (boq_id),
  INDEX idx_alloc_org (organization_id)
);

-- ============================================================
-- TABLE: ra_bills
-- ============================================================
CREATE TABLE IF NOT EXISTS ra_bills (
  ra_bill_id               CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  project_id               CHAR(36) NOT NULL,
  contract_id              CHAR(36) NOT NULL,
  ra_number                INT NOT NULL,
  ra_code                  VARCHAR(50),
  bill_period_from         DATE NOT NULL,
  bill_period_to           DATE NOT NULL,

  -- Amounts from Abstract sheet
  basic_amount_upto_date   DECIMAL(18,2) DEFAULT 0,
  basic_amount_upto_prev   DECIMAL(18,2) DEFAULT 0,
  basic_amount_this_bill   DECIMAL(18,2) DEFAULT 0,

  -- GST
  sgst_percent             DECIMAL(5,2) DEFAULT 9,
  cgst_percent             DECIMAL(5,2) DEFAULT 9,
  sgst_amount              DECIMAL(18,2) DEFAULT 0,
  cgst_amount              DECIMAL(18,2) DEFAULT 0,

  -- Deductions
  retention_percent        DECIMAL(5,2) DEFAULT 5,
  retention_amount         DECIMAL(18,2) DEFAULT 0,
  tds_percent              DECIMAL(5,2) DEFAULT 2,
  tds_amount               DECIMAL(18,2) DEFAULT 0,
  labour_cess_percent      DECIMAL(5,2) DEFAULT 1,
  labour_cess_amount       DECIMAL(18,2) DEFAULT 0,
  other_deductions         DECIMAL(18,2) DEFAULT 0,

  -- Totals
  gross_amount             DECIMAL(18,2) DEFAULT 0,
  total_deductions         DECIMAL(18,2) DEFAULT 0,
  net_payable              DECIMAL(18,2) DEFAULT 0,

  -- Status tracking
  stage                    ENUM('draft','submitted','under_review','certified','paid','partially_paid') DEFAULT 'draft',
  submitted_date           DATE,
  certified_date           DATE,
  certified_amount         DECIMAL(18,2) DEFAULT 0,
  payment_received         DECIMAL(18,2) DEFAULT 0,
  payment_date             DATE,
  rejection_amount         DECIMAL(18,2) DEFAULT 0,
  rejection_reason         TEXT,

  -- Meta
  prepared_by              VARCHAR(150),
  submitted_to             VARCHAR(150),
  ipc_number               INT,
  excel_file_name          VARCHAR(300),
  import_id                CHAR(36),
  created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_rabill_project  FOREIGN KEY (project_id)  REFERENCES projects(project_id),
  CONSTRAINT fk_rabill_contract FOREIGN KEY (contract_id) REFERENCES project_contracts(contract_id),
  UNIQUE KEY uq_rabill (project_id, contract_id, ra_number),
  INDEX idx_rabill_project (project_id),
  INDEX idx_rabill_stage   (stage)
);

-- ============================================================
-- TABLE: ra_bill_items
-- ============================================================
CREATE TABLE IF NOT EXISTS ra_bill_items (
  ra_item_id           CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  ra_bill_id           CHAR(36) NOT NULL,
  boq_id               CHAR(36) NOT NULL,
  qty_upto_date        DECIMAL(15,4) DEFAULT 0,
  qty_upto_previous    DECIMAL(15,4) DEFAULT 0,
  qty_this_bill        DECIMAL(15,4) DEFAULT 0,
  amount_upto_date     DECIMAL(18,2) DEFAULT 0,
  amount_upto_previous DECIMAL(18,2) DEFAULT 0,
  amount_this_bill     DECIMAL(18,2) DEFAULT 0,
  qty_diff_from_boq    DECIMAL(15,4) DEFAULT 0,
  amount_diff_from_boq DECIMAL(18,2) DEFAULT 0,
  unit_rate            DECIMAL(15,2) DEFAULT 0,
  is_non_boq           TINYINT(1) DEFAULT 0,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rabi_bill FOREIGN KEY (ra_bill_id) REFERENCES ra_bills(ra_bill_id),
  CONSTRAINT fk_rabi_boq  FOREIGN KEY (boq_id)     REFERENCES boq_items(boq_id),
  INDEX idx_rabi_bill (ra_bill_id),
  INDEX idx_rabi_boq  (boq_id)
);

-- ============================================================
-- TABLE: measurements
-- ============================================================
CREATE TABLE IF NOT EXISTS measurements (
  measurement_id   CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  ra_item_id       CHAR(36) NOT NULL,
  boq_id           CHAR(36) NOT NULL,
  ra_bill_id       CHAR(36) NOT NULL,
  serial_no        INT,
  measurement_date DATE,
  rfi_number       VARCHAR(100),
  description      VARCHAR(500),
  location_from    DECIMAL(10,3),
  location_to      DECIMAL(10,3),
  side             VARCHAR(50),
  nos              DECIMAL(10,3),
  length           DECIMAL(12,4),
  breadth          DECIMAL(12,4),
  depth            DECIMAL(12,4),
  quantity         DECIMAL(15,4) NOT NULL,
  ipc_number       INT,
  remarks          VARCHAR(300),
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_meas_item   FOREIGN KEY (ra_item_id) REFERENCES ra_bill_items(ra_item_id),
  CONSTRAINT fk_meas_boq    FOREIGN KEY (boq_id)     REFERENCES boq_items(boq_id),
  CONSTRAINT fk_meas_bill   FOREIGN KEY (ra_bill_id) REFERENCES ra_bills(ra_bill_id),
  INDEX idx_meas_item   (ra_item_id),
  INDEX idx_meas_boq    (boq_id),
  INDEX idx_meas_ipc    (ipc_number)
);

-- ============================================================
-- TABLE: excel_imports
-- ============================================================
CREATE TABLE IF NOT EXISTS excel_imports (
  import_id           CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  project_id          CHAR(36),
  contract_id         CHAR(36),
  ra_bill_id          CHAR(36) NULL,
  import_type         ENUM('boq','ra_bill','budget','measurements') NOT NULL,
  file_name           VARCHAR(300) NOT NULL,
  ra_number_detected  INT,
  bill_period         VARCHAR(100),
  total_sheets        INT DEFAULT 0,
  boq_items_found     INT DEFAULT 0,
  measurements_found  INT DEFAULT 0,
  status              ENUM('pending','processing','completed','failed') DEFAULT 'pending',
  errors_count        INT DEFAULT 0,
  error_log           JSON,
  imported_by         CHAR(36),
  imported_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at        DATETIME,
  CONSTRAINT fk_import_project  FOREIGN KEY (project_id)  REFERENCES projects(project_id),
  CONSTRAINT fk_import_contract FOREIGN KEY (contract_id) REFERENCES project_contracts(contract_id)
);

-- ============================================================
-- TABLE: investors
-- ============================================================
CREATE TABLE IF NOT EXISTS investors (
  investor_id    CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name           VARCHAR(200) NOT NULL,
  investor_type  ENUM('individual','company','institution') DEFAULT 'individual',
  contact_phone  VARCHAR(20),
  contact_email  VARCHAR(150),
  pan_number     VARCHAR(20),
  address        TEXT,
  user_id        CHAR(36) NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_investor_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ============================================================
-- TABLE: investments
-- ============================================================
CREATE TABLE IF NOT EXISTS investments (
  investment_id      CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  project_id         CHAR(36) NOT NULL,
  investor_id        CHAR(36) NOT NULL,
  amount             DECIMAL(18,2) NOT NULL,
  investment_date    DATE NOT NULL,
  return_type        ENUM('profit_share','fixed_return','billing_based') DEFAULT 'fixed_return',
  expected_return    DECIMAL(18,2) DEFAULT 0,
  return_percent     DECIMAL(6,2) DEFAULT 0,
  billing_milestone  VARCHAR(100),
  repaid_amount      DECIMAL(18,2) DEFAULT 0,
  repayment_date     DATE,
  status             ENUM('active','partially_repaid','fully_repaid') DEFAULT 'active',
  notes              TEXT,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invest_project  FOREIGN KEY (project_id)  REFERENCES projects(project_id),
  CONSTRAINT fk_invest_investor FOREIGN KEY (investor_id) REFERENCES investors(investor_id)
);

-- ============================================================
-- TABLE: project_expenses
-- ============================================================
CREATE TABLE IF NOT EXISTS project_expenses (
  expense_id      CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  project_id      CHAR(36) NOT NULL,
  contract_id     CHAR(36) NULL,
  category        ENUM('labour','material','equipment','overhead','transport','other') NOT NULL,
  sub_category    VARCHAR(100),
  description     TEXT,
  amount          DECIMAL(15,2) NOT NULL,
  expense_date    DATE NOT NULL,
  vendor_name     VARCHAR(200),
  invoice_number  VARCHAR(100),
  payment_status  ENUM('pending','paid','partial') DEFAULT 'pending',
  recorded_by     CHAR(36),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expense_project  FOREIGN KEY (project_id)  REFERENCES projects(project_id),
  CONSTRAINT fk_expense_contract FOREIGN KEY (contract_id) REFERENCES project_contracts(contract_id)
);

-- ============================================================
-- VIEWS
-- ============================================================

-- VIEW: v_boq_progress
CREATE OR REPLACE VIEW v_boq_progress AS
SELECT
  b.boq_id,
  b.project_id,
  b.contract_id,
  b.item_code,
  b.item_number,
  b.description,
  b.unit,
  b.planned_quantity,
  b.unit_rate,
  b.planned_amount,
  b.category,
  b.is_non_boq,
  COALESCE(MAX(ri.qty_upto_date), 0)    AS executed_quantity,
  COALESCE(MAX(ri.amount_upto_date), 0) AS executed_amount,
  b.planned_quantity - COALESCE(MAX(ri.qty_upto_date), 0) AS remaining_quantity,
  b.planned_amount   - COALESCE(MAX(ri.amount_upto_date), 0) AS remaining_amount,
  CASE WHEN b.planned_quantity > 0
       THEN ROUND((COALESCE(MAX(ri.qty_upto_date), 0) / b.planned_quantity) * 100, 2)
       ELSE 0 END AS completion_percent,
  CASE
    WHEN COALESCE(MAX(ri.qty_upto_date), 0) = 0 THEN 'Not Started'
    WHEN b.planned_quantity > 0 AND COALESCE(MAX(ri.qty_upto_date), 0) >= b.planned_quantity THEN 'Completed'
    WHEN b.planned_quantity > 0 AND (COALESCE(MAX(ri.qty_upto_date), 0) / b.planned_quantity) > 1 THEN 'Exceeded BOQ'
    ELSE 'In Progress'
  END AS status
FROM boq_items b
LEFT JOIN ra_bill_items ri ON ri.boq_id = b.boq_id
GROUP BY b.boq_id, b.project_id, b.contract_id, b.item_code, b.item_number,
         b.description, b.unit, b.planned_quantity, b.unit_rate, b.planned_amount,
         b.category, b.is_non_boq;

-- VIEW: v_ra_bill_summary
CREATE OR REPLACE VIEW v_ra_bill_summary AS
SELECT
  r.ra_bill_id,
  r.project_id,
  r.ra_number,
  r.ra_code,
  r.bill_period_from,
  r.bill_period_to,
  r.basic_amount_this_bill,
  r.basic_amount_upto_date,
  r.gross_amount,
  r.net_payable,
  r.certified_amount,
  r.payment_received,
  r.stage,
  r.certified_amount - r.payment_received AS pending_payment,
  r.retention_amount,
  r.tds_amount,
  r.labour_cess_amount,
  p.project_name,
  p.project_code,
  o.org_name AS contractor_name,
  pc.contract_type
FROM ra_bills r
JOIN projects p           ON r.project_id   = p.project_id
JOIN project_contracts pc ON r.contract_id  = pc.contract_id
JOIN organizations o      ON pc.organization_id = o.organization_id;

-- VIEW: v_project_financial_summary
CREATE OR REPLACE VIEW v_project_financial_summary AS
SELECT
  p.project_id,
  p.project_name,
  p.project_code,
  p.contract_value,
  p.status,
  COALESCE(SUM(DISTINCT r.basic_amount_upto_date), 0) AS total_certified_basic,
  COALESCE(SUM(DISTINCT r.gross_amount), 0)            AS total_gross_amount,
  COALESCE(SUM(DISTINCT r.net_payable), 0)             AS total_net_payable,
  COALESCE(SUM(DISTINCT r.payment_received), 0)        AS total_received,
  COALESCE(SUM(DISTINCT r.retention_amount), 0)        AS total_retention,
  COALESCE(SUM(e.amount), 0)                           AS total_expenses,
  COALESCE(SUM(i.amount), 0)                           AS total_invested,
  COALESCE(SUM(DISTINCT r.payment_received), 0) - COALESCE(SUM(e.amount), 0) AS net_position,
  COUNT(DISTINCT r.ra_bill_id)                         AS total_ra_bills
FROM projects p
LEFT JOIN ra_bills r        ON r.project_id = p.project_id
LEFT JOIN project_expenses e ON e.project_id = p.project_id
LEFT JOIN investments i      ON i.project_id = p.project_id
GROUP BY p.project_id, p.project_name, p.project_code, p.contract_value, p.status;
