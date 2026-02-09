/**
 * Edge Function: validate-master
 * ===============================
 * Valida la estructura de un archivo Master subido
 *
 * Esta función se llama desde el frontend después de subir un archivo Master.
 * Verifica que:
 * 1. El archivo sea un Excel válido
 * 2. Contenga la hoja esperada según el tipo de Master
 * 3. Tenga todas las columnas requeridas
 * 4. Los datos tengan el formato correcto
 *
 * Si la validación es exitosa, actualiza el estado del Master a 'validated'
 * Si falla, actualiza el estado a 'error' y guarda los errores encontrados
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import * as XLSX from 'xlsx';

// Importar utilidades compartidas
import {
  corsHeaders,
  corsErrorResponse,
  corsJsonResponse,
  handleCorsPreflightRequest,
} from '../_shared/cors.ts';
import {
  getSupabaseServiceClient,
  isUserAdmin,
} from '../_shared/supabaseClient.ts';
import type {
  MasterFileType,
  ValidationError,
  ValidationResult,
  ValidateMasterRequest,
  EXPECTED_SHEET_NAMES,
  REQUIRED_COLUMNS,
} from '../_shared/types.ts';

// Importar constantes
const EXPECTED_SHEETS: Record<MasterFileType, string> = {
  alumnos: 'Master',
  servicios: 'MasterPRODET06 (2)',
  figuras: 'Master-Figuras-Educativas',
  telefonia: '',
};

const REQUIRED_COLS: Record<MasterFileType, string[]> = {
  alumnos: ['Microregion', 'Genero', 'Nivel'],
  servicios: ['nomMicroregion', 'nomModalidad'],
  figuras: [
    'Microregion de servicio',
    'Figura',
    'apellidoPaterno',
    'apellidoMaterno',
    'nombre',
  ],
  telefonia: [],
};

// ============================================================================
// Handler Principal
// ============================================================================

serve(async (req: Request) => {
  // 1. Manejar peticiones OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  // 2. Solo aceptar peticiones POST
  if (req.method !== 'POST') {
    return corsErrorResponse('Método no permitido. Usa POST', 405);
  }

  try {
    // 3. Verificar que el usuario esté autenticado y sea admin
    if (!(await isUserAdmin(req))) {
      return corsErrorResponse('Acceso denegado. Solo administradores', 403);
    }

    // 4. Parsear el body del request
    const body: ValidateMasterRequest = await req.json();
    const { masterId } = body;

    if (!masterId) {
      return corsErrorResponse(
        'Falta el parámetro requerido: masterId',
        400
      );
    }

    console.log(`🔍 Iniciando validación del Master ID: ${masterId}`);

    // 5. Obtener información del Master desde la base de datos
    const supabase = getSupabaseServiceClient(req);

    const { data: masterUpload, error: fetchError } = await supabase
      .from('master_uploads')
      .select('*')
      .eq('id', masterId)
      .single();

    if (fetchError || !masterUpload) {
      console.error('❌ Error obteniendo Master:', fetchError);
      return corsErrorResponse('Archivo Master no encontrado', 404);
    }

    // 6. Actualizar estado a 'validating'
    await supabase
      .from('master_uploads')
      .update({ status: 'validating' })
      .eq('id', masterId);

    // 7. Descargar el archivo desde Storage
    console.log(`📥 Descargando archivo: ${masterUpload.file_path}`);

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('master-files')
      .download(masterUpload.file_path);

    if (downloadError || !fileBlob) {
      console.error('❌ Error descargando archivo:', downloadError);

      // Actualizar estado a 'error'
      await supabase
        .from('master_uploads')
        .update({
          status: 'error',
          validation_errors: [
            {
              message: 'No se pudo descargar el archivo desde Storage',
              code: 'DOWNLOAD_FAILED',
            },
          ],
        })
        .eq('id', masterId);

      return corsErrorResponse('Error descargando el archivo', 500);
    }

    // 8. Convertir Blob a ArrayBuffer para procesarlo con xlsx
    const arrayBuffer = await fileBlob.arrayBuffer();

    // 9. Validar el archivo
    const validationResult = await validateMasterFile(
      arrayBuffer,
      masterUpload.file_type as MasterFileType
    );

    // 10. Actualizar el estado en la base de datos según el resultado
    if (validationResult.isValid) {
      // ✅ Validación exitosa
      console.log(`✅ Archivo validado exitosamente. Registros: ${validationResult.recordCount}`);

      await supabase
        .from('master_uploads')
        .update({
          status: 'validated',
          validation_errors: null,
          record_count: validationResult.recordCount,
        })
        .eq('id', masterId);

      return corsJsonResponse({
        success: true,
        message: 'Archivo validado exitosamente',
        data: {
          masterId,
          recordCount: validationResult.recordCount,
          warnings: validationResult.warnings || [],
        },
      });
    } else {
      // ❌ Validación falló
      console.error(`❌ Validación falló. Errores:`, validationResult.errors);

      await supabase
        .from('master_uploads')
        .update({
          status: 'error',
          validation_errors: validationResult.errors || [],
        })
        .eq('id', masterId);

      return corsJsonResponse(
        {
          success: false,
          message: 'Archivo inválido',
          errors: validationResult.errors,
        },
        400
      );
    }
  } catch (error) {
    console.error('❌ Error inesperado en validate-master:', error);

    return corsErrorResponse(
      'Error inesperado al validar el archivo',
      500,
      {
        message: error.message,
        stack: Deno.env.get('DENO_ENV') === 'development' ? error.stack : undefined,
      }
    );
  }
});

// ============================================================================
// Función: validateMasterFile
// ============================================================================
/**
 * Valida la estructura de un archivo Master Excel
 *
 * @param arrayBuffer - Contenido del archivo Excel
 * @param fileType - Tipo de Master (alumnos, servicios, figuras, telefonia)
 * @returns ValidationResult con resultado y errores si los hay
 */
async function validateMasterFile(
  arrayBuffer: ArrayBuffer,
  fileType: MasterFileType
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  try {
    // 1. Leer el archivo Excel con xlsx
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // 2. Validar que el workbook se haya leído correctamente
    if (!workbook || !workbook.Sheets) {
      errors.push({
        message: 'El archivo no es un Excel válido',
        code: 'INVALID_EXCEL',
      });
      return { isValid: false, errors };
    }

    // 3. Obtener el nombre de la hoja esperada
    const expectedSheetName = EXPECTED_SHEETS[fileType];

    // Si el tipo es telefonía, no validar (actualmente no se procesa)
    if (fileType === 'telefonia') {
      return {
        isValid: true,
        recordCount: 0,
        warnings: ['El archivo de telefonía no se procesa actualmente'],
      };
    }

    // 4. Verificar que exista la hoja esperada
    if (!workbook.Sheets[expectedSheetName]) {
      errors.push({
        message: `No se encontró la hoja "${expectedSheetName}" en el archivo`,
        code: 'SHEET_NOT_FOUND',
        details: {
          expectedSheet: expectedSheetName,
          availableSheets: Object.keys(workbook.Sheets),
        },
      });
      return { isValid: false, errors };
    }

    // 5. Convertir la hoja a JSON
    const worksheet = workbook.Sheets[expectedSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    // 6. Verificar que la hoja tenga datos
    if (!jsonData || jsonData.length === 0) {
      errors.push({
        message: `La hoja "${expectedSheetName}" está vacía`,
        code: 'EMPTY_SHEET',
      });
      return { isValid: false, errors };
    }

    // 7. Obtener las columnas del archivo (headers)
    const firstRow = jsonData[0] as Record<string, any>;
    const availableColumns = Object.keys(firstRow);

    // 8. Verificar que existan las columnas requeridas
    const requiredColumns = REQUIRED_COLS[fileType];
    const missingColumns = requiredColumns.filter(
      (col) => !availableColumns.includes(col)
    );

    if (missingColumns.length > 0) {
      errors.push({
        message: 'Faltan columnas requeridas en el archivo',
        code: 'MISSING_COLUMNS',
        details: {
          missingColumns,
          availableColumns,
          requiredColumns,
        },
      });
      return { isValid: false, errors };
    }

    // 9. Validar datos según el tipo de archivo
    const dataValidation = validateDataByType(jsonData, fileType);
    if (!dataValidation.isValid) {
      errors.push(...dataValidation.errors);
      return { isValid: false, errors };
    }

    // 10. Verificar límite de registros (100,000 máximo)
    const MAX_RECORDS = 100000;
    if (jsonData.length > MAX_RECORDS) {
      warnings.push(
        `El archivo tiene ${jsonData.length} registros. Se recomienda menos de ${MAX_RECORDS}`
      );
    }

    // ✅ Validación exitosa
    return {
      isValid: true,
      recordCount: jsonData.length,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('❌ Error validando archivo:', error);

    errors.push({
      message: 'Error al procesar el archivo Excel',
      code: 'PROCESSING_ERROR',
      details: {
        error: error.message,
      },
    });

    return { isValid: false, errors };
  }
}

// ============================================================================
// Función: validateDataByType
// ============================================================================
/**
 * Valida los datos específicos según el tipo de Master
 *
 * @param data - Datos del Excel convertidos a JSON
 * @param fileType - Tipo de Master
 * @returns Resultado de validación
 */
function validateDataByType(
  data: any[],
  fileType: MasterFileType
): { isValid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  // Validar primeras 10 filas (muestra representativa)
  const sampleSize = Math.min(10, data.length);

  for (let i = 0; i < sampleSize; i++) {
    const row = data[i];

    switch (fileType) {
      case 'alumnos':
        // Validar que Genero sea H o M
        if (row.Genero && !['H', 'M', 'h', 'm'].includes(row.Genero)) {
          errors.push({
            message: `Fila ${i + 2}: Género inválido "${row.Genero}". Debe ser H o M`,
            code: 'INVALID_GENDER',
            field: 'Genero',
          });
        }
        break;

      case 'servicios':
        // Validar que los campos no estén vacíos
        if (!row.nomMicroregion || !row.nomModalidad) {
          errors.push({
            message: `Fila ${i + 2}: Campos vacíos detectados`,
            code: 'EMPTY_REQUIRED_FIELDS',
          });
        }
        break;

      case 'figuras':
        // Validar que el nombre esté completo
        if (!row.nombre || !row.apellidoPaterno) {
          errors.push({
            message: `Fila ${i + 2}: Faltan nombre o apellidos`,
            code: 'INCOMPLETE_NAME',
          });
        }
        break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

console.log('🚀 Edge Function validate-master iniciada');
