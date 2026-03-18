/**
 * Excel Writer con SheetJS (xlsx)
 * =================================
 * Genera el archivo CEA usando SheetJS en lugar de ExcelJS.
 * SheetJS es mucho más ligero y compatible con el runtime Deno de Supabase Edge Functions.
 *
 * Estructura del CONCENTRADO:
 * - Fila 1: Título "Total X Figura" (fusionada)
 * - Fila 2: Headers principales (Microrregión, ECA, Coord., categorías agrupadas...)
 * - Fila 3: Sub-headers de género (M, F)
 * - Fila 4+: Datos
 */

import * as XLSX from 'xlsx';
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
// Estructura de columnas del CONCENTRADO
// ============================================================================

const MODALIDAD_COLUMNS = [
  { name: 'Inicial', keyM: 'Inicial_M', keyF: 'Inicial_F' },
  { name: 'Preescolar', keyM: 'Preescolar_M', keyF: 'Preescolar_F' },
  { name: 'CIC', keyM: 'CIC_M', keyF: 'CIC_F' },
  { name: 'PreeMig', keyM: 'PreeMig_M', keyF: 'PreeMig_F' },
  { name: 'Prim', keyM: 'Prim_M', keyF: 'Prim_F' },
  { name: 'Sec', keyM: 'Sec_M', keyF: 'Sec_F' },
];

// ============================================================================
// FUNCIÓN PRINCIPAL: generateCeaExcel
// ============================================================================

export async function generateCeaExcel(
  data: CeaRow[],
  options: ExcelWriterOptions = {}
): Promise<Uint8Array> {
  console.log('📝 Generando archivo Excel CEA con SheetJS...');

  const { sheetName = 'CONCENTRADO' } = options;

  // Total de columnas: 3 fijas + 12 modalidades (6x2) + 2 total x gén + 3 resumen = 20
  const TOTAL_COLS = 20;

  // ---- Fila 1: Título ----
  const row1: any[] = ['Total X Figura', ...Array(TOTAL_COLS - 1).fill('')];

  // ---- Fila 2: Headers principales ----
  const row2: any[] = [
    'Microrregión',
    'Educador Comunitario de Acompañamiento',
    'Coordinador de Seguimiento',
    // Modalidades (cada una abarca 2 cols M/F)
    'Inicial', '',
    'Preescolar', '',
    'CIC', '',
    'PreeMig', '',
    'Prim', '',
    'Sec', '',
    // Total x Gén
    'Total x Gén', '',
    // Resumen
    'Total Gen', 'Metas', 'Faltantes',
  ];

  // ---- Fila 3: Sub-headers de género ----
  const row3: any[] = [
    '', '', '',
    'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F',
    'M', 'F',
    '', '', '',
  ];

  // ---- Filas de datos ----
  const dataRows = data.map((row) => [
    row.Microregion,
    row.ECA,
    row.CoordinadorSeguimiento,
    (row as any).Inicial_M || '',
    (row as any).Inicial_F || '',
    (row as any).Preescolar_M || '',
    (row as any).Preescolar_F || '',
    (row as any).CIC_M || '',
    (row as any).CIC_F || '',
    (row as any).PreeMig_M || '',
    (row as any).PreeMig_F || '',
    (row as any).Prim_M || '',
    (row as any).Prim_F || '',
    (row as any).Sec_M || '',
    (row as any).Sec_F || '',
    row.Total_M,
    row.Total_F,
    row.Total_Gen,
    row.Metas,
    row.Faltantes,
  ]);

  const aoa = [row1, row2, row3, ...dataRows];

  // ---- Crear worksheet desde AoA ----
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // ---- Anchos de columna ----
  ws['!cols'] = [
    { wch: 22 }, // Microrregión
    { wch: 30 }, // ECA
    { wch: 28 }, // Coordinador de Seguimiento
    { wch: 6 }, { wch: 6 },   // Inicial M/F
    { wch: 6 }, { wch: 6 },   // Preescolar M/F
    { wch: 6 }, { wch: 6 },   // CIC M/F
    { wch: 6 }, { wch: 6 },   // PreeMig M/F
    { wch: 6 }, { wch: 6 },   // Prim M/F
    { wch: 6 }, { wch: 6 },   // Sec M/F
    { wch: 7 }, { wch: 7 },   // Total x Gén M/F
    { wch: 10 }, { wch: 10 }, { wch: 10 }, // Total Gen, Metas, Faltantes
  ];

  // ---- Fusionar celdas (0-indexed) ----
  ws['!merges'] = [
    // Fila 1: Título — toda la fila
    { s: { r: 0, c: 0 }, e: { r: 0, c: TOTAL_COLS - 1 } },
    // Columnas fijas: Microrregión, ECA, Coord — fusionar filas 2 y 3 (índices 1-2)
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
    { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
    // Modalidades: fusionar las 2 columnas M/F en la fila 2 (índice 1)
    { s: { r: 1, c: 3 },  e: { r: 1, c: 4 } },   // Inicial
    { s: { r: 1, c: 5 },  e: { r: 1, c: 6 } },   // Preescolar
    { s: { r: 1, c: 7 },  e: { r: 1, c: 8 } },   // CIC
    { s: { r: 1, c: 9 },  e: { r: 1, c: 10 } },  // PreeMig
    { s: { r: 1, c: 11 }, e: { r: 1, c: 12 } },  // Prim
    { s: { r: 1, c: 13 }, e: { r: 1, c: 14 } },  // Sec
    // Total x Gén: fusionar las 2 columnas M/F en fila 2
    { s: { r: 1, c: 15 }, e: { r: 1, c: 16 } },
    // Columnas resumen: fusionar filas 2 y 3
    { s: { r: 1, c: 17 }, e: { r: 2, c: 17 } },  // Total Gen
    { s: { r: 1, c: 18 }, e: { r: 2, c: 18 } },  // Metas
    { s: { r: 1, c: 19 }, e: { r: 2, c: 19 } },  // Faltantes
  ];

  // ---- Crear workbook y agregar hoja ----
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // ---- Serializar a XLSX ----
  console.log('💾 Serializando workbook a XLSX...');
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
  console.log(`✅ Excel generado: ${data.length} filas, ${TOTAL_COLS} columnas, ${buffer.byteLength} bytes`);

  return buffer;
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

console.log('📦 Excel Writer (SheetJS) cargado');
