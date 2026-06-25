const XLSX = require('xlsx');

/**
 * Generate RA Bill Template v2 with Schedule sheet
 * This creates the ACTUAL Excel file that users download
 */
function generateRABillTemplateV2() {
    const workbook = XLSX.utils.book_new();

    // ===== SHEET 1: Abstract (UNCHANGED from old template) =====
    const abstractData = [
        ['RA BILL ABSTRACT', '', ''],
        ['', '', ''],
        ['', '', ''],
        ['Project Name:', '', ''],
        ['Client:', '', ''],
        ['Contractor:', '', ''],
        ['Work Order No:', '', ''],
        ['R.A.Bill No:', '', ''],
        ['Bill Period:', '01-001-2025 to 28-001-2025', ''],
        ['', '', ''],
        ['', '', ''],
        ['FINANCIAL SUMMARY', '', ''],
        ['Description', 'Upto Previous', 'This Bill'],
        ['Basic Amount', 0, 600000],
        ['SGST 9%', 0, 54000],
        ['CGST 9%', 0, 54000],
        ['Gross Amount', 0, 708000],
        ['Retention 5%', 0, 35400],
        ['TDS 2%', 0, 14160],
        ['Labour Cess 1%', 0, 7080],
        ['Net Payable', 0, 651360]
    ];
    const abstractSheet = XLSX.utils.aoa_to_sheet(abstractData);
    XLSX.utils.book_append_sheet(workbook, abstractSheet, 'Abstract');

    // ===== SHEET 2: BOQ (UPDATED with Planned Start/End) =====
    const boqHeaders = [
        'Item No', 'Item Code', 'Description', 'Unit',
        'Planned Qty', 'Rate', 'Planned Amt',
        'Planned Start', 'Planned End',  // ← NEW COLUMNS
        'Qty Upto Date', 'Qty Upto Prev', 'Qty This Bill',
        'Amt Upto Date', 'Amt Upto Prev', 'Amt This Bill'
    ];

    const boqData = [
        boqHeaders,
        [1, 1001, 'Earthwork Excavation', 'CUM', 1000, 250, 250000, '2025-07-01', '2025-09-30', 510, 200, 310, 125000, 50000, 77500],
        [2, 1002, 'PCC 1:4:8', 'CUM', 500, 4500, 2250000, '2025-08-01', '2025-10-15', 105, 0, 105, 450000, 0, 472500],
        [3, 1003, 'RCC M25', 'CUM', 200, 8000, 1600000, '2025-09-01', '2025-11-30', 52, 10, 42, 400000, 80000, 336000]
    ];
    const boqSheet = XLSX.utils.aoa_to_sheet(boqData);
    XLSX.utils.book_append_sheet(workbook, boqSheet, 'BOQ');

    // ===== SHEET 3: Schedule (NEW — CRITICAL FOR TIME) =====
    const scheduleHeaders = ['Item Code', 'Period Start', 'Period End', 'Planned Qty', 'Planned Amount', 'Notes'];
    const scheduleData = [
        scheduleHeaders,
        [1001, '2025-07-01', '2025-07-31', 300, 75000, 'Foundation phase - initial excavation'],
        [1001, '2025-08-01', '2025-08-31', 400, 100000, 'Peak activity - main excavation'],
        [1001, '2025-09-01', '2025-09-30', 300, 75000, 'Closeout - final grading'],
        [1002, '2025-08-01', '2025-08-31', 250, 1125000, 'PCC base layer'],
        [1002, '2025-09-01', '2025-09-30', 150, 675000, 'PCC top layer'],
        [1002, '2025-10-01', '2025-10-15', 100, 450000, 'PCC finishing'],
        [1003, '2025-09-01', '2025-09-30', 80, 640000, 'RCC formwork & rebar'],
        [1003, '2025-10-01', '2025-10-31', 70, 560000, 'RCC concreting'],
        [1003, '2025-11-01', '2025-11-30', 50, 400000, 'RCC curing & deshuttering']
    ];
    const scheduleSheet = XLSX.utils.aoa_to_sheet(scheduleData);
    XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Schedule');

    // ===== SHEET 4: Measurement Sheet (example for Item 1001) =====
    const measHeaders = ['S.No', 'Date', 'RFI No', 'Description', 'From', 'To', 'Side', 'Nos', 'L', 'B', 'D', 'Quantity', 'IPC', 'Remarks'];
    const measData = [
        measHeaders,
        [1, '2025-01-14', 'RFI-101', 'Excavation LHS', 0, 100, 'LHS', 1, 100, 5, 1, 500, 1, 'Approved'],
        [2, '2025-01-15', 'RFI-102', 'Excavation RHS', 0, 100, 'RHS', 1, 100, 5, 1, 500, 1, 'Approved']
    ];
    const measSheet = XLSX.utils.aoa_to_sheet(measData);
    XLSX.utils.book_append_sheet(workbook, measSheet, '1001');

    // ===== SHEET 5: Non BOQ =====
    const nonBoqHeaders = ['S.No', 'Description', 'Unit', 'Nos', 'L', 'B', 'D', 'Quantity', 'Unit Rate', 'Amount'];
    const nonBoqData = [
        nonBoqHeaders,
        [1, 'Extra Soil Shifting', 'CUM', 1, 50, 10, 2, 1050, 150, 157500]
    ];
    const nonBoqSheet = XLSX.utils.aoa_to_sheet(nonBoqData);
    XLSX.utils.book_append_sheet(workbook, nonBoqSheet, 'Non BOQ');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate Budget Template v2 with Budget Schedule sheet
 */
function generateBudgetTemplateV2() {
    const workbook = XLSX.utils.book_new();

    // ===== SHEET 1: Budget (UPDATED with Planned Start/End) =====
    const budgetHeaders = [
        'Project Name', 'Department', 'WBS Code', 'Task Name', 'Assigned To',
        'Planned Start', 'Planned End',  // ← NEW COLUMNS
        'Planned Hours', 'Actual Hours', 'Labor Rate',
        'Material Units', 'Material Rate', 'Material Cost',
        'Travel Cost', 'Equipment Cost', 'Fixed Cost', 'Misc Cost', 'Total Cost'
    ];
    const budgetData = [
        budgetHeaders,
        ['TKTR-NIP', 'Civil', '1.1', 'Earthwork Excavation', 'Rajesh Kumar', '2025-07-01', '2025-07-31', 160, 140, 500, 2000, 50, 100000, 5000, 10000, 0, 2000, 117000],
        ['TKTR-NIP', 'Civil', '1.2', 'PCC 1:4:8', 'Suresh Patel', '2025-08-01', '2025-09-15', 240, 200, 600, 1500, 300, 450000, 8000, 15000, 0, 3000, 476000],
        ['TKTR-NIP', 'Civil', '1.3', 'RCC M25', 'Amit Sharma', '2025-09-01', '2025-11-30', 320, 280, 700, 800, 500, 400000, 10000, 20000, 5000, 4000, 439000],
        ['TKTR-NIP', 'Electrical', '2.1', 'Cable Laying', 'Ravi Mehta', '2025-10-01', '2025-11-30', 120, 100, 550, 5000, 80, 400000, 3000, 8000, 0, 1500, 412500]
    ];
    const budgetSheet = XLSX.utils.aoa_to_sheet(budgetData);
    XLSX.utils.book_append_sheet(workbook, budgetSheet, 'Budget');

    // ===== SHEET 2: Budget Schedule (NEW) =====
    const schedHeaders = ['WBS Code', 'Period Start', 'Period End', 'Planned Hours', 'Planned Cost', 'Actual Hours', 'Actual Cost'];
    const schedData = [
        schedHeaders,
        ['1.1', '2025-07-01', '2025-07-31', 80, 58500, 70, 51000],
        ['1.1', '2025-08-01', '2025-08-31', 80, 58500, 70, 51000],
        ['1.2', '2025-08-01', '2025-08-31', 120, 238000, 100, 198000],
        ['1.2', '2025-09-01', '2025-09-30', 80, 158000, 70, 138000],
        ['1.2', '2025-10-01', '2025-10-15', 40, 80000, 30, 60000],
        ['1.3', '2025-09-01', '2025-09-30', 100, 137250, 90, 123525],
        ['1.3', '2025-10-01', '2025-10-31', 110, 150975, 100, 137250],
        ['1.3', '2025-11-01', '2025-11-30', 110, 150975, 90, 123525]
    ];
    const schedSheet = XLSX.utils.aoa_to_sheet(schedData);
    XLSX.utils.book_append_sheet(workbook, schedSheet, 'Budget Schedule');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { generateRABillTemplateV2, generateBudgetTemplateV2 };
