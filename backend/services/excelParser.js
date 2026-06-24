/**
 * excelParser.js
 * Reads real RA Bill Excel files (86-sheet TKTR-NIP structure)
 * 
 * Sheet structure:
 *   Abstract    → Project info + financial summary
 *   BOQ         → 82 work items (planning + execution data)
 *   10,20,30... → Measurement sheets (one per BOQ item)
 *   Non BOQ     → Extra work items beyond original scope
 *   120-Actual  → Actual measurement verification sheets
 */

const XLSX = require('xlsx');
const path = require('path');

/**
 * parseCellDate — Robustly converts any Excel date cell value to YYYY-MM-DD string.
 * Handles:
 *   - JavaScript Date objects (when cellDates:true is set in readFile)
 *   - Excel serial numbers (e.g., 45791.77083 → "2025-05-01")
 *   - String formats: DD-MM-YYYY or DD/MM/YYYY
 * Returns null if unparseable — caller should provide fallback.
 */
function parseCellDate(val) {
  // Case 1: JavaScript Date object (from cellDates: true)
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  // Case 2: Excel serial number (Excel epoch = 1899-12-30)
  if (typeof val === 'number' && val > 30000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const date  = new Date(epoch.getTime() + val * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  // Case 3: String formats
  if (typeof val === 'string') {
    const parts = val.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
    if (parts) return `${parts[3]}-${parts[2]}-${parts[1]}`;
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  }
  return null;
}

/**
 * parsePreview — quick parse for Step 2 UI preview
 * Returns: detected bill info + first 10 BOQ items + financial summary
 */
async function parsePreview(filePath, originalName) {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd'
  });

  const sheetNames = workbook.SheetNames;
  const preview = {
    file_name:          originalName,
    total_sheets:       sheetNames.length,
    detected_ra_number: null,
    detected_contractor: null,
    detected_client:     null,
    detected_project:    null,
    bill_period:         null,
    work_order_number:   null,
    financial_summary:   null,
    boq_sample:          [],
    measurement_sheets:  0,
    non_boq_sheets:      0,
    actual_sheets:       0,
    warnings:            []
  };

  // ── Abstract sheet ────────────────────────────────────────────
  if (sheetNames.includes('Abstract')) {
    const abstData = parseAbstractSheet(workbook.Sheets['Abstract']);
    preview.detected_ra_number  = abstData.ra_number;
    preview.detected_contractor = abstData.contractor;
    preview.detected_client     = abstData.client;
    preview.detected_project    = abstData.project_name;
    preview.bill_period         = abstData.bill_period;
    preview.work_order_number   = abstData.work_order_number;
    preview.financial_summary   = abstData.financial;
  }

  // ── BOQ sheet ─────────────────────────────────────────────────
  if (sheetNames.includes('BOQ')) {
    const boqData = parseBOQSheet(workbook.Sheets['BOQ']);
    preview.boq_sample    = boqData.items.slice(0, 10);
    preview.boq_total     = boqData.items.length;
    if (boqData.warnings) preview.warnings.push(...boqData.warnings);
  }

  // Count sheet types
  sheetNames.forEach(name => {
    const numName = parseInt(name);
    if (/^\d+$/.test(name.trim()) && numName > 0) {
      preview.measurement_sheets++;
    } else if (name.toLowerCase().includes('non boq') || name.toLowerCase().includes('non-boq')) {
      preview.non_boq_sheets++;
    } else if (name.toLowerCase().includes('-actual') || name.toLowerCase().includes('actual')) {
      preview.actual_sheets++;
    }
  });

  return preview;
}

/**
 * parseFullFile — complete parse for import pipeline
 */
async function parseFullFile(filePath) {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd'
  });

  const sheetNames = workbook.SheetNames;
  const result = {
    abstract:    null,
    boqItems:    [],
    measurements: [],
    nonBOQItems: [],
    errors:      []
  };

  // ── 1. Abstract ───────────────────────────────────────────────
  if (sheetNames.includes('Abstract')) {
    try {
      result.abstract = parseAbstractSheet(workbook.Sheets['Abstract']);
    } catch (e) {
      result.errors.push(`Abstract sheet parse error: ${e.message}`);
    }
  } else {
    result.errors.push('Abstract sheet not found — cannot detect RA Bill number');
  }

  // ── 2. BOQ ───────────────────────────────────────────────────
  if (sheetNames.includes('BOQ')) {
    try {
      const boqResult = parseBOQSheet(workbook.Sheets['BOQ']);
      result.boqItems = boqResult.items;
      if (boqResult.warnings) result.errors.push(...boqResult.warnings.map(w => `BOQ warning: ${w}`));
    } catch (e) {
      result.errors.push(`BOQ sheet parse error: ${e.message}`);
    }
  }

  // ── 3. Measurement sheets (numeric names: 10, 20, 30...) ──────
  sheetNames.forEach(name => {
    const numName = parseInt(name);
    if (/^\d+$/.test(name.trim()) && numName > 0) {
      try {
        const meas = parseMeasurementSheet(workbook.Sheets[name], numName, result.abstract?.ra_number);
        result.measurements.push(...meas.rows);
      } catch (e) {
        result.errors.push(`Sheet ${name} parse error: ${e.message}`);
      }
    }
  });

  // ── 4. Non-BOQ sheets ─────────────────────────────────────────
  sheetNames.forEach(name => {
    if (name.toLowerCase().includes('non boq') || name.toLowerCase().includes('non-boq')) {
      try {
        const nonBOQ = parseNonBOQSheet(workbook.Sheets[name], name, result.abstract?.ra_number);
        result.nonBOQItems.push(...nonBOQ.items);
      } catch (e) {
        result.errors.push(`Non-BOQ sheet ${name} parse error: ${e.message}`);
      }
    }
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────
// Abstract Sheet Parser
// ─────────────────────────────────────────────────────────────────
function parseAbstractSheet(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  const result = {
    project_name:     '',
    client:           '',
    contractor:       '',
    work_order_number:'',
    ra_number:        null,
    bill_period:      '',
    bill_period_from: null,
    bill_period_to:   null,
    financial:        {}
  };

  // Scan first 10 rows for header info
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    const rowStr = row.join(' ').toLowerCase();

    if (i === 0) result.project_name = (row[1] || row[0] || '').toString().trim();
    if (rowStr.includes('concession') || rowStr.includes('client') || rowStr.includes('toll road')) {
      result.client = extractValue(row);
    }
    if (rowStr.includes('contractor') && !rowStr.includes('sub')) {
      result.contractor = extractValue(row);
    }
    if (rowStr.includes('work order') || rowStr.includes('w.o.no') || rowStr.includes('serc')) {
      result.work_order_number = extractValue(row);
    }
    if (rowStr.includes('r.a.bill') || rowStr.includes('ra bill') || rowStr.includes('bill no')) {
      const match = rowStr.match(/(\d+)/);
      if (match) result.ra_number = parseInt(match[1]);
    }
    if (rowStr.includes('period') || rowStr.includes('from') || rowStr.includes('bill period')) {
      const periodStr = extractValue(row);
      result.bill_period = periodStr;
      // Try to parse dates from period string (e.g. "21-09-2025 to 30-10-2025")
      const dateMatch = periodStr.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g);
      if (dateMatch && dateMatch.length >= 2) {
        result.bill_period_from = parseDate(dateMatch[0]);
        result.bill_period_to   = parseDate(dateMatch[1]);
      }
    }
  }

  // Extract financial figures — scan all rows for known keywords
  const financial = {
    basic_amount_upto_date: 0,
    basic_amount_upto_prev: 0,
    basic_amount_this_bill: 0,
    sgst_percent:  9, sgst_amount: 0,
    cgst_percent:  9, cgst_amount: 0,
    retention_percent: 5, retention_amount: 0,
    tds_percent:   2,  tds_amount:  0,
    labour_cess_percent: 1, labour_cess_amount: 0,
    gross_amount:  0,
    net_payable:   0
  };

  data.forEach(row => {
    const rowStr = row.join(' ').toLowerCase();
    const nums   = extractNumbers(row);

    if (rowStr.includes('basic') || rowStr.includes('basic amount')) {
      if (nums.length >= 3) {
        financial.basic_amount_upto_date = nums[nums.length - 3] || 0;
        financial.basic_amount_upto_prev = nums[nums.length - 2] || 0;
        financial.basic_amount_this_bill = nums[nums.length - 1] || 0;
      } else if (nums.length === 1) {
        financial.basic_amount_this_bill = nums[0];
      }
    }
    if (rowStr.includes('sgst')) {
      const pct = rowStr.match(/(\d+)%/);
      if (pct) financial.sgst_percent = parseFloat(pct[1]);
      if (nums.length) financial.sgst_amount = nums[nums.length - 1];
    }
    if (rowStr.includes('cgst')) {
      const pct = rowStr.match(/(\d+)%/);
      if (pct) financial.cgst_percent = parseFloat(pct[1]);
      if (nums.length) financial.cgst_amount = nums[nums.length - 1];
    }
    if (rowStr.includes('gross')) {
      if (nums.length) financial.gross_amount = nums[nums.length - 1];
    }
    if (rowStr.includes('retention') || rowStr.includes('sd')) {
      const pct = rowStr.match(/(\d+(?:\.\d+)?)%/);
      if (pct) financial.retention_percent = parseFloat(pct[1]);
      if (nums.length) financial.retention_amount = nums[nums.length - 1];
    }
    if (rowStr.includes('tds') || rowStr.includes('income tax')) {
      const pct = rowStr.match(/(\d+(?:\.\d+)?)%/);
      if (pct) financial.tds_percent = parseFloat(pct[1]);
      if (nums.length) financial.tds_amount = nums[nums.length - 1];
    }
    if (rowStr.includes('labour cess') || rowStr.includes('labor cess')) {
      const pct = rowStr.match(/(\d+(?:\.\d+)?)%/);
      if (pct) financial.labour_cess_percent = parseFloat(pct[1]);
      if (nums.length) financial.labour_cess_amount = nums[nums.length - 1];
    }
    if (rowStr.includes('net payable') || rowStr.includes('net amount')) {
      if (nums.length) financial.net_payable = nums[nums.length - 1];
    }
  });

  result.financial = financial;
  return result;
}

// ─────────────────────────────────────────────────────────────────
// BOQ Sheet Parser
// ─────────────────────────────────────────────────────────────────
function parseBOQSheet(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  const items    = [];
  const warnings = [];

  // Data starts at row 10 (index 9) per the prompt specification
  // Headers span rows 8-9 (merged)
  // Col A=item_no, B=item_code, C=description, D=unit, E=plan_qty, F=rate, G=plan_amt
  // H=qty_upto_date, I=qty_upto_prev, J=qty_this_bill
  // K=amt_upto_date, L=amt_upto_prev, M=amt_this_bill

  let dataStart = 9; // default index 9 = row 10
  // Find data start by looking for first numeric item code
  for (let i = 5; i < Math.min(20, data.length); i++) {
    const row = data[i];
    const colB = (row[1] || '').toString().trim();
    const colA = (row[0] || '').toString().trim();
    if (colB && !isNaN(parseInt(colB)) && colB.length >= 4) {
      dataStart = i;
      break;
    }
    if (colA && !isNaN(parseInt(colA)) && parseInt(colA) > 0) {
      dataStart = i;
      break;
    }
  }

  for (let i = dataStart; i < data.length; i++) {
    const row = data[i];

    // item_code detection — skip if empty or non-numeric
    const rawCode = (row[1] || row[0] || '').toString().trim();
    if (!rawCode || isNaN(parseInt(rawCode))) continue;

    const itemNum   = parseInt((row[0] || '').toString()) || null;
    const itemCode  = rawCode;
    const desc      = (row[2] || '').toString().trim();
    const unit      = (row[3] || '').toString().trim();

    if (!desc || !unit) {
      warnings.push(`Row ${i + 1}: Missing description or unit for item ${itemCode}`);
      continue;
    }

    const parseNum = (v) => parseFloat((v || '0').toString().replace(/,/g, '')) || 0;

    items.push({
      item_number:       itemNum,
      item_code:         itemCode,
      description:       desc,
      unit:              unit,
      planned_quantity:  parseNum(row[4]),
      unit_rate:         parseNum(row[5]),
      planned_amount:    parseNum(row[6]),
      qty_upto_date:     parseNum(row[7]),
      qty_upto_previous: parseNum(row[8]),
      qty_this_bill:     parseNum(row[9]),
      amount_upto_date:  parseNum(row[10]),
      amount_upto_prev:  parseNum(row[11]),
      amount_this_bill:  parseNum(row[12]),
    });
  }

  return { items, warnings };
}

// ─────────────────────────────────────────────────────────────────
// Measurement Sheet Parser
// ─────────────────────────────────────────────────────────────────
function parseMeasurementSheet(sheet, sheetItemNumber, ipcNumber) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  const rows = [];

  // Row 7 = item code and description (index 6)
  // Row 8 = column headers (index 7)
  // Data from row 9+ (index 8+)
  // Cols: S.No | Date | RFI No | Description | From | To | Side | Nos | L | B | D | Quantity | IPC | Remarks

  let dataStart = 8;
  for (let i = 6; i < Math.min(15, data.length); i++) {
    const row = data[i];
    const first = (row[0] || '').toString().toLowerCase();
    if (first === 's.no' || first === 's no' || first === 'sno' || first === 'sl.no') {
      dataStart = i + 1;
      break;
    }
  }

  for (let i = dataStart; i < data.length; i++) {
    const row = data[i];
    const serialNo = parseInt((row[0] || '').toString());
    if (!serialNo || isNaN(serialNo)) continue;

    // Skip summary rows at bottom (Total / Up to Previous / This Bill)
    const desc = (row[3] || '').toString().toLowerCase();
    if (desc.includes('total') || desc.includes('up to previous') || desc.includes('this bill')) continue;

    const parseNum = (v) => parseFloat((v || '0').toString().replace(/,/g, '')) || 0;

    rows.push({
      sheet_item_number: sheetItemNumber,
      serial_no:     serialNo,
      date:          parseCellDate(row[1]) || new Date().toISOString().split('T')[0],
      rfi_number:    (row[2] || '').toString().trim(),
      description:   (row[3] || '').toString().trim(),
      location_from: parseNum(row[4]),
      location_to:   parseNum(row[5]),
      side:          (row[6] || '').toString().trim(),
      nos:           parseNum(row[7]),
      length:        parseNum(row[8]),
      breadth:       parseNum(row[9]),
      depth:         parseNum(row[10]),
      quantity:      parseNum(row[11]),
      ipc_number:    parseInt((row[12] || ipcNumber || '').toString()) || ipcNumber,
      remarks:       (row[13] || '').toString().trim(),
    });
  }

  return { rows };
}

// ─────────────────────────────────────────────────────────────────
// Non-BOQ Sheet Parser
// ─────────────────────────────────────────────────────────────────
function parseNonBOQSheet(sheet, sheetName, ipcNumber) {
  const data  = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  const items = [];

  let dataStart = 8;
  for (let i = 5; i < Math.min(15, data.length); i++) {
    const first = (data[i][0] || '').toString().toLowerCase();
    if (first === 's.no' || first === 's no' || first === 'sl.no') {
      dataStart = i + 1;
      break;
    }
  }

  for (let i = dataStart; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || isNaN(parseInt(row[0]))) continue;
    const parseNum = (v) => parseFloat((v || '0').toString().replace(/,/g, '')) || 0;

    items.push({
      sheet_name:    sheetName,
      serial_no:     parseInt(row[0]),
      description:   (row[1] || '').toString().trim(),
      unit:          (row[2] || '').toString().trim(),
      nos:           parseNum(row[3]),
      length:        parseNum(row[4]),
      breadth:       parseNum(row[5]),
      depth:         parseNum(row[6]),
      quantity:      parseNum(row[7]),
      unit_rate:     parseNum(row[8]),
      amount:        parseNum(row[9]),
      ipc_number:    ipcNumber,
      is_non_boq:    1,
    });
  }

  return { items };
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function extractValue(row) {
  for (let i = row.length - 1; i >= 0; i--) {
    const v = (row[i] || '').toString().trim();
    if (v && v.length > 2 && isNaN(v)) return v;
  }
  return '';
}

function extractNumbers(row) {
  return row
    .map(v => parseFloat((v || '').toString().replace(/,/g, '')))
    .filter(v => !isNaN(v) && v > 0);
}

function parseDate(str) {
  if (!str) return null;
  // Handles DD-MM-YYYY or DD/MM/YYYY
  const parts = str.split(/[-\/]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return null;
}

function formatDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  const str = val.toString().trim();
  if (!str) return null;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD-MM-YYYY
  const parts = str.split(/[-\/\.]/);
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Budget Sheet Parser
// ─────────────────────────────────────────────────────────────────
function parseBudgetExcel(filePath) {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd'
  });

  const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('budget')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error('Could not find a valid sheet in the Excel file');

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  const header = {
    project_name: '',
    department: '',
    supervisor_name: ''
  };

  // Extract header block (A3:B5 usually, but we search just in case)
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    const colA = (row[0] || '').toString().toLowerCase().trim();
    if (colA.includes('project name')) header.project_name = (row[1] || '').toString().trim();
    if (colA.includes('department')) header.department = (row[1] || '').toString().trim();
    if (colA.includes('supervisor')) header.supervisor_name = (row[1] || '').toString().trim();
  }

  // Find data start
  let dataStart = -1;
  for (let i = 0; i < data.length; i++) {
    const colB = (data[i][1] || '').toString().toLowerCase().trim();
    if (colB === 'project tasks') {
      dataStart = i + 1; // start reading from next row
      break;
    }
  }

  if (dataStart === -1) {
    throw new Error("This doesn't look like a Budget template — couldn't find the task table header.");
  }

  const items = [];
  const errors = [];
  const parseNum = (v) => parseFloat((v || '0').toString().replace(/,/g, '')) || 0;
  const isNumberString = (v) => v !== '' && !isNaN(parseFloat(v.toString().replace(/,/g, '')));
  const checkNumeric = (rowIdx, colName, colIdx, row) => {
    const val = (row[colIdx] || '').toString().trim();
    if (val !== '' && !isNumberString(val)) {
      errors.push(`Row ${rowIdx + 1}, ${colName} contains text, expected a number.`);
    }
  };

  for (let i = dataStart; i < data.length; i++) {
    const row = data[i];
    const taskName = (row[1] || '').toString().trim();
    
    // Stop condition
    if (!taskName || taskName.toLowerCase().includes('subtotal')) {
      break;
    }

    const wbsCode = (row[0] || '').toString().trim();
    
    // Validate numeric columns
    checkNumeric(i, 'Planned Hours', 3, row);
    checkNumeric(i, 'Actual Hours', 4, row);
    checkNumeric(i, 'Labor Rate', 5, row);
    checkNumeric(i, 'Planned Material Units', 6, row);
    checkNumeric(i, 'Material Rate', 7, row);
    checkNumeric(i, 'Travel Cost', 8, row);
    checkNumeric(i, 'Equipment Cost', 9, row);
    checkNumeric(i, 'Fixed Cost', 10, row);
    checkNumeric(i, 'Misc Cost', 11, row);

    items.push({
      wbs_code: wbsCode,
      task_name: taskName,
      assigned_to: (row[2] || '').toString().trim(),
      planned_hours: parseNum(row[3]),
      actual_hours: parseNum(row[4]),
      labor_rate: parseNum(row[5]),
      planned_material_units: parseNum(row[6]),
      material_rate: parseNum(row[7]), // Using actual_material_units column? Wait, spec: Col G is Planned Material Units, Col H is Material Rate. But the spec says: G=planned_material_units, H=material_rate. Wait, the schema has actual_material_units too. The excel template only has UNITS (G) and INR/UNITS (H).
      // If template only has planned_material_units, actual_material_units is 0 for import.
      actual_material_units: 0,
      travel_cost: parseNum(row[8]),
      equipment_cost: parseNum(row[9]),
      fixed_cost: parseNum(row[10]),
      misc_cost: parseNum(row[11]),
    });
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\\n'));
  }

  return { header, items };
}

/**
 * parseScheduleSheet — Parses the optional 'Schedule' sheet from v2 templates.
 * Returns null if sheet doesn't exist (old template — will auto-generate).
 */
function parseScheduleSheet(workbook) {
  const sheet = workbook.Sheets['Schedule'];
  if (!sheet) return null; // Old template — caller should auto-generate

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  const schedules = [];

  // Skip header row (row 0)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // Skip empty rows

    schedules.push({
      item_code: row[0]?.toString().trim(),
      period_start: parseCellDate(row[1]),
      period_end: parseCellDate(row[2]),
      planned_quantity: parseFloat(row[3]) || 0,
      planned_amount: parseFloat(row[4]) || 0,
      notes: row[7] || ''
    });
  }

  return schedules;
}

module.exports = { parsePreview, parseFullFile, parseBudgetExcel, parseScheduleSheet };
