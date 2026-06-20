const ExcelJS = require('exceljs');
const path = require('path');

async function createRABillTemplate() {
  const workbook = new ExcelJS.Workbook();

  // 1. Abstract Sheet
  const abstSheet = workbook.addWorksheet('Abstract');
  abstSheet.getCell('A1').value = 'Project Name';
  abstSheet.getCell('B1').value = 'Demo Project';
  abstSheet.getCell('A2').value = 'Client';
  abstSheet.getCell('B2').value = 'Acme Corp';
  abstSheet.getCell('A3').value = 'Contractor';
  abstSheet.getCell('B3').value = 'BuildIt Co';
  abstSheet.getCell('A4').value = 'Work Order';
  abstSheet.getCell('B4').value = 'WO-2026-001';
  abstSheet.getCell('A5').value = 'R.A.Bill No';
  abstSheet.getCell('B5').value = '1';
  abstSheet.getCell('A6').value = 'Bill Period';
  abstSheet.getCell('B6').value = '01-06-2026 to 30-06-2026';

  abstSheet.getCell('A8').value = 'Basic Amount';
  abstSheet.getCell('B8').value = 0; // up to date
  abstSheet.getCell('C8').value = 0; // prev
  abstSheet.getCell('D8').value = 50000; // this bill

  abstSheet.getCell('A9').value = 'SGST 9%';
  abstSheet.getCell('D9').value = 4500;
  
  abstSheet.getCell('A10').value = 'CGST 9%';
  abstSheet.getCell('D10').value = 4500;

  abstSheet.getCell('A11').value = 'Gross Amount';
  abstSheet.getCell('D11').value = 59000;

  abstSheet.getCell('A12').value = 'Retention 5%';
  abstSheet.getCell('D12').value = 2500;

  abstSheet.getCell('A13').value = 'TDS 2%';
  abstSheet.getCell('D13').value = 1000;

  abstSheet.getCell('A14').value = 'Labour Cess 1%';
  abstSheet.getCell('D14').value = 500;

  abstSheet.getCell('A15').value = 'Net Payable';
  abstSheet.getCell('D15').value = 55000;

  // 2. BOQ Sheet
  const boqSheet = workbook.addWorksheet('BOQ');
  
  // Headers at row 8
  const boqHeaders = [
    'Item No', 'Item Code', 'Description', 'Unit', 'Plan Qty', 'Rate', 'Plan Amt',
    'Qty Upto Date', 'Qty Upto Prev', 'Qty This Bill',
    'Amt Upto Date', 'Amt Upto Prev', 'Amt This Bill'
  ];
  boqSheet.getRow(8).values = boqHeaders;
  boqSheet.getRow(8).font = { bold: true };

  // Data starts at row 10
  boqSheet.getRow(10).values = [1, 1001, 'Earthwork Excavation', 'CUM', 1000, 150, 150000, 100, 0, 100, 15000, 0, 15000];
  boqSheet.getRow(11).values = [2, 1002, 'PCC Work', 'CUM', 500, 4500, 2250000, 0, 0, 0, 0, 0, 0];
  boqSheet.getRow(12).values = [3, 1003, 'RCC Work', 'CUM', 1200, 6500, 7800000, 0, 0, 0, 0, 0, 0];
  
  boqSheet.columns.forEach(col => col.width = 15);
  boqSheet.getColumn(3).width = 30; // description

  // 3. Measurement Sheet
  const m10 = workbook.addWorksheet('10');
  m10.getRow(1).values = ['Item Code', 1001];
  m10.getRow(2).values = ['Description', 'Earthwork Excavation'];
  m10.getRow(4).values = ['L', 'B', 'D', 'Qty'];
  m10.getRow(5).values = [10, 5, 2, 100]; // 10*5*2 = 100

  const outputPath = path.join(__dirname, '../frontend/public/rabill_template.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log('RA Bill Template created at:', outputPath);
}

createRABillTemplate().catch(console.error);
