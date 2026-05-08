// Extrae SOLO celdas con texto/fórmula (ignora estilos) para entender la semántica.
import ExcelJS from 'exceljs';
import path from 'node:path';
import fs from 'node:fs/promises';

const file = process.argv[2] ?? 'archivos excel utiles/CEA 25-26 VACIO.xlsx';
const outDir = process.argv[3] ?? 'scripts/cea-blueprint';
await fs.mkdir(outDir, { recursive: true });

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path.resolve(file));

const textOf = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map((rt) => rt.text).join('');
  if (typeof v === 'object' && v.formula) return `=${v.formula}`;
  if (typeof v === 'object' && v.sharedFormula) return `=${v.sharedFormula}`;
  if (typeof v === 'object' && v.hyperlink) return v.text ?? v.hyperlink;
  if (typeof v === 'object' && v.text) return v.text;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

for (const ws of wb.worksheets) {
  const safeName = ws.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  const lines = [];
  lines.push(`# "${ws.name}" — solo celdas con TEXTO`);
  lines.push(`rowCount=${ws.rowCount} columnCount=${ws.columnCount} actualRowCount=${ws.actualRowCount}`);
  lines.push(`merges=${(ws.model?.merges ?? []).length}`);
  lines.push('');

  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const pieces = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      const t = textOf(cell.value).replace(/\s+/g, ' ').trim();
      if (!t) return;
      pieces.push(`${cell.address}="${t.slice(0, 150)}"`);
    });
    if (pieces.length) lines.push(`R${String(r).padStart(2, '0')}: ${pieces.join(' | ')}`);
  }

  const outPath = path.join(outDir, `${safeName}_semantic.md`);
  await fs.writeFile(outPath, lines.join('\n'), 'utf8');
  console.log(`✔ ${outPath}`);
}
