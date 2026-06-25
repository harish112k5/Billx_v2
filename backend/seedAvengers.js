const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');

const db = require('./db');
const { runRABillImport, runBudgetImport } = require('./services/importPipeline');
const { generateBudgetTemplateV2 } = require('./utils/templateGenerator');

async function seedAvengers() {
    console.log('--- SEEDING AVENGERS PROJECT ---');
    
    // 1. Setup Data
    const org_id = '00000000-0000-0000-0000-000000000001';
    const project_id = uuidv4();
    const contract_id = uuidv4();
    const user_id = uuidv4(); // Mock user
    const import_id = uuidv4();

    const conn = await db.getConnection();
    
    try {
        await conn.beginTransaction();

        // Ensure we have a mock user for imported_by
        await conn.execute(`INSERT IGNORE INTO users (user_id, organization_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)`, 
            [user_id, org_id, 'Tony Stark', 'tony@avengers.com', 'hashed_pass', 'admin']);

        // Insert Project
        await conn.execute(
            `INSERT INTO projects (project_id, project_code, project_name, project_location, status) 
             VALUES (?, ?, ?, ?, ?)`, 
            [project_id, 'AVN-005', 'Avengers Tower Reconstruction', 'New York City', 'active']
        );
        
        // Insert Contract
        await conn.execute(
            `INSERT INTO project_contracts (contract_id, project_id, organization_id, contract_type) 
             VALUES (?, ?, ?, ?)`, 
            [contract_id, project_id, org_id, 'main']
        );

        await conn.commit();
        console.log(`✅ Created Project: Avengers Tower Reconstruction (ID: ${project_id})`);
    } catch (err) {
        await conn.rollback();
        console.error('Failed creating base records:', err);
        process.exit(1);
    } finally {
        conn.release();
    }

    // 2. Budget Import
    console.log('Generating and Importing Budget...');
    const budgetPath = path.join(__dirname, 'test_data', 'Avengers_Budget.xlsx');
    const budgetBuffer = generateBudgetTemplateV2();
    fs.writeFileSync(budgetPath, budgetBuffer);

    try {
        await runBudgetImport({ project_id, file_path: budgetPath });
        console.log('✅ Imported Budget');
    } catch (err) {
        console.error('Failed importing budget:', err);
    }

    // 3. Time / RA Bills Import (Generate 5 months of progress)
    console.log('Generating and Importing RA Bills for Time Analytics...');
    
    // Baseline BOQ Items
    const boqItems = [
        { code: 1001, desc: 'Vibranium Reinforced Concrete', unit: 'CUM', plannedQty: 1000, rate: 25000, start: '2025-01-01', end: '2025-05-31' },
        { code: 1002, desc: 'Arc Reactor Core Shielding', unit: 'SQM', plannedQty: 500, rate: 150000, start: '2025-02-01', end: '2025-04-30' },
        { code: 1003, desc: 'Glass Paneling', unit: 'SQM', plannedQty: 5000, rate: 8000, start: '2025-03-01', end: '2025-05-31' }
    ];

    // Baseline Schedule
    const scheduleDataRows = [
        [1001, '2025-01-01', '2025-01-31', 200, 5000000, 'Foundation'],
        [1001, '2025-02-01', '2025-02-28', 200, 5000000, 'Core'],
        [1001, '2025-03-01', '2025-03-31', 200, 5000000, 'Mid floors'],
        [1001, '2025-04-01', '2025-04-30', 200, 5000000, 'High floors'],
        [1001, '2025-05-01', '2025-05-31', 200, 5000000, 'Roofing'],
        [1002, '2025-02-01', '2025-02-28', 200, 30000000, 'Reactor setup'],
        [1002, '2025-03-01', '2025-03-31', 200, 30000000, 'Reactor main'],
        [1002, '2025-04-01', '2025-04-30', 100, 15000000, 'Reactor closing'],
        [1003, '2025-03-01', '2025-03-31', 1000, 8000000, 'Lower facade'],
        [1003, '2025-04-01', '2025-04-30', 2000, 16000000, 'Mid facade'],
        [1003, '2025-05-01', '2025-05-31', 2000, 16000000, 'Upper facade']
    ];

    let cumulativeProgress = { 1001: 0, 1002: 0, 1003: 0 };

    for (let i = 1; i <= 5; i++) {
        const workbook = XLSX.utils.book_new();
        const prevBasicAmt = Object.values(cumulativeProgress).reduce((sum, qty, idx) => sum + (qty * boqItems[idx].rate), 0);
        
        let workThisMonth = {
            1001: 150, // slightly behind schedule
            1002: i >= 2 && i <= 4 ? 120 : 0, // way behind schedule
            1003: i >= 3 ? 1500 : 0
        };

        const currentBasicAmt = Object.keys(workThisMonth).reduce((sum, key) => sum + (workThisMonth[key] * boqItems.find(b => b.code == key).rate), 0);

        // Abstract Sheet
        const abstractData = [
            ['RA BILL ABSTRACT', '', ''],
            ['', '', ''],
            ['', '', ''],
            ['Project Name:', 'Avengers Tower Reconstruction', ''],
            ['Client:', 'Stark Industries', ''],
            ['Contractor:', 'Damage Control', ''],
            ['Work Order No:', 'WO-AVN-001', ''],
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
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(abstractData), 'Abstract');

        // BOQ Sheet
        const boqHeaders = [
            'Item No', 'Item Code', 'Description', 'Unit', 'Planned Qty', 'Rate', 'Planned Amt',
            'Planned Start', 'Planned End', 'Qty Upto Date', 'Qty Upto Prev', 'Qty This Bill',
            'Amt Upto Date', 'Amt Upto Prev', 'Amt This Bill'
        ];
        const boqData = [boqHeaders];
        boqItems.forEach((item, idx) => {
            const qtyPrev = cumulativeProgress[item.code];
            const qtyThis = workThisMonth[item.code];
            const qtyUpto = qtyPrev + qtyThis;
            boqData.push([
                idx + 1, item.code, item.desc, item.unit, item.plannedQty, item.rate, item.plannedQty * item.rate,
                item.start, item.end, qtyUpto, qtyPrev, qtyThis,
                qtyUpto * item.rate, qtyPrev * item.rate, qtyThis * item.rate
            ]);
            cumulativeProgress[item.code] += qtyThis;
        });
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(boqData), 'BOQ');

        // Schedule Sheet
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Item Code', 'Period Start', 'Period End', 'Planned Qty', 'Planned Amount', 'Notes'], ...scheduleDataRows]), 'Schedule');

        const rabillPath = path.join(__dirname, 'test_data', `Avengers_RABill_${i}.xlsx`);
        XLSX.writeFile(workbook, rabillPath);

        try {
            await runRABillImport({ project_id, contract_id, file_path: rabillPath, import_id: uuidv4(), imported_by: user_id });
            console.log(`✅ Imported RA Bill ${i}`);
        } catch (e) {
            console.error(`Failed importing RA Bill ${i}:`, e);
        }
    }

    // 4. Expenses Import
    console.log('Inserting Direct Expenses...');
    const expenseConn = await db.getConnection();
    try {
        const expenses = [
            ['material', 'Vibranium Delivery', 25000000, '2025-01-15', 'paid'],
            ['labour', 'Iron Legion maintenance', 5000000, '2025-02-10', 'paid'],
            ['equipment', 'Heavy lifters rental', 1500000, '2025-03-05', 'paid'],
            ['transport', 'Quinjet transport', 800000, '2025-04-12', 'pending']
        ];
        
        for (const exp of expenses) {
            await expenseConn.execute(
                `INSERT INTO project_expenses (expense_id, project_id, category, description, amount, expense_date, payment_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [uuidv4(), project_id, exp[0], exp[1], exp[2], exp[3], exp[4]]
            );
        }
        console.log('✅ Inserted Expenses');
    } catch(e) {
        console.error('Failed inserting expenses:', e);
    } finally {
        expenseConn.release();
    }

    console.log('');
    console.log('🎉 AVENGERS PROJECT SEEDED SUCCESSFULLY!');
    console.log(`👉 View it at: http://localhost:5173/projects/${project_id}/dashboard`);
    process.exit(0);
}

seedAvengers();
