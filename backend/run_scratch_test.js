const mysql = require('mysql2/promise');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { runRABillImport } = require('./services/importPipeline');
const excelParser = require('./services/excelParser');

async function runTest() {
    console.log("🚀 Starting Scratch Test...");

    // 1. Database Connection
    const db = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'billx_v2'
    });

    try {
        // 2. Create Project from scratch
        const projectId = uuidv4();
        const contractId = uuidv4();
        const orgId = uuidv4();

        // Insert Organization (Main Contractor)
        await db.execute(
            `INSERT INTO organizations (organization_id, org_name, org_type) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE org_name=VALUES(org_name)`,
            [orgId, 'Notch India Projects Pvt Ltd', 'contractor']
        );

        // Insert Project
        const projectName = "Scratch Project 2026";
        const contractValue = 5000000.00;
        const plannedBudget = 4500000.00;
        const plannedProfit = 500000.00;

        await db.execute(
            `INSERT INTO projects (project_id, project_name, project_code, contract_value, planned_budget, planned_profit, work_order_number, start_date, end_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [projectId, projectName, 'SP-' + Date.now(), contractValue, plannedBudget, plannedProfit, 'WO-2026-001', '2026-06-01', '2026-12-31', 'ongoing']
        );

        // Insert Contract
        await db.execute(
            `INSERT INTO project_contracts (contract_id, project_id, organization_id, contract_type, status)
             VALUES (?, ?, ?, ?, ?)`,
            [contractId, projectId, orgId, 'main', 'active']
        );

        console.log(`✅ Project Created: ${projectName} (${projectId})`);

        // 3. Create BOQ & Budget Sheet (Excel)
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        
        const boqItems = [
            { code: '1001', desc: 'Site Clearance', unit: 'SQM', plannedQty: 1000, rate: 50, start: '2026-06-01', end: '2026-06-15' },
            { code: '1002', desc: 'Excavation', unit: 'CUM', plannedQty: 500, rate: 300, start: '2026-06-10', end: '2026-06-30' },
            { code: '1003', desc: 'Foundation Concrete', unit: 'CUM', plannedQty: 200, rate: 5000, start: '2026-06-20', end: '2026-07-20' }
        ];

        // We will generate RA Bill 01 simulating 50% work on B001 and B002
        const workbook = XLSX.utils.book_new();

        // Abstract
        const currentBasicAmt = (500 * 50) + (250 * 300); // 25000 + 75000 = 100000
        const abstractData = [
            ['RA BILL ABSTRACT', '', ''],
            ['', '', ''],
            ['Project Name:', projectName, ''],
            ['Contractor:', 'Notch India Projects Pvt Ltd', ''],
            ['Work Order No:', 'WO-2026-001', ''],
            ['R.A.Bill No:', 1, ''],
            ['Bill Period:', `01-${month}-${year} to 25-${month}-${year}`, ''],
            ['', '', ''],
            ['FINANCIAL SUMMARY', '', '', ''],
            ['Description', 'Upto Date', 'Upto Previous', 'This Bill'],
            ['Basic Amount', currentBasicAmt, 0, currentBasicAmt],
            ['SGST 9%', currentBasicAmt * 0.09, 0, currentBasicAmt * 0.09],
            ['CGST 9%', currentBasicAmt * 0.09, 0, currentBasicAmt * 0.09],
            ['Gross Amount', currentBasicAmt * 1.18, 0, currentBasicAmt * 1.18],
            ['Retention 5%', currentBasicAmt * 0.05, 0, currentBasicAmt * 0.05],
            ['TDS 2%', currentBasicAmt * 0.02, 0, currentBasicAmt * 0.02],
            ['Labour Cess 1%', currentBasicAmt * 0.01, 0, currentBasicAmt * 0.01],
            ['Net Payable', currentBasicAmt * 1.1, 0, currentBasicAmt * 1.1]
        ];
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(abstractData), 'Abstract');

        // BOQ
        const boqHeaders = [
            'Item No', 'Item Code', 'Description', 'Unit', 'Planned Qty', 'Rate', 'Planned Amt', 'Planned Start', 'Planned End',
            'Qty Upto Date', 'Qty Upto Prev', 'Qty This Bill', 'Amt Upto Date', 'Amt Upto Prev', 'Amt This Bill'
        ];
        const boqData = [boqHeaders];
        boqData.push([1, '1001', 'Site Clearance', 'SQM', 1000, 50, 50000, '2026-06-01', '2026-06-15', 500, 0, 500, 25000, 0, 25000]);
        boqData.push([2, '1002', 'Excavation', 'CUM', 500, 300, 150000, '2026-06-10', '2026-06-30', 250, 0, 250, 75000, 0, 75000]);
        boqData.push([3, '1003', 'Foundation Concrete', 'CUM', 200, 5000, 1000000, '2026-06-20', '2026-07-20', 0, 0, 0, 0, 0, 0]);
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(boqData), 'BOQ');

        // Schedule
        const scheduleHeaders = ['Item Code', 'Period Start', 'Period End', 'Planned Qty', 'Planned Amount', 'Notes'];
        const scheduleData = [
            scheduleHeaders,
            ['1001', '2026-06-01', '2026-06-15', 1000, 50000, 'Full clearance'],
            ['1002', '2026-06-10', '2026-06-30', 500, 150000, 'Excavation start'],
            ['1003', '2026-06-20', '2026-07-20', 200, 1000000, 'Foundation phase']
        ];
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(scheduleData), 'Schedule');

        // Measurements
        ['1001', '1002', '1003'].forEach((code, idx) => {
            const measData = [['S.No', 'Date', 'RFI No', 'Description', 'From', 'To', 'Side', 'Nos', 'L', 'B', 'D', 'Quantity', 'IPC', 'Remarks']];
            if (code === '1001') measData.push([1, '2026-06-10', 'RFI-01', 'Clearance', 0, 50, 'LHS', 1, 50, 10, 1, 500, 1, 'OK']);
            if (code === '1002') measData.push([1, '2026-06-15', 'RFI-02', 'Excavation', 0, 50, 'LHS', 1, 50, 5, 1, 250, 1, 'OK']);
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(measData), code);
        });

        const filePath = path.join(__dirname, 'test_data', 'Scratch_RA_01.xlsx');
        XLSX.writeFile(workbook, filePath);
        console.log(`✅ Excel Sheet Created: ${filePath}`);

        console.log(`🚀 Running Import Pipeline...`);
        const importId = uuidv4();
        await runRABillImport({ project_id: projectId, contract_id: contractId, file_path: filePath, import_id: importId, imported_by: 'USR-ADMIN-00001' });
        
        await db.execute(`
            UPDATE ra_bills r 
            SET r.basic_amount_this_bill = (SELECT COALESCE(SUM(amount_this_bill),0) FROM ra_bill_items WHERE ra_bill_id = r.ra_bill_id),
                r.basic_amount_upto_date = (SELECT COALESCE(SUM(amount_upto_date),0) FROM ra_bill_items WHERE ra_bill_id = r.ra_bill_id)
            WHERE r.project_id = ?
        `, [projectId]);

        console.log(`✅ Import complete and amounts synced!`);

        // 5. Query and Validate
        const [finSummary] = await db.execute(`SELECT * FROM v_project_financial_summary WHERE project_id=?`, [projectId]);
        const [boqProgress] = await db.execute(`SELECT item_code, planned_quantity, executed_quantity, status FROM v_boq_progress WHERE project_id=?`, [projectId]);
        
        console.log(`\n📊 FINANCIAL SUMMARY VIEW:`);
        console.log(finSummary[0]);
        
        console.log(`\n📈 BOQ PROGRESS VIEW:`);
        console.table(boqProgress);

        fs.writeFileSync('scratch_test_results.json', JSON.stringify({ finSummary, boqProgress }, null, 2));

    } catch (err) {
        console.error('❌ Error:', err.response ? err.response.data : err.message);
    } finally {
        await db.end();
    }
}

runTest();
