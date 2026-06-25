const fs = require('fs');
const jwt = require('jsonwebtoken');

async function runTest() {
  let report = '# Test Execution Report\n\n';
  const log = (msg) => {
    console.log(msg);
    report += msg + '\n';
  };

  // Generate Admin Token
  const token = jwt.sign(
    { user_id: 'USR-ADMIN-00001', role: 'super_admin' },
    'billx_v2_jwt_secret_2026_construction',
    { expiresIn: '1h' }
  );

  const req = async (method, path, body = null) => {
    const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`http://localhost:5000${path}`, opts);
    if (!r.ok) {
       let err = await r.text();
       try { err = JSON.parse(err).error || JSON.parse(err).message; } catch(e){}
       throw new Error(err || r.statusText);
    }
    return r.json();
  };

  try {
    log('## 0. Authenticating');
    log(`- Generated admin token locally.\n`);

    log('## 1. Creating Project');
    const projRes = await req('POST', '/api/projects', {
      project_code: 'HWY-A-008',
      project_name: 'Highway Alpha Phase 1',
      contract_value: 1000000,
      planned_profit: 200000,
      status: 'ongoing',
      contractor_id: '00000000-0000-0000-0000-000000000001'
    });
    const projectId = projRes.project_id;
    log(`- Project Created with ID: ${projectId}`);
    log(`- Planned Budget (Auto-calculated): ₹${projRes.planned_budget} (Expected: 800000)`);
    
    if (projRes.planned_budget == 800000) log('  ✅ Budget calculation is perfectly accurate.\n');
    else log('  ❌ Budget calculation failed.\n');

    log('## 2. Entering BOQ Items');
    const projDetails = await req('GET', `/api/projects/${projectId}`);
    const contractId = projDetails.data.contracts?.[0]?.contract_id || '';

    const boqItems = [
      { item_code: 'EW-01', description: 'Earthwork Excavation', unit: 'Cum', planned_quantity: 10000, unit_rate: 20, contract_id: contractId, item_number: null, category: null, phase: null },
      { item_code: 'CC-01', description: 'Concrete M30 Grade', unit: 'Cum', planned_quantity: 1000, unit_rate: 500, contract_id: contractId, item_number: null, category: null, phase: null },
      { item_code: 'BT-01', description: 'Asphalt / Bitumen Top', unit: 'Sqm', planned_quantity: 5000, unit_rate: 60, contract_id: contractId, item_number: null, category: null, phase: null }
    ];
    let boqMap = {};
    for (const item of boqItems) {
      const boqRes = await req('POST', `/api/projects/${projectId}/boq`, item);
      boqMap[item.item_code] = boqRes.boq_id || boqRes.data?.boq_id || boqRes.insertId;
      log(`- Inserted BOQ: ${item.item_code}`);
    }
    log('');

    log('## 3. Entering Budget Items');
    try {
      const budgetRes = await req('POST', `/api/projects/${projectId}/budget`, { status: 'draft' }).catch(()=>null);
      if (budgetRes) {
        const budgetId = budgetRes.budget_id;
        const budgetItems = [
          { category: 'Earthwork Costs', task_name: 'EW-01', fixed_cost: 150000 },
          { category: 'Concrete Costs', task_name: 'CC-01', fixed_cost: 420000 },
          { category: 'Asphalt Costs', task_name: 'BT-01', fixed_cost: 230000 }
        ];
        for (const item of budgetItems) {
          await req('POST', `/api/projects/${projectId}/budget/${budgetId}/items`, item);
        }
        log('- Budget Items entered successfully.\n');
      } else {
        log('- Note: Budget API not found or failed, skipping direct budget insertion.\n');
      }
    } catch(e) {
        log('- Note: Skipping budget items insertion.\n');
    }

    log('## 4. Entering Expenses');
    const expenses = [
      { expense_date: '2026-06-22', expense_type: 'machinery', category: 'Excavator', description: 'JCB Rental for week 1', amount: 40000, boq_id: boqMap['EW-01'], vendor_name: 'Alpha Rentals' },
      { expense_date: '2026-06-22', expense_type: 'movement', category: 'Diesel', description: 'Fuel for JCB', amount: 10000, boq_id: boqMap['EW-01'], vendor_name: 'Shell Pump' },
      { expense_date: '2026-06-22', expense_type: 'material', category: 'Cement', description: '1000 bags cement', amount: 150000, boq_id: boqMap['CC-01'], vendor_name: 'UltraTech' },
      { expense_date: '2026-06-22', expense_type: 'material', category: 'Steel', description: '5 tons rebar', amount: 60000, boq_id: boqMap['CC-01'], vendor_name: 'Tata Steel' },
      { expense_date: '2026-06-22', expense_type: 'manpower', category: 'Labor', description: 'Week 1 wages', amount: 40000, boq_id: boqMap['CC-01'], vendor_name: 'XYZ Contractors' },
      { expense_date: '2026-06-22', expense_type: 'misc', category: 'Office', description: 'Site office setup', amount: 20000, vendor_name: 'Local Store' }
    ];
    for (const exp of expenses) {
      const expRes = await req('POST', `/api/projects/${projectId}/expenses`, exp);
      log(`- Recorded expense: ₹${exp.amount} (${exp.expense_type})`);
      if (expRes.budget_exceeded) {
         log(`  * WARNING received: ${expRes.warning}`);
      }
    }
    log('');

    log('## 5. Entering RA Bill (Measurements)');
    try {
      const raBillRes = await req('POST', `/api/projects/${projectId}/ra-bills/full`, {
        contract_id: contractId,
        ra_number: 1,
        bill_period_from: '2026-06-01',
        bill_period_to: '2026-06-22',
        stage: 'Running',
        basic_amount_this_bill: 380000,
        boq_items: [
          { boq_id: boqMap['EW-01'], qty_this_bill: 4000, qty_upto_date: 4000, unit_rate: 20 },
          { boq_id: boqMap['CC-01'], qty_this_bill: 600, qty_upto_date: 600, unit_rate: 500 }
        ]
      });
      const raId = raBillRes.ra_bill_id || raBillRes.data?.ra_bill_id;
      log(`- RA Bill 1 Created with ID: ${raId}`);

      await req('PUT', `/api/ra-bills/${raId}/payment`, {
         payment_received: 350000,
         payment_date: '2026-06-23'
      });
      log('- Recorded payment of ₹350,000 against RA 1.\n');
    } catch (e) {
      log('- Failed to create RA bill: ' + e.message + '\n');
    }

    log('## 6. Verification Results');
    const analyticsRes = await req('GET', `/api/analytics/project/${projectId}`);
    const analytics = analyticsRes.data;
    
    log('### A. Dashboard & Project Overview');
    log(`- Budget Used %: ${analytics.budget_health.budget_used_percent}% (Expected: 40)`);
    if (analytics.budget_health.budget_used_percent == 40) log('  ✅ Match'); else log('  ❌ Mismatch');

    const budgetRemaining = analytics.budget_health.planned_budget - analytics.budget_health.total_expenses;
    log(`- Budget Remaining: ₹${budgetRemaining} (Expected: 480000)`);
    if (budgetRemaining == 480000) log('  ✅ Match'); else log('  ❌ Mismatch');

    log(`- Current Profit: ₹${analytics.budget_health.current_profit} (Expected: 30000)`);
    if (analytics.budget_health.current_profit == 30000) log('  ✅ Match'); else log('  ❌ Mismatch');
    
    log('\n### B. Analytics Page');
    log(`- Total Planned BOQ: ₹${analytics.planning.total_planned_amount} (Expected: 1000000)`);
    if (analytics.planning.total_planned_amount == 1000000) log('  ✅ Match'); else log('  ❌ Mismatch');

    log(`- Total Executed BOQ: ₹${analytics.execution.executed_amount} (Expected: 380000)`);
    
    log('\n### Expense Breakdown Pie Chart:');
    for (const [type, data] of Object.entries(analytics.expense_breakdown || {})) {
       log(`- ${type}: ₹${data}`);
    }
    
    const overrunRes = await req('GET', `/api/projects/${projectId}/budget-overrun`);
    log('\n### Budget Overrun Alerts:');
    if (!overrunRes.data.overrun_items || overrunRes.data.overrun_items.length === 0) {
      log('- No alerts (Expected, since costs are under budget)');
      log('  ✅ Match');
    } else {
      log('- Found alerts: ' + JSON.stringify(overrunRes.data.overrun_items));
    }
    
    log('\n### D. Testing Budget Overrun System');
    log('- Adding an extra ₹160,000 machinery expense to EW-01...');
    const expWarningRes = await req('POST', `/api/projects/${projectId}/expenses`, {
      expense_date: '2026-06-22', expense_type: 'machinery', category: 'Extra', amount: 160000, boq_id: boqMap['EW-01']
    });
    
    if (expWarningRes.budget_exceeded) {
       log(`- Warning System Triggered: "${expWarningRes.warning}"`);
       log('  ✅ System correctly identified budget overrun.');
    } else {
       log('  ❌ System failed to identify budget overrun.');
    }

    const overrunRes2 = await req('GET', `/api/projects/${projectId}/budget-overrun`);
    log('\nChecking Budget Overrun Alerts again:');
    if (overrunRes2.data.overrun_items && overrunRes2.data.overrun_items.length > 0) {
      log(`- Alert found for: ${overrunRes2.data.overrun_items[0].item_code} - ${overrunRes2.data.overrun_items[0].description}`);
      log('  ✅ Alert correctly populated in analytics endpoint.');
    } else {
      log('  ❌ Alert not found in analytics endpoint.');
    }

    fs.writeFileSync('C:\\Users\\haris\\.gemini\\antigravity-ide\\brain\\2a6e1329-f5c2-4bb7-b6eb-d50104c528a0\\test_report.md', report);
    console.log('\nReport generated at test_report.md');

  } catch (err) {
    console.error('ERROR:', err.message);
  }
}

runTest();
