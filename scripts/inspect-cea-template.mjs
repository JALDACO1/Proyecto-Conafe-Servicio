// Inspección estructural del esqueleto CEA 25-26 VACIO.xlsx
// Imprime: hojas, celdas fusionadas, dimensión, y las primeras N filas con estilos.

import ExcelJS from 'exceljs';
import path from 'node:path';

const file = process.argv[2] ?? 'archivos excel utiles/CEA 25-26 VACIO.xlsx';
const maxRowsPerSheet = Number(process.argv[3] ?? 40);

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path.resolve(file));

const rgb = (c) => (c?.argb ?? c?.theme ?? c?.indexed ?? '').toString();
const fillColor = (cell) => {
  const f = cell.fill;
  if (!f || f.type !== 'pattern') return '';
  return rgb(f.fgColor) || rgb(f.bgColor);
};
const fontColor = (cell) => rgb(cell.font?.color);

console.log(`\n📘 Archivo: ${file}`);
console.log(`   Hojas: ${wb.worksheets.length}\n`);

for (const ws of wb.worksheets) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📄 Hoja: "${ws.name}"  (state=${ws.state})`);
  console.log(`   dimensiones=${ws.dimensions?.model ? JSON.stringify(ws.dimensions.model) : 'n/a'}`);
  console.log(`   rowCount=${ws.rowCount}  columnCount=${ws.columnCount}  actualRowCount=${ws.actualRowCount}`);

  // Celdas fusionadas
  const merges = ws.model?.merges ?? [];
  if (merges.length) {
    console.log(`   merges (${merges.length}):`, merges.slice(0, 20).join(', ') + (merges.length > 20 ? ' …' : ''));
  }

  // Anchos de columna
  const widths = [];
  ws.columns?.forEach((c, i) => {
    if (c && c.width) widths.push(`${String.fromCharCode(65 + i)}=${c.width.toFixed(1)}`);
  });
  if (widths.length) console.log(`   widths: ${widths.slice(0, 20).join(' ')}${widths.length > 20 ? ' …' : ''}`);

  // Filas con estilos básicos
  const maxR = Math.min(ws.actualRowCount || 0, maxRowsPerSheet);
  for (let r = 1; r <= maxR; r++) {
    const row = ws.getRow(r);
    const cells = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      let text;
      if (v === null || v === undefined) text = '';
      else if (typeof v === 'object' && v.richText) text = v.richText.map((rt) => rt.text).join('');
      else if (typeof v === 'object' && v.formula) text = `=${v.formula}→${v.result ?? ''}`;
      else if (typeof v === 'object' && v.sharedFormula) text = `=${v.sharedFormula}→${v.result ?? ''}`;
      else if (typeof v === 'object' && v.hyperlink) text = v.text ?? v.hyperlink;
      else if (typeof v === 'object' && v.text) text = v.text;
      else if (typeof v === 'object') text = JSON.stringify(v);
      else text = String(v);
      const bg = fillColor(cell);
      const fg = fontColor(cell);
      const bold = cell.font?.bold ? '𝐁' : '';
      const style = [bg && `bg=${bg}`, fg && `fg=${fg}`, bold].filter(Boolean).join(' ');
      cells.push(`${cell.address}:${style ? `[${style}]` : ''}"${text.toString().slice(0, 80)}"`);
    });
    if (cells.length) console.log(`   R${String(r).padStart(2, '0')}: ${cells.join(' | ')}`);
  }
  console.log();
}
