/**
 * CEA Excel Writer — Browser-side
 * =================================
 * Genera el archivo Excel CEA usando SheetJS en el navegador.
 * Misma lógica que la Edge Function process-cea/utils/excelWriter.ts.
 */

import * as XLSX from 'xlsx';
import type { CeaRow } from './ceaProcessor';

// ============================================================================
// generateCeaExcel
// ============================================================================

export function generateCeaExcel(data: CeaRow[], sheetName = 'CONCENTRADO'): Uint8Array {
  const TOTAL_COLS = 20;

  // Fila 1: Título
  const row1: any[] = ['Total X Figura', ...Array(TOTAL_COLS - 1).fill('')];

  // Fila 2: Headers principales
  const row2: any[] = [
    'Microrregión',
    'Educador Comunitario de Acompañamiento',
    'Coordinador de Seguimiento',
    'Inicial', '', 'Preescolar', '', 'CIC', '', 'PreeMig', '', 'Prim', '', 'Sec', '',
    'Total x Gén', '',
    'Total Gen', 'Metas', 'Faltantes',
  ];

  // Fila 3: Sub-headers de género
  const row3: any[] = [
    '', '', '',
    'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F',
    'M', 'F',
    '', '', '',
  ];

  // Filas de datos
  const dataRows = data.map((row) => [
    row.Microregion,
    row.ECA,
    row.CoordinadorSeguimiento,
    row.Inicial_M || '',
    row.Inicial_F || '',
    row.Preescolar_M || '',
    row.Preescolar_F || '',
    row.CIC_M || '',
    row.CIC_F || '',
    row.PreeMig_M || '',
    row.PreeMig_F || '',
    row.Prim_M || '',
    row.Prim_F || '',
    row.Sec_M || '',
    row.Sec_F || '',
    row.Total_M,
    row.Total_F,
    row.Total_Gen,
    row.Metas,
    row.Faltantes,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([row1, row2, row3, ...dataRows]);

  ws['!cols'] = [
    { wch: 22 }, { wch: 30 }, { wch: 28 },
    { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
    { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
    { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
    { wch: 7 }, { wch: 7 },
    { wch: 10 }, { wch: 10 }, { wch: 10 },
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: TOTAL_COLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
    { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
    { s: { r: 1, c: 3 },  e: { r: 1, c: 4 } },
    { s: { r: 1, c: 5 },  e: { r: 1, c: 6 } },
    { s: { r: 1, c: 7 },  e: { r: 1, c: 8 } },
    { s: { r: 1, c: 9 },  e: { r: 1, c: 10 } },
    { s: { r: 1, c: 11 }, e: { r: 1, c: 12 } },
    { s: { r: 1, c: 13 }, e: { r: 1, c: 14 } },
    { s: { r: 1, c: 15 }, e: { r: 1, c: 16 } },
    { s: { r: 1, c: 17 }, e: { r: 2, c: 17 } },
    { s: { r: 1, c: 18 }, e: { r: 2, c: 18 } },
    { s: { r: 1, c: 19 }, e: { r: 2, c: 19 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

// ============================================================================
// formatCeaFileName
// ============================================================================

export function formatCeaFileName(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `CEA_${day}_${month}_${year}.xlsx`;
}
