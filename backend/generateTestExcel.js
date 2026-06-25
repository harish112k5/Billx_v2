const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, 'test_data');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// Baseline BOQ Items
const boqItems = [
    { code: 1001, desc: 'Earthwork Excavation', unit: 'CUM', plannedQty: 1000, rate: 250, start: '2025-01-01', end: '2025-03-31' },
    { code: 1002, desc: 'PCC 1:4:8', unit: 'CUM', plannedQty: 500, rate: 4500, start: '2025-02-01', end: '2025-05-31' },
    { code: 1003, desc: 'RCC M25', unit: 'CUM', plannedQty: 200, rate: 8000, start: '2025-04-01', end: '2025-08-31' }
];

// Baseline Schedule
const scheduleDataRows = [
    [1001, '2025-01-01', '2025-01-31', 300, 75000, 'Foundation phase'],
    [1001, '2025-02-01', '2025-02-28', 400, 100000, 'Peak activity'],
    [1001, '2025-03-01', '2025-03-31', 300, 75000, 'Closeout'],
    [1002, '2025-02-01', '2025-02-28', 100, 450000, 'PCC start'],
    [1002, '2025-03-01', '2025-03-31', 200, 900000, 'PCC mid'],
    [1002, '2025-04-01', '2025-04-30', 100, 450000, 'PCC close'],
    [1002, '2025-05-01', '2025-05-31', 100, 450000, 'PCC finish'],
    [1003, '2025-04-01', '2025-04-30', 50, 400000, 'RCC start'],
    [1003, '2025-05-01', '2025-05-31', 50, 400000, 'RCC mid'],
    [1003, '2025-06-01', '2025-06-30', 50, 400000, 'RCC mid'],
    [1003, '2025-07-01', '2025-07-31', 30, 240000, 'RCC close'],
    [1003, '2025-08-01', '2025-08-31', 20, 160000, 'RCC finish']
];

// Track cumulative progress
let cumulativeProgress = {
    1001: 0,
    1002: 0,
    1003: 0
};

// We will generate 10 RA Bills (from Jan 2025 to Oct 2025)
for (let i = 1; i <= 10; i++) {
    const workbook = XLSX.utils.book_new();
    
    const prevBasicAmt = Object.values(cumulativeProgress).reduce((sum, qty, idx) => sum + (qty * boqItems[idx].rate), 0);
    
    // Determine work done THIS month (simulate an S-curve progress)
    let workThisMonth = {
        1001: i <= 3 ? Math.floor(1000 / 3) : 0, // finishes in month 3
        1002: i >= 2 && i <= 5 ? Math.floor(500 / 4) : 0, // finishes in month 5
        1003: i >= 4 && i <= 8 ? Math.floor(200 / 5) : 0  // finishes in month 8
    };

    const currentBasicAmt = Object.keys(workThisMonth).reduce((sum, key) => {
        const item = boqItems.find(b => b.code == key);
        return sum + (workThisMonth[key] * item.rate);
    }, 0);

    const totalBasicAmt = prevBasicAmt + currentBasicAmt;

    // ===== SHEET 1: Abstract =====
    const abstractData = [
        ['RA BILL ABSTRACT', '', ''],
        ['', '', ''],
        ['', '', ''],
        ['Project Name:', 'TEST PROJECT 3D', ''],
        ['Client:', 'Test Client', ''],
        ['Contractor:', 'Test Contractor', ''],
        ['Work Order No:', 'WO-2025-001', ''],
        ['R.A.Bill No:', i, ''],
        ['Bill Period:', `01-${String(i).padStart(2,'0')}-2025 to 28-${String(i).padStart(2,'0')}-2025`, ''],
        ['', '', ''],
        ['', '', ''],
        ['FINANCIAL SUMMARY', '', ''],
        ['Description', 'Upto Previous', 'This Bill'],
        ['Basic Amount', prevBasicAmt, currentBasicAmt],
        ['SGST 9%', prevBasicAmt * 0.09, currentBasicAmt * 0.09],
        ['CGST 9%', prevBasicAmt * 0.09, currentBasicAmt * 0.09],
        ['Gross Amount', prevBasicAmt * 1.18, currentBasicAmt * 1.18],
        ['Retention 5%', prevBasicAmt * 0.05, currentBasicAmt * 0.05],
        ['TDS 2%', prevBasicAmt * 0.02, currentBasicAmt * 0.02],
        ['Labour Cess 1%', prevBasicAmt * 0.01, currentBasicAmt * 0.01],
        ['Net Payable', prevBasicAmt * 1.1, currentBasicAmt * 1.1]
    ];
    const abstractSheet = XLSX.utils.aoa_to_sheet(abstractData);
    XLSX.utils.book_append_sheet(workbook, abstractSheet, 'Abstract');

    // ===== SHEET 2: BOQ =====
    const boqHeaders = [
        'Item No', 'Item Code', 'Description', 'Unit',
        'Planned Qty', 'Rate', 'Planned Amt',
        'Planned Start', 'Planned End',
        'Qty Upto Date', 'Qty Upto Prev', 'Qty This Bill',
        'Amt Upto Date', 'Amt Upto Prev', 'Amt This Bill'
    ];

    const boqData = [boqHeaders];
    boqItems.forEach((item, idx) => {
        const qtyPrev = cumulativeProgress[item.code];
        const qtyThis = workThisMonth[item.code];
        const qtyUpto = qtyPrev + qtyThis;

        boqData.push([
            idx + 1, item.code, item.desc, item.unit,
            item.plannedQty, item.rate, item.plannedQty * item.rate,
            item.start, item.end,
            qtyUpto, qtyPrev, qtyThis,
            qtyUpto * item.rate, qtyPrev * item.rate, qtyThis * item.rate
        ]);
        
        // update for next iteration
        cumulativeProgress[item.code] += qtyThis;
    });

    const boqSheet = XLSX.utils.aoa_to_sheet(boqData);
    XLSX.utils.book_append_sheet(workbook, boqSheet, 'BOQ');

    // ===== SHEET 3: Schedule =====
    const scheduleHeaders = ['Item Code', 'Period Start', 'Period End', 'Planned Qty', 'Planned Amount', 'Notes'];
    const scheduleSheetData = [scheduleHeaders, ...scheduleDataRows];
    const scheduleSheet = XLSX.utils.aoa_to_sheet(scheduleSheetData);
    XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Schedule');

    // ===== SHEET 4,5,6: Measurements =====
    boqItems.forEach(item => {
        const qtyThis = workThisMonth[item.code];
        const measHeaders = ['S.No', 'Date', 'RFI No', 'Description', 'From', 'To', 'Side', 'Nos', 'L', 'B', 'D', 'Quantity', 'IPC', 'Remarks'];
        const measData = [measHeaders];
        
        if (qtyThis > 0) {
            measData.push([1, `2025-${String(i).padStart(2,'0')}-15`, `RFI-${i}`, `Work done month ${i}`, 0, 10, 'LHS', 1, 10, 1, 1, qtyThis, i, 'OK']);
        }
        
        const measSheet = XLSX.utils.aoa_to_sheet(measData);
        XLSX.utils.book_append_sheet(workbook, measSheet, item.code.toString());
    });

    const filePath = path.join(outputDir, `RA_Bill_${String(i).padStart(2,'0')}_Test_V2.xlsx`);
    XLSX.writeFile(workbook, filePath);
    console.log(`Generated: ${filePath}`);
}

console.log('Successfully generated 10 test files in test_data/');
