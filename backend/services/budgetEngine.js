const db = require('../db');

/**
 * Recomputes the financial totals for a single budget_items row.
 * Does not write to DB, just calculates the fields.
 */
function calculateBudgetItemAmounts(item) {
  const budgeted = (parseFloat(item.planned_hours) || 0) * (parseFloat(item.labor_rate) || 0)
                 + (parseFloat(item.planned_material_units) || 0) * (parseFloat(item.material_rate) || 0)
                 + (parseFloat(item.fixed_cost) || 0);

  const actual = (parseFloat(item.actual_hours) || 0) * (parseFloat(item.labor_rate) || 0)
               + (parseFloat(item.actual_material_units) || 0) * (parseFloat(item.material_rate) || 0)
               + (parseFloat(item.travel_cost) || 0)
               + (parseFloat(item.equipment_cost) || 0)
               + (parseFloat(item.fixed_cost) || 0)
               + (parseFloat(item.misc_cost) || 0);

  const variance = budgeted - actual;

  return { 
    budgeted_amount: budgeted, 
    actual_amount: actual, 
    variance_amount: variance 
  };
}

/**
 * Returns the full budget state for a project, including items, totals, and reconciliation.
 */
async function getBudgetSummary(project_id) {
  const [budgetRows] = await db.execute(
    `SELECT * FROM project_budgets WHERE project_id = ?`,
    [project_id]
  );
  
  if (!budgetRows.length) {
    return null; // No budget exists yet
  }
  
  const budget = budgetRows[0];

  const [items] = await db.execute(
    `SELECT * FROM budget_items WHERE budget_id = ? ORDER BY display_order ASC`,
    [budget.budget_id]
  );

  let total_budgeted = 0;
  let total_actual = 0;
  let total_variance = 0;
  let total_planned_hours = 0;
  let total_actual_hours = 0;
  
  const categoryMap = {};

  items.forEach(item => {
    total_budgeted += parseFloat(item.budgeted_amount) || 0;
    total_actual += parseFloat(item.actual_amount) || 0;
    total_variance += parseFloat(item.variance_amount) || 0;
    total_planned_hours += parseFloat(item.planned_hours) || 0;
    total_actual_hours += parseFloat(item.actual_hours) || 0;
    
    const cat = item.category || 'Uncategorized';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { category: cat, budgeted: 0, actual: 0, variance: 0 };
    }
    categoryMap[cat].budgeted += parseFloat(item.budgeted_amount) || 0;
    categoryMap[cat].actual += parseFloat(item.actual_amount) || 0;
    categoryMap[cat].variance += parseFloat(item.variance_amount) || 0;
  });

  const category_breakdown = Object.values(categoryMap).sort((a,b) => b.budgeted - a.budgeted);

  // Reconciliation against project_expenses
  const [reconciliationRows] = await db.execute(
    `SELECT SUM(actual_amount) AS budget_actual_total,
            SUM(total_expenses_recorded) AS recorded_expenses_total,
            SUM(actual_amount) - SUM(total_expenses_recorded) AS discrepancy
     FROM v_budget_vs_actual
     WHERE project_id = ?`,
    [project_id]
  );
  
  const reconciliation = reconciliationRows.length ? reconciliationRows[0] : {
    budget_actual_total: 0,
    recorded_expenses_total: 0,
    discrepancy: 0
  };

  return {
    budget,
    items,
    totals: {
      total_budgeted,
      total_actual,
      total_variance,
      total_planned_hours,
      total_actual_hours
    },
    category_breakdown,
    reconciliation: {
      budget_actual_total: parseFloat(reconciliation.budget_actual_total) || 0,
      recorded_expenses_total: parseFloat(reconciliation.recorded_expenses_total) || 0,
      discrepancy: parseFloat(reconciliation.discrepancy) || 0
    }
  };
}

module.exports = { calculateBudgetItemAmounts, getBudgetSummary };
