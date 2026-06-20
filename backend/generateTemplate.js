const ExcelJS = require('exceljs');
const path = require('path');

async function createTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Budget');

  // Header information
  sheet.getCell('A1').value = 'Project Budget Template';
  sheet.getCell('A1').font = { size: 16, bold: true };

  sheet.getCell('A3').value = 'Project Name';
  sheet.getCell('B3').value = 'Demo Project';
  
  sheet.getCell('A4').value = 'Department';
  sheet.getCell('B4').value = 'Construction';
  
  sheet.getCell('A5').value = 'Supervisor';
  sheet.getCell('B5').value = 'John Doe';

  // Table Headers
  const headers = [
    'WBS Code', // 0
    'Project Tasks', // 1
    'Assigned To', // 2
    'Planned Hours', // 3
    'Actual Hours', // 4
    'Labor Rate', // 5
    'Planned Material Units', // 6
    'Material Rate', // 7
    'Travel Cost', // 8
    'Equipment Cost', // 9
    'Fixed Cost', // 10
    'Misc Cost' // 11
  ];

  const headerRow = sheet.getRow(7);
  headerRow.values = headers;
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' }
  };

  // Sample data row 1
  sheet.addRow([
    'WBS-001',
    'Site Preparation',
    'Alice Smith',
    100, // Planned Hours
    0,   // Actual Hours
    500, // Labor Rate
    0,   // Planned Material Units
    0,   // Material Rate
    5000, // Travel Cost
    25000, // Equipment Cost
    10000, // Fixed Cost
    2000 // Misc Cost
  ]);

  // Sample data row 2
  sheet.addRow([
    'WBS-002',
    'Concrete Foundation',
    'Bob Johnson',
    200,
    0,
    600,
    1000,
    150,
    0,
    50000,
    0,
    1000
  ]);

  // Make columns wider
  sheet.columns.forEach((column) => {
    column.width = 20;
  });

  const outputPath = path.join(__dirname, '../frontend/public/budget_template.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log('Template created at:', outputPath);
}

createTemplate().catch(console.error);
