// Genera un blueprint estructurado (JSON + markdown compacto) por cada hoja
// del esqueleto CEA. Escribe un archivo por hoja para facilitar la lectura.

import ExcelJS from 'exceljs';
import path from 'node:path';
import fs from 'node:fs/promises';

const file = process.argv[2] ?? 'archivos excel utiles/CEA 25-26 VACIO.xlsx';
const outDir = process.argv[3] ?? 'scripts/cea-blueprint';

await fs.mkdir(outDir, { recursive: true });

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path.resolve(file));

const rgb = (c) => (c?.argb ?? c?.theme ?? c?.indexed ?? '').toString();
const fillColor = (cell) => {
  const f = cell.fill;
  if (!f || f.type !== 'pattern') return '';
  return rgb(f.fgColor) || rgb(f.bgColor);
};
const fontColor = (cell) => rgb(cell.font?.color);

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

const colLetter = (n) => {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; }
  return s;
};

for (const ws of wb.worksheets) {
  const safeName = ws.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  const lines = [];
  lines.push(`# Hoja "${ws.name}"`);
  lines.push('');
  lines.push(`- dimensiones: ${JSON.stringify(ws.dimensions?.model ?? null)}`);
  lines.push(`- rowCount=${ws.rowCount}  columnCount=${ws.columnCount}  actualRowCount=${ws.actualRowCount}`);
  lines.push('');

  // Anchos de columna
  lines.push('## Anchos de columna (solo los definidos)');
  const widths = [];
  ws.columns?.forEach((c, i) => {
    if (c && c.width) widths.push(`${colLetter(i + 1)}=${(+c.width).toFixed(1)}`);
  });
  lines.push(widths.join('  '));
  lines.push('');

  // Merges
  lines.push(`## Celdas fusionadas (${(ws.model?.merges ?? []).length})`);
  const merges = ws.model?.merges ?? [];
  for (const m of merges) lines.push(`- ${m}`);
  lines.push('');

  // Contenido por fila — recorremos rowCount real e incluimos celdas estilizadas aunque estén vacías
  lines.push('## Contenido (celdas con valor o estilo)');
  const maxR = ws.rowCount ?? 0;
  const maxC = ws.columnCount ?? 0;
  for (let r = 1; r <= maxR; r++) {
    const row = ws.getRow(r);
    const pieces = [];
    for (let c = 1; c <= maxC; c++) {
      const cell = row.getCell(c);
      const t = textOf(cell.value).replace(/\s+/g, ' ').trim();
      const bg = fillColor(cell);
      const bold = cell.font?.bold ? 'B' : '';
      if (!t && !bg && !bold) continue;
      const tag = [bg, bold].filter(Boolean).join(',');
      pieces.push(`${cell.address}${tag ? `{${tag}}` : ''}="${t.slice(0, 120)}"`);
    }
    if (pieces.length) lines.push(`R${String(r).padStart(2, '0')}:  ${pieces.join('  ')}`);
  }

  const outPath = path.join(outDir, `${safeName}.md`);
  await fs.writeFile(outPath, lines.join('\n'), 'utf8');
  console.log(`✔ ${outPath}  (${lines.length} líneas)`);
}
