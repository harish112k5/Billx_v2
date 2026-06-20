const XLSX = require('xlsx');

const workbook = XLSX.readFile('h:/projects/billx/test_data/Test_RA_Bill_01.xlsx');
console.log('Sheets:', workbook.SheetNames);

if (workbook.SheetNames.includes('Abstract')) {
  const data = XLSX.utils.sheet_to_json(workbook.Sheets['Abstract'], { header: 1, defval: '' });
  console.log('--- Abstract Sheet Top 15 Rows ---');
  console.log(JSON.stringify(data.slice(0, 15), null, 2));
}

if (workbook.SheetNames.includes('BOQ')) {
  const data = XLSX.utils.sheet_to_json(workbook.Sheets['BOQ'], { header: 1, defval: '' });
  console.log('--- BOQ Sheet Top 15 Rows ---');
  console.log(JSON.stringify(data.slice(0, 15), null, 2));
}
