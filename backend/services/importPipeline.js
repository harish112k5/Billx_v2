/**
 * importPipeline.js
 * Orchestrates Excel → DB in ONE atomic transaction
 * 
 * Flow:
 * 1. Parse the full Excel file
 * 2. Create/upsert ra_bills record (from Abstract)
 * 3. Upsert boq_items (from BOQ sheet)
 * 4. Insert ra_bill_items (one per BOQ row)
 * 5. Insert measurements (from all numbered sheets)
 * 6. Handle Non-BOQ items
 * All inside a single MySQL transaction — rollback on any error
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const excelParser = require('./excelParser');

async function runRABillImport({ project_id, contract_id, file_path, import_id, imported_by }) {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  const result = {
    ra_bill_id:              null,
    ra_number:               null,
    bill_period:             null,
    net_payable:             null,
    boq_items_processed:     0,
    measurements_processed:  0,
    non_boq_items:           0,
    errors:                  []
  };

  try {
    // ── 1. Parse Excel ─────────────────────────────────────────
    const parsed = await excelParser.parseFullFile(file_path);
    result.errors.push(...parsed.errors);

    const abs = parsed.abstract;
    if (!abs) throw new Error('Could not parse Abstract sheet — aborting import');

    const fin = abs.financial;
    result.ra_number  = abs.ra_number;
    result.bill_period = abs.bill_period;
    result.net_payable = fin.net_payable;

    // ── 2. Create ra_bill ──────────────────────────────────────
    const ra_bill_id = uuidv4();

    // Detect bill period dates
    let periodFrom = abs.bill_period_from;
    let periodTo   = abs.bill_period_to;
    if (!periodFrom) periodFrom = new Date().toISOString().split('T')[0];
    if (!periodTo)   periodTo   = new Date().toISOString().split('T')[0];

    // Get previous bill totals
    const [prevBills] = await conn.execute(
      'SELECT COALESCE(MAX(basic_amount_upto_date),0) AS prev_upto FROM ra_bills WHERE project_id=? AND contract_id=?',
      [project_id, contract_id]
    );
    const prevUpto = parseFloat(prevBills[0].prev_upto) || 0;

    await conn.execute(
      `INSERT INTO ra_bills
       (ra_bill_id, project_id, contract_id, ra_number, ra_code, bill_period_from, bill_period_to,
        basic_amount_upto_date, basic_amount_upto_prev, basic_amount_this_bill,
        sgst_percent, cgst_percent, sgst_amount, cgst_amount,
        retention_percent, retention_amount, tds_percent, tds_amount,
        labour_cess_percent, labour_cess_amount, gross_amount, total_deductions, net_payable,
        ipc_number, import_id, stage)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft')
       ON DUPLICATE KEY UPDATE
         bill_period_from=VALUES(bill_period_from), bill_period_to=VALUES(bill_period_to),
         basic_amount_upto_date=VALUES(basic_amount_upto_date),
         basic_amount_upto_prev=VALUES(basic_amount_upto_prev),
         basic_amount_this_bill=VALUES(basic_amount_this_bill),
         sgst_amount=VALUES(sgst_amount), cgst_amount=VALUES(cgst_amount),
         retention_amount=VALUES(retention_amount), tds_amount=VALUES(tds_amount),
         labour_cess_amount=VALUES(labour_cess_amount), gross_amount=VALUES(gross_amount),
         total_deductions=VALUES(total_deductions), net_payable=VALUES(net_payable),
         import_id=VALUES(import_id)`,
      [
        ra_bill_id, project_id, contract_id,
        abs.ra_number || 1,
        `RA-${String(abs.ra_number || 1).padStart(2,'0')}`,
        periodFrom, periodTo,
        fin.basic_amount_upto_date || 0,
        fin.basic_amount_upto_prev || prevUpto,
        fin.basic_amount_this_bill || 0,
        fin.sgst_percent, fin.cgst_percent,
        fin.sgst_amount, fin.cgst_amount,
        fin.retention_percent, fin.retention_amount,
        fin.tds_percent, fin.tds_amount,
        fin.labour_cess_percent, fin.labour_cess_amount,
        fin.gross_amount, fin.retention_amount + fin.tds_amount + fin.labour_cess_amount,
        fin.net_payable,
        abs.ra_number || 1,
        import_id
      ]
    );

    // Get actual ra_bill_id (in case of ON DUPLICATE KEY)
    const [existingBill] = await conn.execute(
      'SELECT ra_bill_id FROM ra_bills WHERE project_id=? AND contract_id=? AND ra_number=?',
      [project_id, contract_id, abs.ra_number || 1]
    );
    result.ra_bill_id = existingBill[0]?.ra_bill_id || ra_bill_id;

    // ── 3 & 4. BOQ items + ra_bill_items ──────────────────────
    for (const item of parsed.boqItems) {
      try {
        // Upsert boq_item
        const boq_id = uuidv4();
        await conn.execute(
          `INSERT INTO boq_items
           (boq_id, project_id, contract_id, item_code, item_number, description, unit, planned_quantity, unit_rate)
           VALUES (?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
             item_number=VALUES(item_number), description=VALUES(description),
             unit=VALUES(unit), planned_quantity=VALUES(planned_quantity), unit_rate=VALUES(unit_rate)`,
          [boq_id, project_id, contract_id, item.item_code, item.item_number,
           item.description, item.unit, item.planned_quantity, item.unit_rate]
        );

        // Get actual boq_id
        const [boqRow] = await conn.execute(
          'SELECT boq_id FROM boq_items WHERE project_id=? AND item_code=?',
          [project_id, item.item_code]
        );
        const actualBoqId = boqRow[0]?.boq_id;
        if (!actualBoqId) continue;

        // Insert ra_bill_item
        const ra_item_id = uuidv4();
        await conn.execute(
          `INSERT INTO ra_bill_items
           (ra_item_id, ra_bill_id, boq_id, qty_upto_date, qty_upto_previous, qty_this_bill,
            amount_upto_date, amount_upto_previous, amount_this_bill,
            qty_diff_from_boq, amount_diff_from_boq, unit_rate)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
             qty_upto_date=VALUES(qty_upto_date), qty_upto_previous=VALUES(qty_upto_previous),
             qty_this_bill=VALUES(qty_this_bill), amount_upto_date=VALUES(amount_upto_date),
             amount_upto_previous=VALUES(amount_upto_previous), amount_this_bill=VALUES(amount_this_bill)`,
          [
            ra_item_id, result.ra_bill_id, actualBoqId,
            item.qty_upto_date, item.qty_upto_previous, item.qty_this_bill,
            item.amount_upto_date, item.amount_upto_prev, item.amount_this_bill,
            item.qty_upto_date - item.planned_quantity,
            item.amount_upto_date - item.planned_amount,
            item.unit_rate
          ]
        );

        result.boq_items_processed++;
      } catch (itemErr) {
        result.errors.push(`BOQ item ${item.item_code}: ${itemErr.message}`);
      }
    }

    // ── 5. Measurements ───────────────────────────────────────
    const measurementErrors = [];

    for (const meas of parsed.measurements) {
      try {
        // ✅ FIX: Lookup by item_code (sheet name), NOT item_number.
        // item_number is the ordering index (1, 2, 3...).
        // item_code matches the sheet name (1001, 1002, etc.)
        // Also scoped by contract_id to prevent cross-contract collisions.
        const [boqRows] = await conn.execute(
          'SELECT boq_id FROM boq_items WHERE project_id=? AND contract_id=? AND item_code=?',
          [project_id, contract_id, meas.sheet_item_number.toString()]
        );

        if (!boqRows.length) {
          measurementErrors.push({
            type: 'measurement_boq_lookup_failed',
            sheet: meas.sheet_item_number,
            item_code: meas.sheet_item_number.toString(),
            serial_no: meas.serial_no,
            reason: 'No BOQ item found with matching item_code for this contract'
          });
          continue;
        }

        const actualBoqId = boqRows[0].boq_id;

        // Find ra_item_id
        const [raItemRows] = await conn.execute(
          'SELECT ra_item_id FROM ra_bill_items WHERE ra_bill_id=? AND boq_id=?',
          [result.ra_bill_id, actualBoqId]
        );

        if (!raItemRows.length) {
          measurementErrors.push({
            type: 'measurement_ra_item_lookup_failed',
            sheet: meas.sheet_item_number,
            boq_id: actualBoqId,
            ra_bill_id: result.ra_bill_id,
            reason: 'No RA bill item found for this BOQ item in this bill'
          });
          continue;
        }

        await conn.execute(
          `INSERT INTO measurements
           (measurement_id, ra_item_id, boq_id, ra_bill_id, serial_no, measurement_date,
            rfi_number, description, location_from, location_to, side, nos,
            length, breadth, depth, quantity, ipc_number, remarks)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            uuidv4(), raItemRows[0].ra_item_id, actualBoqId, result.ra_bill_id,
            meas.serial_no, meas.date || null,
            meas.rfi_number || null, meas.description || null,
            meas.location_from || null, meas.location_to || null,
            meas.side || null, meas.nos || null,
            meas.length || null, meas.breadth || null, meas.depth || null,
            meas.quantity, meas.ipc_number || null, meas.remarks || null
          ]
        );
        result.measurements_processed++;
      } catch (measErr) {
        result.errors.push(`Measurement serial ${meas.serial_no}: ${measErr.message}`);
      }
    }

    // Merge measurement errors into the main result errors
    result.errors.push(...measurementErrors.map(e => `[${e.type}] sheet=${e.sheet}: ${e.reason}`));

    // ── 6. Non-BOQ items ──────────────────────────────────────
    for (const nonBOQ of parsed.nonBOQItems) {
      try {
        const itemCode = `NONBOQ-${nonBOQ.sheet_name.replace(/\s/g,'')}-${nonBOQ.serial_no}`;
        const boq_id   = uuidv4();

        await conn.execute(
          `INSERT INTO boq_items
           (boq_id, project_id, contract_id, item_code, description, unit, planned_quantity, unit_rate, is_non_boq)
           VALUES (?,?,?,?,?,?,?,?,1)
           ON DUPLICATE KEY UPDATE description=VALUES(description)`,
          [boq_id, project_id, contract_id, itemCode, nonBOQ.description, nonBOQ.unit||'LS', nonBOQ.quantity, nonBOQ.unit_rate||0]
        );
        result.non_boq_items++;
      } catch (nbErr) {
        result.errors.push(`Non-BOQ ${nonBOQ.serial_no}: ${nbErr.message}`);
      }
    }

    await conn.commit();
    conn.release();
    return result;

  } catch (err) {
    await conn.rollback();
    conn.release();
    result.errors.push(`TRANSACTION ROLLED BACK: ${err.message}`);
    throw err;
  }
}

async function runBudgetImport({ project_id, file_path, import_id, imported_by }) {
  const conn = await db.getConnection();
  await conn.beginTransaction();
  
  try {
    const parsed = await excelParser.parseBudgetExcel(file_path);
    const { header, items } = parsed;

    // Check if project_budgets row exists for project_id
    const [existingBudget] = await conn.execute(
      'SELECT budget_id, status FROM project_budgets WHERE project_id = ?',
      [project_id]
    );

    let budget_id;
    if (existingBudget.length > 0) {
      if (existingBudget[0].status !== 'draft') {
        throw new Error('Budget is approved, use Revise instead');
      }
      budget_id = existingBudget[0].budget_id;
      await conn.execute(
        `UPDATE project_budgets SET department=?, supervisor_name=? WHERE budget_id=?`,
        [header.department || null, header.supervisor_name || null, budget_id]
      );
    } else {
      budget_id = uuidv4();
      await conn.execute(
        `INSERT INTO project_budgets (budget_id, project_id, department, supervisor_name, status, created_by)
         VALUES (?, ?, ?, ?, 'draft', ?)`,
        [budget_id, project_id, header.department || null, header.supervisor_name || null, imported_by]
      );
    }

    // Overwrite items for this draft budget to prevent duplication on multiple imports
    await conn.execute('DELETE FROM budget_items WHERE budget_id = ?', [budget_id]);

    const budgetEngine = require('./budgetEngine');
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const computed = budgetEngine.calculateBudgetItemAmounts(item);
      const budget_item_id = uuidv4();

      await conn.execute(
        `INSERT INTO budget_items (
           budget_item_id, budget_id, wbs_code, task_name, assigned_to, category,
           planned_hours, actual_hours, labor_rate,
           planned_material_units, actual_material_units, material_rate,
           travel_cost, equipment_cost, fixed_cost, misc_cost,
           budgeted_amount, actual_amount, variance_amount, display_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          budget_item_id, budget_id, item.wbs_code || null, item.task_name, item.assigned_to || null, item.category || 'Misc',
          item.planned_hours || 0, item.actual_hours || 0, item.labor_rate || 0,
          item.planned_material_units || 0, item.actual_material_units || 0, item.material_rate || 0,
          item.travel_cost || 0, item.equipment_cost || 0, item.fixed_cost || 0, item.misc_cost || 0,
          computed.budgeted_amount, computed.actual_amount, computed.variance_amount, i
        ]
      );
    }

    await conn.commit();
    conn.release();
    
    return await budgetEngine.getBudgetSummary(project_id);

  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
}

module.exports = { runRABillImport, runBudgetImport };
