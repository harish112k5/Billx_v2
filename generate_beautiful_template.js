const ExcelJS = require('exceljs');
const path = require('path');

async function createTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BillX V2 System';
  wb.created = new Date();

  // ─────────────────────────────────────────────────────────────
  // Colors & Styles
  // ─────────────────────────────────────────────────────────────
  const primaryColor = '1E1E2E';
  const accentColor = 'F59E0B'; // Amber
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } };
  const headerFont = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
  const borderAll = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
  };
  const titleFont = { size: 16, bold: true, color: { argb: accentColor } };
  const labelFont = { bold: true, color: { argb: 'FF4B5563' } };

  // ─────────────────────────────────────────────────────────────
  // 1. Abstract Sheet
  // ─────────────────────────────────────────────────────────────
  const wsAbstract = wb.addWorksheet('Abstract', { views: [{ showGridLines: false }] });
  
  // Title
  wsAbstract.mergeCells('A1:C2');
  wsAbstract.getCell('A1').value = 'RA BILL ABSTRACT';
  wsAbstract.getCell('A1').font = titleFont;
  wsAbstract.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  wsAbstract.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

  // Details Section
  const details = [
    ['Project Name:', 'Construction of Loop Road', ''],
    ['Client:', 'TK Toll Road Pvt Ltd', ''],
    ['Contractor:', 'NIP Infra', ''],
    ['Work Order No:', 'WO-2025-001', ''],
    ['R.A.Bill No:', 'RA-01', ''],
    ['Bill Period:', '01-01-2025 to 31-01-2025', '']
  ];
  
  details.forEach((row, i) => {
    const rowObj = wsAbstract.getRow(4 + i);
    rowObj.values = row;
    rowObj.getCell(1).font = labelFont;
    rowObj.getCell(2).font = { bold: true, color: { argb: 'FF111827' } };
    rowObj.getCell(1).border = borderAll;
    rowObj.getCell(2).border = borderAll;
    rowObj.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    wsAbstract.mergeCells(`B${4+i}:C${4+i}`);
  });

  // Financial Summary Title
  wsAbstract.mergeCells('A12:C12');
  wsAbstract.getCell('A12').value = 'FINANCIAL SUMMARY';
  wsAbstract.getCell('A12').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  wsAbstract.getCell('A12').fill = headerFill;
  wsAbstract.getCell('A12').alignment = { horizontal: 'center' };

  // Financial Headers
  wsAbstract.getRow(13).values = ['Description', 'Upto Previous', 'This Bill'];
  ['A13', 'B13', 'C13'].forEach(cell => {
    wsAbstract.getCell(cell).font = { bold: true };
    wsAbstract.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    wsAbstract.getCell(cell).border = borderAll;
    wsAbstract.getCell(cell).alignment = { horizontal: 'center' };
  });

  // Financial Rows
  const finRows = [
    ['Basic Amount', 0, 500000],
    ['SGST 9%', 0, 45000],
    ['CGST 9%', 0, 45000],
    ['Gross Amount', 0, 590000],
    ['Retention 5%', 0, 25000],
    ['TDS 2%', 0, 10000],
    ['Labour Cess 1%', 0, 5000],
    ['Net Payable', 0, 550000]
  ];

  finRows.forEach((row, i) => {
    const r = wsAbstract.getRow(14 + i);
    r.values = row;
    r.getCell(1).font = labelFont;
    r.getCell(2).numFmt = '#,##0.00';
    r.getCell(3).numFmt = '#,##0.00';
    ['A', 'B', 'C'].forEach(c => {
      r.getCell(c).border = borderAll;
    });
  });

  // Highlight Net Payable
  const netRow = wsAbstract.getRow(14 + finRows.length - 1);
  ['A', 'B', 'C'].forEach(c => {
    netRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Light green
    netRow.getCell(c).font = { bold: true, color: { argb: 'FF065F46' } };
  });

  wsAbstract.columns = [
    { width: 25 }, { width: 25 }, { width: 25 }
  ];

  // ─────────────────────────────────────────────────────────────
  // 2. BOQ Sheet
  // ─────────────────────────────────────────────────────────────
  const wsBOQ = wb.addWorksheet('BOQ', { views: [{ showGridLines: false }] });
  
  // Title
  wsBOQ.mergeCells('A2:M3');
  wsBOQ.getCell('A2').value = 'BILL OF QUANTITIES (BOQ)';
  wsBOQ.getCell('A2').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  wsBOQ.getCell('A2').fill = headerFill;
  wsBOQ.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };

  // Info Note
  wsBOQ.mergeCells('A5:M5');
  wsBOQ.getCell('A5').value = '⚠ IMPORTANT: Do not change the headers on row 8 & 9. Data must start at row 10. Item Code must be numbers.';
  wsBOQ.getCell('A5').font = { italic: true, color: { argb: 'FFDC2626' } };

  // Headers (Row 8 & 9 per specification)
  const boqHeaders = ['Item No', 'Item Code', 'Description', 'Unit', 'Planned Qty', 'Rate', 'Planned Amt', 'Qty Upto Date', 'Qty Upto Prev', 'Qty This Bill', 'Amt Upto Date', 'Amt Upto Prev', 'Amt This Bill'];
  
  const headerRow8 = wsBOQ.getRow(8);
  headerRow8.values = boqHeaders;
  
  boqHeaders.forEach((h, i) => {
    const cell8 = wsBOQ.getCell(8, i + 1);
    const cell9 = wsBOQ.getCell(9, i + 1);
    wsBOQ.mergeCells(8, i + 1, 9, i + 1);
    cell8.font = headerFont;
    cell8.fill = headerFill;
    cell8.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell8.border = borderAll;
    cell9.border = borderAll;
  });

  // BOQ Data
  const boqSampleData = [
    [1, '1001', 'Earthwork Excavation', 'CUM', 1000, 250, 250000, 500, 200, 300, 125000, 50000, 75000],
    [2, '1002', 'PCC 1:4:8', 'CUM', 500, 4500, 2250000, 100, 0, 100, 450000, 0, 450000],
    [3, '1003', 'RCC M25', 'CUM', 200, 8000, 1600000, 50, 10, 40, 400000, 80000, 320000]
  ];

  boqSampleData.forEach((row, i) => {
    const r = wsBOQ.getRow(10 + i);
    r.values = row;
    for(let c=1; c<=13; c++) {
      const cell = r.getCell(c);
      cell.border = borderAll;
      if (c >= 5) cell.numFmt = '#,##0.00'; // number format
    }
  });

  wsBOQ.columns = [
    { width: 10 }, { width: 15 }, { width: 40 }, { width: 10 },
    { width: 15 }, { width: 15 }, { width: 20 },
    { width: 15 }, { width: 15 }, { width: 15 },
    { width: 20 }, { width: 20 }, { width: 20 }
  ];

  // ─────────────────────────────────────────────────────────────
  // 3. Measurement Sheet (1001)
  // ─────────────────────────────────────────────────────────────
  const wsMeas = wb.addWorksheet('1001', { views: [{ showGridLines: false }] });
  
  wsMeas.mergeCells('A2:N3');
  wsMeas.getCell('A2').value = 'MEASUREMENT SHEET';
  wsMeas.getCell('A2').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  wsMeas.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }; // Green
  wsMeas.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };

  wsMeas.mergeCells('A6:N6');
  wsMeas.getCell('A6').value = '⚠ Note: Sheet name must exactly match the Item Code from the BOQ sheet (e.g., "1001")';
  wsMeas.getCell('A6').font = { italic: true, color: { argb: 'FFDC2626' } };

  // Row 7 (Item Info)
  wsMeas.mergeCells('A7:N7');
  wsMeas.getCell('A7').value = 'Item 1001: Earthwork Excavation';
  wsMeas.getCell('A7').font = { bold: true, size: 12 };
  wsMeas.getCell('A7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  wsMeas.getCell('A7').border = borderAll;

  // Row 8 (Headers)
  const measHeaders = ['S.No', 'Date', 'RFI No', 'Description', 'From', 'To', 'Side', 'Nos', 'L', 'B', 'D', 'Quantity', 'IPC', 'Remarks'];
  const mRow8 = wsMeas.getRow(8);
  mRow8.values = measHeaders;
  measHeaders.forEach((h, i) => {
    const cell = mRow8.getCell(i + 1);
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
    cell.border = borderAll;
  });

  // Data (Row 9+)
  const measData = [
    [1, new Date('2025-01-15'), 'RFI-001', 'Excavation LHS', 0, 100, 'LHS', 1, 100, 5, 1, 500, 1, 'Approved'],
    [2, new Date('2025-01-16'), 'RFI-002', 'Excavation RHS', 0, 100, 'RHS', 1, 100, 5, 1, 500, 1, 'Approved']
  ];

  measData.forEach((row, i) => {
    const r = wsMeas.getRow(9 + i);
    r.values = row;
    for(let c=1; c<=14; c++) {
      const cell = r.getCell(c);
      cell.border = borderAll;
      if (c === 2) cell.numFmt = 'dd-mm-yyyy';
      if (c >= 5 && c <= 12) cell.numFmt = '#,##0.00';
    }
  });

  wsMeas.columns = [
    { width: 8 }, { width: 15 }, { width: 15 }, { width: 30 },
    { width: 10 }, { width: 10 }, { width: 10 }, { width: 8 },
    { width: 10 }, { width: 10 }, { width: 10 }, { width: 15 },
    { width: 10 }, { width: 20 }
  ];

  // ─────────────────────────────────────────────────────────────
  // 4. Non BOQ Sheet
  // ─────────────────────────────────────────────────────────────
  const wsNonBoq = wb.addWorksheet('Non BOQ', { views: [{ showGridLines: false }] });
  
  wsNonBoq.mergeCells('A2:J3');
  wsNonBoq.getCell('A2').value = 'NON BOQ / EXTRA ITEMS';
  wsNonBoq.getCell('A2').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  wsNonBoq.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } }; // Red
  wsNonBoq.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };

  wsNonBoq.mergeCells('A6:J6');
  wsNonBoq.getCell('A6').value = '⚠ Note: Add any items here that are outside the original scope of the BOQ.';
  wsNonBoq.getCell('A6').font = { italic: true, color: { argb: 'FFDC2626' } };

  // Headers (Row 8)
  const nonBoqHeaders = ['S.No', 'Description', 'Unit', 'Nos', 'L', 'B', 'D', 'Quantity', 'Unit Rate', 'Amount'];
  const nRow8 = wsNonBoq.getRow(8);
  nRow8.values = nonBoqHeaders;
  nonBoqHeaders.forEach((h, i) => {
    const cell = nRow8.getCell(i + 1);
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center' };
    cell.border = borderAll;
  });

  // Data (Row 9)
  const nRow9 = wsNonBoq.getRow(9);
  nRow9.values = [1, 'Extra Soil Shifting', 'CUM', 1, 50, 10, 2, 1000, 150, 150000];
  for(let c=1; c<=10; c++) {
    const cell = nRow9.getCell(c);
    cell.border = borderAll;
    if (c >= 4) cell.numFmt = '#,##0.00';
  }

  wsNonBoq.columns = [
    { width: 8 }, { width: 40 }, { width: 10 }, { width: 8 },
    { width: 10 }, { width: 10 }, { width: 10 }, { width: 15 },
    { width: 15 }, { width: 20 }
  ];

  // Save
  const outPath = path.join(__dirname, 'Beautiful_RA_Bill_Template.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log('Template created at', outPath);
}

createTemplate().catch(console.error);
