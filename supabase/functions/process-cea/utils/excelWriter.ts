/**
 * Excel Writer con ExcelJS
 * =========================
 * Genera archivos Excel CEA con formato profesional usando ExcelJS
 *
 * Características:
 * - Headers con colores y fuentes bold
 * - Bordes en todas las celdas
 * - Auto-ajuste de anchos de columna
 * - Formato numérico para totales
 * - Alineación de celdas
 */

import ExcelJS from 'exceljs';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Datos del CEA para escribir al Excel
 * Cada objeto representa una fila (microrregión)
 */
export interface CeaData {
  Microregion: string;
  'Educador Comunitario de Acompañamiento': string;
  'Coordinador de Seguimiento': string;
  Inicial_M: number;
  Inicial_F: number;
  Preescolar_M: number;
  Preescolar_F: number;
  CIC_M: number;
  CIC_F: number;
  PreeMig_M: number;
  PreeMig_F: number;
  Prim_M: number;
  Prim_F: number;
  Sec_M: number;
  Sec_F: number;
  Total_M: number;
  Total_F: number;
  Total_Gen: number;
  Metas: number;
  Faltantes: number;
}

/**
 * Opciones de configuración para el generador de Excel
 */
export interface ExcelWriterOptions {
  sheetName?: string;          // Nombre de la hoja (default: "CONCENTRADO")
  includeHeaders?: boolean;    // Incluir fila de headers (default: true)
  applyFormatting?: boolean;   // Aplicar formato de colores/bordes (default: true)
  autoFitColumns?: boolean;    // Auto-ajustar anchos de columna (default: true)
}

// ============================================================================
// Configuración de estilos
// ============================================================================

/**
 * Colores del tema (en formato hex)
 */
const COLORS = {
  // Header principal
  headerBackground: 'FF4472C4',    // Azul oscuro
  headerText: 'FFFFFFFF',          // Blanco

  // Secciones
  sectionBackground: 'FFD9E2F3',   // Azul claro
  sectionText: 'FF000000',         // Negro

  // Datos
  dataBackground: 'FFFFFFFF',      // Blanco
  dataText: 'FF000000',            // Negro

  // Totales
  totalBackground: 'FFFFD966',     // Amarillo claro
  totalText: 'FF000000',           // Negro

  // Negativos (faltantes)
  negativeBackground: 'FFFF6B6B',  // Rojo claro
  negativeText: 'FFFFFFFF',        // Blanco
};

/**
 * Estilos de fuente
 */
const FONTS = {
  header: {
    name: 'Calibri',
    size: 12,
    bold: true,
    color: { argb: COLORS.headerText },
  },
  data: {
    name: 'Calibri',
    size: 11,
    bold: false,
    color: { argb: COLORS.dataText },
  },
  total: {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: COLORS.totalText },
  },
};

/**
 * Estilos de bordes
 */
const BORDERS = {
  thin: {
    top: { style: 'thin' as const, color: { argb: 'FF000000' } },
    bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
    left: { style: 'thin' as const, color: { argb: 'FF000000' } },
    right: { style: 'thin' as const, color: { argb: 'FF000000' } },
  },
  medium: {
    top: { style: 'medium' as const, color: { argb: 'FF000000' } },
    bottom: { style: 'medium' as const, color: { argb: 'FF000000' } },
    left: { style: 'medium' as const, color: { argb: 'FF000000' } },
    right: { style: 'medium' as const, color: { argb: 'FF000000' } },
  },
};

// ============================================================================
// FUNCIÓN PRINCIPAL: generateCeaExcel
// ============================================================================
/**
 * Genera un archivo Excel CEA con formato profesional
 *
 * @param data - Array de objetos con datos del CEA (uno por microrregión)
 * @param options - Opciones de configuración
 * @returns Promise<Buffer> - Buffer del archivo Excel generado
 *
 * @example
 * const buffer = await generateCeaExcel(ceaData, {
 *   sheetName: 'CONCENTRADO',
 *   applyFormatting: true
 * });
 */
export async function generateCeaExcel(
  data: any[],
  options: ExcelWriterOptions = {}
): Promise<Buffer> {
  try {
    console.log('📝 Generando archivo Excel CEA...');

    // 1. Configurar opciones por defecto
    const {
      sheetName = 'CONCENTRADO',
      includeHeaders = true,
      applyFormatting = true,
      autoFitColumns = true,
    } = options;

    // 2. Crear un nuevo Workbook
    const workbook = new ExcelJS.Workbook();

    // 3. Configurar propiedades del workbook
    workbook.creator = 'Sistema CEA CONAFE';
    workbook.created = new Date();
    workbook.modified = new Date();

    // 4. Crear la hoja de cálculo
    const worksheet = workbook.addWorksheet(sheetName, {
      properties: {
        defaultRowHeight: 20,
      },
      pageSetup: {
        orientation: 'landscape',  // Horizontal (muchas columnas)
        fitToPage: true,
        fitToWidth: 1,
      },
    });

    // 5. Definir estructura de columnas
    const columns = [
      { key: 'Microregion', header: 'Microrregión', width: 25 },
      { key: 'Educador Comunitario de Acompañamiento', header: 'Educador Comunitario de Acompañamiento', width: 35 },
      { key: 'Coordinador de Seguimiento', header: 'Coordinador de Seguimiento', width: 35 },
      { key: 'Inicial_M', header: 'Inicial M', width: 12 },
      { key: 'Inicial_F', header: 'Inicial F', width: 12 },
      { key: 'Preescolar_M', header: 'Preescolar M', width: 12 },
      { key: 'Preescolar_F', header: 'Preescolar F', width: 12 },
      { key: 'CIC_M', header: 'CIC M', width: 12 },
      { key: 'CIC_F', header: 'CIC F', width: 12 },
      { key: 'PreeMig_M', header: 'PreeMig M', width: 12 },
      { key: 'PreeMig_F', header: 'PreeMig F', width: 12 },
      { key: 'Prim_M', header: 'Prim M', width: 12 },
      { key: 'Prim_F', header: 'Prim F', width: 12 },
      { key: 'Sec_M', header: 'Sec M', width: 12 },
      { key: 'Sec_F', header: 'Sec F', width: 12 },
      { key: 'Total_M', header: 'Total M', width: 12 },
      { key: 'Total_F', header: 'Total F', width: 12 },
      { key: 'Total_Gen', header: 'Total Gen', width: 12 },
      { key: 'Metas', header: 'Metas', width: 12 },
      { key: 'Faltantes', header: 'Faltantes', width: 12 },
    ];

    worksheet.columns = columns;

    // 6. Agregar fila de headers si está habilitado
    if (includeHeaders) {
      const headerRow = worksheet.getRow(1);

      // Aplicar estilo a cada celda del header
      headerRow.eachCell((cell, colNumber) => {
        cell.font = FONTS.header;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.headerBackground },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
        cell.border = BORDERS.medium;
      });

      // Hacer el header más alto para que quepa el texto
      headerRow.height = 30;
    }

    // 7. Agregar datos fila por fila
    data.forEach((row, index) => {
      const excelRow = worksheet.addRow(row);

      // Aplicar formato a cada celda de datos
      if (applyFormatting) {
        excelRow.eachCell((cell, colNumber) => {
          // Font por defecto
          cell.font = FONTS.data;

          // Alineación según el tipo de dato
          const columnKey = columns[colNumber - 1]?.key;
          if (columnKey && typeof row[columnKey] === 'number') {
            // Números: centrado
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else {
            // Texto: izquierda
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }

          // Bordes
          cell.border = BORDERS.thin;

          // Formato especial para columnas de totales
          if (
            columnKey === 'Total_M' ||
            columnKey === 'Total_F' ||
            columnKey === 'Total_Gen' ||
            columnKey === 'Metas'
          ) {
            cell.font = FONTS.total;
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: COLORS.totalBackground },
            };
          }

          // Formato especial para faltantes negativos (rojo)
          if (columnKey === 'Faltantes' && typeof cell.value === 'number' && cell.value < 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: COLORS.negativeBackground },
            };
            cell.font = {
              ...FONTS.total,
              color: { argb: COLORS.negativeText },
            };
          }
        });
      }
    });

    // 8. Auto-ajustar anchos de columna si está habilitado
    if (autoFitColumns) {
      worksheet.columns.forEach((column) => {
        if (column.width) {
          // Ya tiene ancho predefinido, mantenerlo
          return;
        }

        // Calcular ancho basado en el contenido
        let maxLength = 0;
        column.eachCell!({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value ? cell.value.toString() : '';
          maxLength = Math.max(maxLength, cellValue.length);
        });

        // Establecer ancho (mínimo 10, máximo 50)
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
      });
    }

    // 9. Congelar la fila de headers
    worksheet.views = [
      {
        state: 'frozen',
        xSplit: 0,
        ySplit: 1,  // Congelar primera fila (headers)
        activeCell: 'A2',
      },
    ];

    // 10. Agregar filtros automáticos a los headers
    if (includeHeaders) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
      };
    }

    // 11. Convertir el workbook a buffer
    console.log('💾 Convirtiendo workbook a buffer...');
    const buffer = await workbook.xlsx.writeBuffer();

    console.log(`✅ Archivo Excel generado: ${data.length} filas, ${columns.length} columnas`);

    return buffer as Buffer;
  } catch (error) {
    console.error('❌ Error generando Excel:', error);
    throw new Error(`Error generando archivo Excel: ${error.message}`);
  }
}

// ============================================================================
// FUNCIÓN AUXILIAR: formatCeaFileName
// ============================================================================
/**
 * Genera el nombre del archivo CEA con formato estándar
 * Formato: CEA_DD_MM_YYYY.xlsx
 *
 * @param date - Fecha para el nombre del archivo (default: fecha actual)
 * @returns Nombre del archivo formateado
 *
 * @example
 * formatCeaFileName() // "CEA_06_02_2026.xlsx"
 * formatCeaFileName(new Date('2025-12-25')) // "CEA_25_12_2025.xlsx"
 */
export function formatCeaFileName(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `CEA_${day}_${month}_${year}.xlsx`;
}

// ============================================================================
// FUNCIÓN AUXILIAR: validateCeaData
// ============================================================================
/**
 * Valida que los datos del CEA tengan la estructura correcta
 *
 * @param data - Array de datos a validar
 * @returns true si es válido, lanza error si no
 */
export function validateCeaData(data: any[]): boolean {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Los datos del CEA están vacíos o no son un array');
  }

  // Verificar que el primer objeto tenga las propiedades esperadas
  const requiredKeys = [
    'Microregion',
    'Educador Comunitario de Acompañamiento',
    'Coordinador de Seguimiento',
    'Total_Gen',
    'Metas',
    'Faltantes',
  ];

  const firstRow = data[0];
  const missingKeys = requiredKeys.filter((key) => !(key in firstRow));

  if (missingKeys.length > 0) {
    throw new Error(
      `Datos del CEA incompletos. Faltan propiedades: ${missingKeys.join(', ')}`
    );
  }

  return true;
}

console.log('📦 Excel Writer con ExcelJS cargado');
