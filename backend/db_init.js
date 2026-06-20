/**
 * db_init.js
 * 
 * Runs on every server startup (local + Render).
 * Ensures all MySQL VIEWs exist with the correct definitions.
 * Safe to run multiple times — uses CREATE OR REPLACE VIEW.
 */

const db = require('./db');

async function initDatabase() {
  console.log('🔧 Running DB init checks...');

  try {
    // ─────────────────────────────────────────
    // VIEW: v_boq_progress
    // ─────────────────────────────────────────
    await db.execute(`
      CREATE OR REPLACE VIEW \`v_boq_progress\` AS 
      SELECT 
        b.boq_id, b.project_id, b.contract_id, b.item_code,
        b.item_number, b.description, b.unit,
        b.planned_quantity, b.unit_rate, b.planned_amount,
        b.category, b.is_non_boq,
        COALESCE(MAX(ri.qty_upto_date), 0)    AS executed_quantity,
        COALESCE(MAX(ri.amount_upto_date), 0) AS executed_amount,
        b.planned_quantity - COALESCE(MAX(ri.qty_upto_date), 0)    AS remaining_quantity,
        b.planned_amount   - COALESCE(MAX(ri.amount_upto_date), 0) AS remaining_amount,
        CASE WHEN b.planned_quantity > 0
          THEN ROUND(COALESCE(MAX(ri.qty_upto_date), 0) / b.planned_quantity * 100, 2)
          ELSE 0
        END AS completion_percent,
        CASE
          WHEN COALESCE(MAX(ri.qty_upto_date), 0) = 0 THEN 'Not Started'
          WHEN b.planned_quantity > 0 AND COALESCE(MAX(ri.qty_upto_date), 0) >= b.planned_quantity THEN 'Completed'
          WHEN b.planned_quantity > 0 AND COALESCE(MAX(ri.qty_upto_date), 0) / b.planned_quantity > 1 THEN 'Exceeded BOQ'
          ELSE 'In Progress'
        END AS status
      FROM boq_items b
      LEFT JOIN ra_bill_items ri ON ri.boq_id = b.boq_id
      GROUP BY
        b.boq_id, b.project_id, b.contract_id, b.item_code,
        b.item_number, b.description, b.unit,
        b.planned_quantity, b.unit_rate, b.planned_amount,
        b.category, b.is_non_boq
    `);
    console.log('  ✅ v_boq_progress OK');

    // ─────────────────────────────────────────
    // VIEW: v_project_financial_summary
    // ─────────────────────────────────────────
    await db.execute(`
      CREATE OR REPLACE VIEW \`v_project_financial_summary\` AS
      SELECT
        p.project_id, p.project_name, p.project_code,
        p.contract_value, p.status,
        COALESCE(SUM(DISTINCT r.basic_amount_upto_date), 0) AS total_certified_basic,
        COALESCE(SUM(DISTINCT r.gross_amount), 0)           AS total_gross_amount,
        COALESCE(SUM(DISTINCT r.net_payable), 0)            AS total_net_payable,
        COALESCE(SUM(DISTINCT r.payment_received), 0)       AS total_received,
        COALESCE(SUM(DISTINCT r.retention_amount), 0)       AS total_retention,
        COALESCE(SUM(e.amount), 0)                          AS total_expenses,
        COALESCE(SUM(i.amount), 0)                          AS total_invested,
        COALESCE(SUM(DISTINCT r.payment_received), 0) - COALESCE(SUM(e.amount), 0) AS net_position,
        COUNT(DISTINCT r.ra_bill_id)                        AS total_ra_bills
      FROM projects p
      LEFT JOIN ra_bills         r ON r.project_id = p.project_id
      LEFT JOIN project_expenses e ON e.project_id = p.project_id
      LEFT JOIN investments      i ON i.project_id = p.project_id
      GROUP BY p.project_id, p.project_name, p.project_code, p.contract_value, p.status
    `);
    console.log('  ✅ v_project_financial_summary OK');

    // ─────────────────────────────────────────
    // VIEW: v_ra_bill_summary
    // ─────────────────────────────────────────
    await db.execute(`
      CREATE OR REPLACE VIEW \`v_ra_bill_summary\` AS
      SELECT
        r.ra_bill_id, r.project_id, r.ra_number, r.ra_code,
        r.bill_period_from, r.bill_period_to,
        r.basic_amount_this_bill, r.basic_amount_upto_date,
        r.gross_amount, r.net_payable,
        r.certified_amount, r.payment_received,
        r.stage,
        r.certified_amount - r.payment_received AS pending_payment,
        r.retention_amount, r.tds_amount, r.labour_cess_amount,
        p.project_name, p.project_code,
        o.org_name      AS contractor_name,
        pc.contract_type
      FROM ra_bills r
      JOIN projects          p  ON r.project_id     = p.project_id
      JOIN project_contracts pc ON r.contract_id    = pc.contract_id
      JOIN organizations     o  ON pc.organization_id = o.organization_id
    `);
    console.log('  ✅ v_ra_bill_summary OK');

    console.log('✅ DB init complete.\n');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
    // Don't crash server — just log the error
  }
}

module.exports = initDatabase;
