const XLSX = require('xlsx');
const path = require('path');

function generateTemplate() {
  const wb = XLSX.utils.book_new();

  // 1. Abstract Sheet
  const abstractData = [
    ['Project Name:', 'Enter Project Name Here'],
    ['Client:', 'Enter Client Name'],
    ['Contractor:', 'Enter Main Contractor Name'],
    ['Work Order No:', 'WO-12345'],
    ['R.A.Bill No:', 'RA-01'],
    ['Bill Period:', '01-01-2025 to 31-01-2025'],
    [],
    ['Financial Summary'],
    ['Basic Amount Upto Date', 'Basic Amount Upto Prev', 'Basic Amount This Bill'],
    ['0', '0', '0'],
    ['SGST 9%', '', '0'],
    ['CGST 9%', '', '0'],
    ['Gross Amount', '', '0'],
    ['Retention 5%', '', '0'],
    ['TDS 2%', '', '0'],
    ['Labour Cess 1%', '', '0'],
    ['Net Payable', '', '0']
  ];
  const wsAbstract = XLSX.utils.aoa_to_sheet(abstractData);
  XLSX.utils.book_append_sheet(wb, wsAbstract, 'Abstract');

  // 2. BOQ Sheet
  const boqData = [];
  // Add some padding rows to ensure headers are at row 8-9 (index 7-8)
  for (let i = 0; i < 7; i++) boqData.push([]);
  
  // Row 8 and 9 (Headers)
  boqData.push(['Item No', 'Item Code', 'Description', 'Unit', 'Planned Qty', 'Rate', 'Planned Amt', 'Qty Upto Date', 'Qty Upto Prev', 'Qty This Bill', 'Amt Upto Date', 'Amt Upto Prev', 'Amt This Bill']);
  boqData.push([]); // Row 9
  
  // Row 10 (Data start)
  boqData.push([1, '1001', 'Sample BOQ Item 1', 'CUM', 100, 500, 50000, 0, 0, 0, 0, 0, 0]);
  boqData.push([2, '1002', 'Sample BOQ Item 2', 'SQM', 50, 1000, 50000, 0, 0, 0, 0, 0, 0]);
  
  const wsBOQ = XLSX.utils.aoa_to_sheet(boqData);
  XLSX.utils.book_append_sheet(wb, wsBOQ, 'BOQ');

  // 3. Measurement Sheets (10, 20)
  const measHeaders = ['S.No', 'Date', 'RFI No', 'Description', 'From', 'To', 'Side', 'Nos', 'L', 'B', 'D', 'Quantity', 'IPC', 'Remarks'];
  
  // Sheet 10
  const meas10Data = [];
  for (let i = 0; i < 6; i++) meas10Data.push([]); // padding
  meas10Data.push(['Item 1001: Sample BOQ Item 1']); // Row 7
  meas10Data.push(measHeaders); // Row 8
  meas10Data.push([1, '2025-01-15', 'RFI-001', 'Sample Measurement', 0, 10, 'LHS', 1, 10, 2, 0.5, 10, 1, 'OK']); // Row 9
  const wsMeas10 = XLSX.utils.aoa_to_sheet(meas10Data);
  XLSX.utils.book_append_sheet(wb, wsMeas10, '10');

  // Sheet 20
  const meas20Data = [];
  for (let i = 0; i < 6; i++) meas20Data.push([]);
  meas20Data.push(['Item 1002: Sample BOQ Item 2']);
  meas20Data.push(measHeaders);
  meas20Data.push([1, '2025-01-16', 'RFI-002', 'Sample Measurement 2', 10, 20, 'RHS', 1, 10, 5, 0.2, 10, 1, 'OK']);
  const wsMeas20 = XLSX.utils.aoa_to_sheet(meas20Data);
  XLSX.utils.book_append_sheet(wb, wsMeas20, '20');

  // 4. Non BOQ Sheet
  const nonBoqData = [];
  for (let i = 0; i < 7; i++) nonBoqData.push([]);
  nonBoqData.push(['S.No', 'Description', 'Unit', 'Nos', 'L', 'B', 'D', 'Quantity', 'Unit Rate', 'Amount']); // Row 8
  nonBoqData.push([1, 'Extra Earthwork', 'CUM', 1, 5, 5, 1, 25, 300, 7500]); // Row 9
  const wsNonBOQ = XLSX.utils.aoa_to_sheet(nonBoqData);
  XLSX.utils.book_append_sheet(wb, wsNonBOQ, 'Non BOQ');

  const outPath = path.join(__dirname, 'Standard_RA_Bill_Template.xlsx');
  XLSX.writeFile(wb, outPath);
  console.log('Template created successfully at', outPath);
}

generateTemplate();
