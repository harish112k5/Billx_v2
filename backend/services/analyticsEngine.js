/**
 * analyticsEngine.js
 * All calculation logic for BillX V2
 * 
 * Core rules (from prompt Part 10):
 * - BOQ is the foundation — every number traces back to a BOQ item
 * - Planning and Execution NEVER merge
 * - Sandwich layers are connected but independent
 * - Always maintain: This Bill / Upto Previous / Upto Date
 * - Abstract sheet numbers are the truth
 */

const db = require('../db');

// ─────────────────────────────────────────────────────────────────
// Full Project Dashboard (used by /projects/:id/dashboard)
// ─────────────────────────────────────────────────────────────────
async function getProjectDashboard(project_id) {
  const [projectRows] = await db.execute(
    `SELECT p.*, GROUP_CONCAT(DISTINCT o.org_name SEPARATOR ', ') AS contractors
     FROM projects p
     LEFT JOIN project_contracts pc ON pc.project_id = p.project_id
     LEFT JOIN organizations o ON pc.organization_id = o.organization_id
     WHERE p.project_id = ?
     GROUP BY p.project_id`,
    [project_id]
  );
  if (!projectRows.length) throw new Error('Project not found');
  const project = projectRows[0];

  // ── BOQ Summary ──────────────────────────────────────────────
  const [boqSummary] = await db.execute(
    `SELECT
       COUNT(*) AS total_items,
       SUM(CASE WHEN status='Completed'    THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN status='In Progress'  THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN status='Not Started'  THEN 1 ELSE 0 END) AS not_started,
       SUM(CASE WHEN status='Exceeded BOQ' THEN 1 ELSE 0 END) AS exceeded_boq,
       SUM(CASE WHEN is_non_boq=1          THEN 1 ELSE 0 END) AS non_boq_count,
       COALESCE(SUM(planned_amount),0)               AS total_planned_amount,
       COALESCE(SUM(executed_amount),0)              AS total_executed_amount,
       ROUND(COALESCE(AVG(CASE WHEN is_non_boq=0 THEN completion_percent END),0),2) AS avg_completion
     FROM v_boq_progress WHERE project_id = ?`,
    [project_id]
  );
  const boq = boqSummary[0];

  // ── Latest RA Bill for hero metrics ──────────────────────────
  const [latestRA] = await db.execute(
    `SELECT * FROM ra_bills WHERE project_id = ? ORDER BY ra_number DESC LIMIT 1`,
    [project_id]
  );
  const latest = latestRA[0] || {};

  // ── All RA Bills ──────────────────────────────────────────────
  const [allRA] = await db.execute(
    `SELECT ra_number, ra_code, bill_period_from, bill_period_to,
            basic_amount_this_bill, basic_amount_upto_date,
            gross_amount, net_payable, certified_amount, payment_received,
            retention_amount, tds_amount, stage
     FROM ra_bills WHERE project_id = ? ORDER BY ra_number`,
    [project_id]
  );

  // ── Billing totals (from all RA Bills combined) ───────────────
  const [billingTotals] = await db.execute(
    `SELECT
       COALESCE(MAX(basic_amount_upto_date),0) AS total_basic_upto_date,
       COALESCE(SUM(gross_amount),0)           AS total_gross,
       COALESCE(SUM(payment_received),0)       AS total_received,
       COALESCE(SUM(certified_amount),0)       AS total_certified,
       COALESCE(SUM(retention_amount),0)       AS total_retention,
       COALESCE(SUM(tds_amount),0)             AS total_tds,
       COALESCE(SUM(labour_cess_amount),0)     AS total_labour_cess,
       COALESCE(SUM(net_payable),0)            AS total_net_payable
     FROM ra_bills WHERE project_id = ?`,
    [project_id]
  );
  const billing = billingTotals[0];

  // ── Top BOQ items (for section D table) ──────────────────────
  const [topBOQ] = await db.execute(
    `SELECT item_code, description, unit, planned_quantity, planned_amount,
            executed_quantity, executed_amount, completion_percent, status, category
     FROM v_boq_progress WHERE project_id = ?
     ORDER BY planned_amount DESC LIMIT 20`,
    [project_id]
  );

  // ── Sandwich Layer check ──────────────────────────────────────
  const [mainContracts] = await db.execute(
    `SELECT pc.contract_id, o.org_name, o.org_type
     FROM project_contracts pc JOIN organizations o ON pc.organization_id=o.organization_id
     WHERE pc.project_id=? AND pc.contract_type='main'`, [project_id]
  );
  const [subContracts] = await db.execute(
    `SELECT pc.contract_id, o.org_name, o.org_type, COUNT(a.allocation_id) AS alloc_count
     FROM project_contracts pc JOIN organizations o ON pc.organization_id=o.organization_id
     LEFT JOIN boq_allocations a ON a.organization_id=o.organization_id
     WHERE pc.project_id=? AND pc.contract_type='subcontract'
     GROUP BY pc.contract_id`, [project_id]
  );

  let sandwichMode = 'none';
  if (mainContracts.length > 0 && subContracts.length > 0) sandwichMode = 'full';
  else if (mainContracts.length > 0) sandwichMode = 'main_only';
  else if (subContracts.length > 0) sandwichMode = 'sub_only';

  // ── Variance ──────────────────────────────────────────────────
  const execAmt   = parseFloat(boq.total_executed_amount) || 0;
  const planAmt   = parseFloat(boq.total_planned_amount)  || 0;
  const varAmt    = execAmt - planAmt;
  const varPct    = planAmt > 0 ? ((varAmt / planAmt) * 100).toFixed(2) : 0;

  return {
    project: {
      project_id:        project.project_id,
      project_code:      project.project_code,
      project_name:      project.project_name,
      project_location:  project.project_location,
      client_name:       project.client_name,
      work_order_number: project.work_order_number,
      contract_value:    parseFloat(project.contract_value) || 0,
      start_date:        project.start_date,
      end_date:          project.end_date,
      status:            project.status,
    },
    planning: {
      total_boq_items:    parseInt(boq.total_items) || 0,
      total_planned_amount: parseFloat(boq.total_planned_amount) || 0,
      non_boq_items:      parseInt(boq.non_boq_count) || 0,
      completed_items:    parseInt(boq.completed) || 0,
      in_progress_items:  parseInt(boq.in_progress) || 0,
      not_started_items:  parseInt(boq.not_started) || 0,
      exceeded_boq_items: parseInt(boq.exceeded_boq) || 0,
      avg_completion:     parseFloat(boq.avg_completion) || 0,
    },
    execution: {
      latest_ra_number:         latest.ra_number || 0,
      total_ra_bills:           allRA.length,
      amount_upto_date:         parseFloat(billing.total_basic_upto_date) || 0,
      amount_this_bill:         parseFloat(latest.basic_amount_this_bill) || 0,
      amount_upto_previous:     parseFloat(latest.basic_amount_upto_prev) || 0,
      executed_amount:          parseFloat(boq.total_executed_amount) || 0,
      bill_period_from:         latest.bill_period_from,
      bill_period_to:           latest.bill_period_to,
    },
    billing: {
      gross_amount_upto_date:   parseFloat(billing.total_gross) || 0,
      net_payable_upto_date:    parseFloat(billing.total_net_payable) || 0,
      certified_amount:         parseFloat(billing.total_certified) || 0,
      payment_received:         parseFloat(billing.total_received) || 0,
      pending_payment:          Math.max(0, (parseFloat(billing.total_certified) || 0) - (parseFloat(billing.total_received) || 0)),
      retention_held:           parseFloat(billing.total_retention) || 0,
      tds_deducted:             parseFloat(billing.total_tds) || 0,
      labour_cess:              parseFloat(billing.total_labour_cess) || 0,
    },
    variance: {
      planned_vs_executed_amount:  varAmt,
      planned_vs_executed_percent: parseFloat(varPct),
      items_over_boq:  parseInt(boq.exceeded_boq) || 0,
      items_under_boq: parseInt(boq.in_progress)  || 0,
      items_not_started: parseInt(boq.not_started) || 0,
    },
    ra_progression: allRA.map(r => ({
      ra:               r.ra_number,
      ra_code:          r.ra_code,
      period:           `${r.bill_period_from} to ${r.bill_period_to}`,
      basic_this_bill:  parseFloat(r.basic_amount_this_bill) || 0,
      cumulative_basic: parseFloat(r.basic_amount_upto_date) || 0,
      gross:            parseFloat(r.gross_amount) || 0,
      net_payable:      parseFloat(r.net_payable) || 0,
      certified:        parseFloat(r.certified_amount) || 0,
      received:         parseFloat(r.payment_received) || 0,
      pending:          Math.max(0, (parseFloat(r.certified_amount)||0) - (parseFloat(r.payment_received)||0)),
      stage:            r.stage,
    })),
    top_boq_items: topBOQ,
    sandwich: {
      mode:           sandwichMode,
      main_contracts: mainContracts,
      sub_contracts:  subContracts,
    }
  };
}

// ─────────────────────────────────────────────────────────────────
// Full Project Analytics (used by /analytics/project/:id)
// ─────────────────────────────────────────────────────────────────
async function getProjectAnalytics(project_id) {
  const dashboard = await getProjectDashboard(project_id);

  // Additional: category breakdown
  const [categoryBreakdown] = await db.execute(
    `SELECT category,
            COUNT(*) AS item_count,
            SUM(planned_amount) AS planned,
            SUM(executed_amount) AS executed,
            ROUND(AVG(completion_percent),2) AS avg_completion
     FROM v_boq_progress
     WHERE project_id = ? AND is_non_boq = 0 AND category IS NOT NULL
     GROUP BY category
     ORDER BY planned DESC`,
    [project_id]
  );

  // Expenses breakdown
  const [expenses] = await db.execute(
    `SELECT category, SUM(amount) AS total,
            COUNT(*) AS count
     FROM project_expenses WHERE project_id=?
     GROUP BY category`,
    [project_id]
  );

  return {
    ...dashboard,
    category_breakdown: categoryBreakdown,
    expenses_breakdown: expenses
  };
}

// ─────────────────────────────────────────────────────────────────
// Cashflow Analysis
// ─────────────────────────────────────────────────────────────────
async function getCashflow(project_id) {
  const [payments] = await db.execute(
    `SELECT payment_date, payment_received AS amount, 'inflow' AS type, ra_code AS label
     FROM ra_bills WHERE project_id=? AND payment_received > 0
     ORDER BY payment_date`,
    [project_id]
  );

  const [expenses] = await db.execute(
    `SELECT expense_date AS payment_date, amount, 'outflow' AS type, category AS label
     FROM project_expenses WHERE project_id=?
     ORDER BY expense_date`,
    [project_id]
  );

  const [investments] = await db.execute(
    `SELECT investment_date AS payment_date, amount, 'investment' AS type, 'Investment In' AS label
     FROM investments WHERE project_id=?
     ORDER BY investment_date`,
    [project_id]
  );

  const allEvents = [...payments, ...expenses, ...investments]
    .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

  const totalInflow    = payments.reduce((s, r) => s + parseFloat(r.amount), 0);
  const totalOutflow   = expenses.reduce((s, r) => s + parseFloat(r.amount), 0);
  const totalInvested  = investments.reduce((s, r) => s + parseFloat(r.amount), 0);

  return {
    total_inflow:    totalInflow,
    total_outflow:   totalOutflow,
    total_invested:  totalInvested,
    net_position:    totalInflow - totalOutflow,
    events:          allEvents
  };
}

module.exports = { getProjectDashboard, getProjectAnalytics, getCashflow };
