const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const testDataDir = path.join(__dirname, 'test_data');
if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir);
}

// ----------------------------------------------------
// 1. Generate RA Bill Excel
// ----------------------------------------------------
function generateRABill() {
    const workbook = XLSX.utils.book_new();

    // -- Abstract Sheet --
    const abstractData = [
        ['Project Name:', 'Manual Test Project', ''],
        ['Client:', 'Test Client', ''],
        ['Contractor:', 'Notch India Projects Pvt Ltd', ''],
        ['Work Order No:', 'sc002', ''],
        ['R.A.Bill No:', 1, ''],
        ['Bill Period:', '25-01-2026 to 11-07-2026', ''],
        ['', '', '', ''],
        ['FINANCIAL SUMMARY', '', '', ''],
        ['Description', 'Upto Date', 'Upto Previous', 'This Bill'],
        ['Basic Amount', 300000, 0, 300000],
        ['SGST 9%', 27000, 0, 27000],
        ['CGST 9%', 27000, 0, 27000],
        ['Gross Amount', 354000, 0, 354000],
        ['Retention 5%', 15000, 0, 15000],
        ['TDS 2%', 6000, 0, 6000],
        ['Labour Cess 1%', 3000, 0, 3000],
        ['Net Payable', 330000, 0, 330000]
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(abstractData), 'Abstract');

    // -- BOQ Sheet (V2 with planned start/end) --
    // We will distribute items between 25-01-2026 and 11-07-2026
    const boqData = [
        [
            'Item No', 'Item Code', 'Description', 'Unit', 'Planned Qty', 'Rate', 'Planned Amt',
            'Planned Start', 'Planned End',
            'Qty Upto Date', 'Qty Upto Prev', 'Qty This Bill',
            'Amt Upto Date', 'Amt Upto Prev', 'Amt This Bill'
        ],
        [
            1, '1001', 'Initial Setup & Clearance', 'SQM', 1000, 100, 100000,
            '2026-01-25', '2026-02-15',
            1000, 0, 1000, 100000, 0, 100000
        ],
        [
            2, '1002', 'Earthworks & Excavation', 'CUM', 500, 400, 200000,
            '2026-02-16', '2026-04-30',
            250, 0, 250, 100000, 0, 100000
        ],
        [
            3, '1003', 'Foundation Structure', 'CUM', 100, 5000, 500000,
            '2026-05-01', '2026-07-11',
            20, 0, 20, 100000, 0, 100000
        ]
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(boqData), 'BOQ');

    // -- Measurement Sheets --
    ['1001', '1002', '1003'].forEach((code, idx) => {
        const measData = [
            ['S.No', 'Date', 'RFI No', 'Description', 'From', 'To', 'Side', 'Nos', 'L', 'B', 'D', 'Quantity', 'IPC', 'Remarks'],
            [1, '2026-02-01', 'RFI-01', 'Measurement 1', 0, 50, 'LHS', 1, 50, 10, 1, code === '1001' ? 1000 : (code === '1002' ? 250 : 20), 1, 'OK']
        ];
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(measData), code);
    });

    const filePath = path.join(testDataDir, 'Manual_Test_RA.xlsx');
    XLSX.writeFile(workbook, filePath);
    console.log(`✅ Created RA Bill Excel: ${filePath}`);
    return filePath;
}

// ----------------------------------------------------
// 2. Generate Budget Excel
// ----------------------------------------------------
function generateBudget() {
    const workbook = XLSX.utils.book_new();

    // -- Budget Summary / Header (Optional but good practice) --
    const headerData = [
        ['Department', 'Construction'],
        ['Supervisor Name', 'DK']
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(headerData), 'Header');

    // -- Budget Items --
    const budgetData = [
        ['WBS Code', 'Task Name', 'Category', 'Assigned To', 'Planned Hours', 'Actual Hours', 'Labor Rate', 'Planned Material Units', 'Actual Material Units', 'Material Rate', 'Travel Cost', 'Equipment Cost', 'Fixed Cost', 'Misc Cost'],
        ['WBS-1', 'Initial Setup', 'Labor', 'DK', 100, 0, 200, 0, 0, 0, 0, 0, 0, 0],
        ['WBS-2', 'Earthworks', 'Equipment', 'DK', 200, 0, 150, 50, 0, 1000, 0, 0, 0, 0],
        ['WBS-3', 'Foundation', 'Materials', 'DK', 300, 0, 250, 100, 0, 3000, 0, 0, 0, 0]
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(budgetData), 'Budget Items');

    // -- Budget Schedule Sheet (New format for Time Dimension) --
    const scheduleData = [
        ['WBS Code', 'Period Start', 'Period End', 'Planned Hours', 'Planned Cost', 'Actual Hours', 'Actual Cost'],
        ['WBS-1', '2026-01-25', '2026-02-15', 100, 37000, 0, 0],
        ['WBS-2', '2026-02-16', '2026-04-30', 200, 130000, 0, 0],
        ['WBS-3', '2026-05-01', '2026-07-11', 300, 405000, 0, 0]
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(scheduleData), 'Budget Schedule');

    const filePath = path.join(testDataDir, 'Manual_Test_Budget.xlsx');
    XLSX.writeFile(workbook, filePath);
    console.log(`✅ Created Budget Excel: ${filePath}`);
    return filePath;
}

try {
    console.log('Generating files for dates 25-01-2026 to 11-07-2026...');
    const raPath = generateRABill();
    const budgetPath = generateBudget();
    console.log('\nFiles are ready for manual upload via the UI.');
} catch (e) {
    console.error('Error generating files:', e);
}
