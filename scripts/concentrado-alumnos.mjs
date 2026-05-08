// Extrae SOLO la sección de Alumnos (filas 67+) de la hoja CONCENTRADO,
// una celda por línea para que sea fácil de leer.
import ExcelJS from 'exceljs';
import path from 'node:path';

const file = 'archivos excel utiles/CEA 25-26 VACIO.xlsx';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path.resolve(file));
const ws = wb.getWorksheet('CONCENTRADO');

const textOf = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map((rt) => rt.text).join('');
  if (typeof v === 'object' && v.formula) return `=${v.formula}`;
  if (typeof v === 'object' && v.sharedFormula) return `=${v.sharedFormula}`;
  if (typeof v === 'object' && v.text) return v.text;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

console.log(`CONCENTRADO — filas 67-${ws.rowCount}, una celda por línea`);
console.log(`merges totales: ${(ws.model?.merges ?? []).length}`);
for (let r = 67; r <= ws.rowCount; r++) {
  const row = ws.getRow(r);
  let found = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    const t = textOf(cell.value).replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (!found) { console.log(`\n--- R${r} ---`); found = true; }
    console.log(`  ${cell.address} = "${t.slice(0, 200)}"`);
  });
}
