/**
 * Excel Writer con ExcelJS
 * =========================
 * Genera el archivo CEA con formato profesional.
 *
 * Estructura del CONCENTRADO (basada en el CEA ejemplo real):
 * - Fila 1: Título "Total X Figura"
 * - Fila 2: Headers principales (Microrregión, ECA, Coord., categorías agrupadas...)
 * - Fila 3: Sub-headers de género (M, F)
 * - Fila 4+: Datos
 */

import ExcelJS from 'exceljs';
import type { CeaRow } from '../../_shared/types.ts';

// ============================================================================
// Opciones
// ============================================================================

export interface ExcelWriterOptions {
  sheetName?: string;
  applyFormatting?: boolean;
  autoFitColumns?: boolean;
}

// ============================================================================
// Estilos
// ============================================================================

const COLORS = {
  headerBg: 'FF4472C4',
  headerText: 'FFFFFFFF',
  subHeaderBg: 'FFD9E2F3',
  subHeaderText: 'FF000000',
  titleBg: 'FF2F5496',
  titleText: 'FFFFFFFF',
  totalBg: 'FFFFD966',
  totalText: 'FF000000',
  negativeBg: 'FFFF6B6B',
  negativeText: 'FFFFFFFF',
  dataBorder: 'FFB4C6E7',
};

const BORDER_THIN = {
  top: { style: 'thin' as const, color: { argb: 'FF000000' } },
  bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
  left: { style: 'thin' as const, color: { argb: 'FF000000' } },
  right: { style: 'thin' as const, color: { argb: 'FF000000' } },
};

const BORDER_MEDIUM = {
  top: { style: 'medium' as const, color: { argb: 'FF000000' } },
  bottom: { style: 'medium' as const, color: { argb: 'FF000000' } },
  left: { style: 'medium' as const, color: { argb: 'FF000000' } },
  right: { style: 'medium' as const, color: { argb: 'FF000000' } },
};

// ============================================================================
// Estructura de columnas del CONCENTRADO
// ============================================================================

/**
 * Definición de las columnas del CONCENTRADO.
 * Las columnas de modalidad van en pares M/F y se agrupan bajo un header principal.
 */
const FIXED_COLUMNS = [
  { key: 'Microregion', header: 'Microrregión', width: 22 },
  { key: 'ECA', header: 'Educador Comunitario\nde Acompañamiento', width: 30 },
  { key: 'CoordinadorSeguimiento', header: 'Coordinador\nde Seguimiento', width: 28 },
];

const MODALIDAD_COLUMNS = [
  { name: 'Inicial', keyM: 'Inicial_M', keyF: 'Inicial_F' },
  { name: 'Preescolar', keyM: 'Preescolar_M', keyF: 'Preescolar_F' },
  { name: 'CIC', keyM: 'CIC_M', keyF: 'CIC_F' },
  { name: 'PreeMig', keyM: 'PreeMig_M', keyF: 'PreeMig_F' },
  { name: 'Prim', keyM: 'Prim_M', keyF: 'Prim_F' },
  { name: 'Sec', keyM: 'Sec_M', keyF: 'Sec_F' },
];

const TOTAL_COLUMNS = [
  { name: 'Total x Gén', keyM: 'Total_M', keyF: 'Total_F' },
];

const SUMMARY_COLUMNS = [
  { key: 'Total_Gen', header: 'Total Gen', width: 10 },
  { key: 'Metas', header: 'Metas', width: 10 },
  { key: 'Faltantes', header: 'Faltantes', width: 10 },
];

// ============================================================================
// FUNCIÓN PRINCIPAL: generateCeaExcel
// ============================================================================

export async function generateCeaExcel(
  data: CeaRow[],
  options: ExcelWriterOptions = {}
): Promise<Buffer> {
  console.log('📝 Generando archivo Excel CEA...');

  const {
    sheetName = 'CONCENTRADO',
    applyFormatting = true,
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema CEA CONAFE';
  workbook.created = new Date();

  const ws = workbook.addWorksheet(sheetName, {
    properties: { defaultRowHeight: 18 },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // ---- Calcular estructura de columnas ----
  // Col 1: Microrregión, Col 2: ECA, Col 3: Coord
  // Cols 4-5: Inicial M/F, Cols 6-7: Preescolar M/F, ...
  // Cols N-N+1: Total x Gén M/F, Col N+2: Total Gen, Col N+3: Metas, Col N+4: Faltantes

  const totalFixedCols = FIXED_COLUMNS.length; // 3
  const totalModalidadCols = MODALIDAD_COLUMNS.length * 2; // 12
  const totalTotalCols = TOTAL_COLUMNS.length * 2; // 2
  const totalSummaryCols = SUMMARY_COLUMNS.length; // 3
  const totalCols = totalFixedCols + totalModalidadCols + totalTotalCols + totalSummaryCols; // 20

  // ---- Fila 1: Título ----
  const titleRow = ws.getRow(1);
  titleRow.getCell(1).value = 'Total X Figura';
  if (applyFormatting) {
    titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.titleText } };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } };
    titleRow.height = 28;
    // Merge título
    ws.mergeCells(1, 1, 1, totalCols);
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // ---- Fila 2: Headers principales ----
  const headerRow = ws.getRow(2);
  headerRow.height = 36;

  // Columnas fijas (Microrregión, ECA, Coord) - se mergean filas 2-3
  let colIdx = 1;
  for (const fc of FIXED_COLUMNS) {
    ws.mergeCells(2, colIdx, 3, colIdx);
    const cell = headerRow.getCell(colIdx);
    cell.value = fc.header;
    ws.getColumn(colIdx).width = fc.width;
    colIdx++;
  }

  // Columnas de modalidad (M/F pares) - header abarca 2 columnas
  for (const mc of MODALIDAD_COLUMNS) {
    ws.mergeCells(2, colIdx, 2, colIdx + 1);
    headerRow.getCell(colIdx).value = mc.name;
    ws.getColumn(colIdx).width = 6;
    ws.getColumn(colIdx + 1).width = 6;
    colIdx += 2;
  }

  // Columna Total x Gén (M/F)
  for (const tc of TOTAL_COLUMNS) {
    ws.mergeCells(2, colIdx, 2, colIdx + 1);
    headerRow.getCell(colIdx).value = tc.name;
    ws.getColumn(colIdx).width = 7;
    ws.getColumn(colIdx + 1).width = 7;
    colIdx += 2;
  }

  // Columnas de resumen (Total Gen, Metas, Faltantes) - se mergean filas 2-3
  for (const sc of SUMMARY_COLUMNS) {
    ws.mergeCells(2, colIdx, 3, colIdx);
    headerRow.getCell(colIdx).value = sc.header;
    ws.getColumn(colIdx).width = sc.width;
    colIdx++;
  }

  // ---- Fila 3: Sub-headers de género (M, F) ----
  const subHeaderRow = ws.getRow(3);
  subHeaderRow.height = 20;

  colIdx = totalFixedCols + 1; // Empezar después de las columnas fijas
  const allPairedGroups = [...MODALIDAD_COLUMNS, ...TOTAL_COLUMNS];
  for (let i = 0; i < allPairedGroups.length; i++) {
    subHeaderRow.getCell(colIdx).value = 'M';
    subHeaderRow.getCell(colIdx + 1).value = 'F';
    colIdx += 2;
  }

  // ---- Aplicar formato a headers ----
  if (applyFormatting) {
    for (let row = 2; row <= 3; row++) {
      const r = ws.getRow(row);
      for (let c = 1; c <= totalCols; c++) {
        const cell = r.getCell(c);
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.headerText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = BORDER_MEDIUM;
      }
    }
  }

  // ---- Fila 4+: Datos ----
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const excelRow = ws.getRow(4 + i);
    let c = 1;

    // Columnas fijas
    excelRow.getCell(c++).value = row.Microregion;
    excelRow.getCell(c++).value = row.ECA;
    excelRow.getCell(c++).value = row.CoordinadorSeguimiento;

    // Modalidades M/F
    for (const mc of MODALIDAD_COLUMNS) {
      const valM = (row as any)[mc.keyM] || 0;
      const valF = (row as any)[mc.keyF] || 0;
      excelRow.getCell(c++).value = valM || '';
      excelRow.getCell(c++).value = valF || '';
    }

    // Total x Gén M/F
    excelRow.getCell(c++).value = row.Total_M;
    excelRow.getCell(c++).value = row.Total_F;

    // Resumen
    excelRow.getCell(c++).value = row.Total_Gen;
    excelRow.getCell(c++).value = row.Metas;
    excelRow.getCell(c++).value = row.Faltantes;

    // Formato de datos
    if (applyFormatting) {
      for (let col = 1; col <= totalCols; col++) {
        const cell = excelRow.getCell(col);
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = BORDER_THIN;

        if (col <= 3) {
          // Texto: alinear izquierda
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else {
          // Números: centrar
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      }

      // Resaltar columnas de totales
      const totalMCol = totalFixedCols + totalModalidadCols + 1;
      const totalFCol = totalMCol + 1;
      const totalGenCol = totalFCol + 1;
      const metasCol = totalGenCol + 1;
      const faltantesCol = metasCol + 1;

      for (const tc of [totalMCol, totalFCol, totalGenCol, metasCol]) {
        excelRow.getCell(tc).font = { name: 'Calibri', size: 10, bold: true };
        excelRow.getCell(tc).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } };
      }

      // Faltantes negativos en rojo
      const faltantesVal = excelRow.getCell(faltantesCol).value;
      if (typeof faltantesVal === 'number' && faltantesVal < 0) {
        excelRow.getCell(faltantesCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.negativeBg } };
        excelRow.getCell(faltantesCol).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.negativeText } };
      }
    }
  }

  // ---- Congelar headers ----
  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 3, activeCell: 'D4' }];

  // ---- Filtros automáticos en la fila de sub-headers ----
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: totalCols } };

  // ---- Generar buffer ----
  console.log('💾 Convirtiendo workbook a buffer...');
  const buffer = await workbook.xlsx.writeBuffer();
  console.log(`✅ Excel generado: ${data.length} filas, ${totalCols} columnas`);

  return buffer as Buffer;
}

// ============================================================================
// FUNCIÓN: formatCeaFileName
// ============================================================================

export function formatCeaFileName(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `CEA_${day}_${month}_${year}.xlsx`;
}

// ============================================================================
// FUNCIÓN: validateCeaData
// ============================================================================

export function validateCeaData(data: CeaRow[]): boolean {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Los datos del CEA están vacíos o no son un array');
  }

  const first = data[0];
  const required = ['Microregion', 'Total_Gen', 'Metas', 'Faltantes'];
  const missing = required.filter((k) => !(k in first));

  if (missing.length > 0) {
    throw new Error(`Datos del CEA incompletos. Faltan: ${missing.join(', ')}`);
  }

  return true;
}

console.log('📦 Excel Writer cargado');
