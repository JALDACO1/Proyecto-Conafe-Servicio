/**
 * Edge Function: process-cea
 * ===========================
 * Procesa 4 archivos Master y genera un archivo CEA
 *
 * Esta es la función MÁS IMPORTANTE del sistema.
 * Orquesta todo el flujo de procesamiento:
 *
 * 1. Valida que el usuario sea admin
 * 2. Verifica que haya exactamente 4 Masters validados en el batch
 * 3. Descarga los 4 archivos Master desde Storage
 * 4. Procesa cada archivo con Danfo.js (tipo pandas)
 * 5. Fusiona los datos y genera el DataFrame CEA
 * 6. Genera el archivo Excel con formato profesional
 * 7. Sube el CEA a Storage
 * 8. Actualiza la base de datos
 * 9. Marca el CEA como el más reciente (is_latest = true)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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
  getAuthenticatedUser,
} from '../_shared/supabaseClient.ts';
import type {
  ProcessCeaRequest,
  MasterFileType,
} from '../_shared/types.ts';

// Importar funciones de procesamiento
import {
  processMasterAlumnos,
  processMasterServicios,
  processMasterFiguras,
  agruparAlumnosPorMicroregion,
  generarDataframeCEA,
} from './utils/dataProcessor.ts';
import {
  generateCeaExcel,
  formatCeaFileName,
  validateCeaData,
} from './utils/excelWriter.ts';

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

  // Timestamp de inicio para medir tiempo de procesamiento
  const startTime = Date.now();

  try {
    console.log('🚀 ========================================');
    console.log('🚀 Iniciando procesamiento de CEA');
    console.log('🚀 ========================================');

    // 3. Verificar que el usuario esté autenticado y sea admin
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return corsErrorResponse('No autenticado', 401);
    }

    if (!(await isUserAdmin(req))) {
      return corsErrorResponse('Acceso denegado. Solo administradores', 403);
    }

    console.log(`✅ Usuario autenticado: ${user.email}`);

    // 4. Parsear el body del request
    const body: ProcessCeaRequest = await req.json();
    const { batchId } = body;

    if (!batchId) {
      return corsErrorResponse('Falta el parámetro requerido: batchId', 400);
    }

    console.log(`📦 Procesando batch: ${batchId}`);

    // 5. Obtener el cliente de Supabase con privilegios de servicio
    const supabase = getSupabaseServiceClient(req);

    // 6. Obtener los 4 archivos Master del batch
    const { data: masterFiles, error: fetchError } = await supabase
      .from('master_uploads')
      .select('*')
      .eq('upload_batch_id', batchId)
      .eq('status', 'validated');

    if (fetchError || !masterFiles) {
      console.error('❌ Error obteniendo Masters:', fetchError);
      return corsErrorResponse('Error obteniendo archivos Master', 500);
    }

    // 7. Verificar que haya exactamente 4 Masters validados
    if (masterFiles.length !== 4) {
      return corsErrorResponse(
        `Se requieren exactamente 4 archivos Master validados. Encontrados: ${masterFiles.length}`,
        400
      );
    }

    console.log(`✅ Encontrados ${masterFiles.length} archivos Master validados`);

    // 8. Verificar que estén los 4 tipos requeridos
    const fileTypes = masterFiles.map((f) => f.file_type);
    const requiredTypes: MasterFileType[] = ['alumnos', 'servicios', 'figuras', 'telefonia'];
    const missingTypes = requiredTypes.filter((t) => !fileTypes.includes(t));

    if (missingTypes.length > 0) {
      return corsErrorResponse(
        `Faltan archivos Master de tipo: ${missingTypes.join(', ')}`,
        400
      );
    }

    // 9. Crear registro inicial del CEA con estado 'processing'
    const ceaFileName = formatCeaFileName();
    const ceaFilePath = `${crypto.randomUUID()}_${ceaFileName}`;

    console.log(`📝 Creando registro CEA: ${ceaFileName}`);

    const { data: ceaRecord, error: ceaInsertError } = await supabase
      .from('cea_files')
      .insert({
        file_name: ceaFileName,
        file_path: ceaFilePath,
        file_size: 0, // Se actualizará después
        generated_from_batch: batchId,
        processed_by: user.id,
        processing_status: 'processing',
        is_latest: false, // Se actualizará al final
      })
      .select()
      .single();

    if (ceaInsertError || !ceaRecord) {
      console.error('❌ Error creando registro CEA:', ceaInsertError);
      return corsErrorResponse('Error creando registro CEA', 500);
    }

    console.log(`✅ Registro CEA creado: ${ceaRecord.id}`);

    // 10. Descargar y procesar cada archivo Master
    console.log('📥 Descargando y procesando archivos Master...');

    // Buscar cada tipo de archivo
    const masterAlumnos = masterFiles.find((f) => f.file_type === 'alumnos')!;
    const masterServicios = masterFiles.find((f) => f.file_type === 'servicios')!;
    const masterFiguras = masterFiles.find((f) => f.file_type === 'figuras')!;

    // Descargar Master de Alumnos
    console.log(`📥 Descargando Master de Alumnos: ${masterAlumnos.file_name}`);
    const { data: alumnosBlob, error: alumnosDownloadError } = await supabase.storage
      .from('master-files')
      .download(masterAlumnos.file_path);

    if (alumnosDownloadError || !alumnosBlob) {
      throw new Error(`Error descargando Master de Alumnos: ${alumnosDownloadError?.message}`);
    }

    // Descargar Master de Servicios
    console.log(`📥 Descargando Master de Servicios: ${masterServicios.file_name}`);
    const { data: serviciosBlob, error: serviciosDownloadError } = await supabase.storage
      .from('master-files')
      .download(masterServicios.file_path);

    if (serviciosDownloadError || !serviciosBlob) {
      throw new Error(`Error descargando Master de Servicios: ${serviciosDownloadError?.message}`);
    }

    // Descargar Master de Figuras
    console.log(`📥 Descargando Master de Figuras: ${masterFiguras.file_name}`);
    const { data: figurasBlob, error: figurasDownloadError } = await supabase.storage
      .from('master-files')
      .download(masterFiguras.file_path);

    if (figurasDownloadError || !figurasBlob) {
      throw new Error(`Error descargando Master de Figuras: ${figurasDownloadError?.message}`);
    }

    // 11. Procesar cada archivo con Danfo.js
    console.log('🐼 Procesando datos con Danfo.js...');

    const alumnosData = await processMasterAlumnos(await alumnosBlob.arrayBuffer());
    const serviciosData = await processMasterServicios(await serviciosBlob.arrayBuffer());
    const figurasData = await processMasterFiguras(await figurasBlob.arrayBuffer());

    console.log('✅ Archivos Master procesados exitosamente');

    // 12. Agrupar alumnos por microrregión
    const alumnosAgrupados = agruparAlumnosPorMicroregion(alumnosData);

    // 13. Generar DataFrame CEA fusionando todos los datos
    console.log('🔄 Generando DataFrame CEA...');
    const ceaDataFrame = generarDataframeCEA(alumnosAgrupados, serviciosData, figurasData);

    // 14. Validar que los datos CEA sean correctos
    validateCeaData(ceaDataFrame);

    console.log(`✅ DataFrame CEA generado: ${ceaDataFrame.length} microrregiones`);

    // 15. Generar archivo Excel con formato
    console.log('📝 Generando archivo Excel con formato...');
    const excelBuffer = await generateCeaExcel(ceaDataFrame, {
      sheetName: 'CONCENTRADO',
      applyFormatting: true,
      autoFitColumns: true,
    });

    console.log(`✅ Archivo Excel generado: ${excelBuffer.byteLength} bytes`);

    // 16. Subir archivo CEA a Storage
    console.log(`📤 Subiendo CEA a Storage: ${ceaFilePath}`);

    const { error: uploadError } = await supabase.storage
      .from('cea-files')
      .upload(ceaFilePath, excelBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Error subiendo CEA a Storage: ${uploadError.message}`);
    }

    console.log('✅ CEA subido a Storage exitosamente');

    // 17. Calcular tiempo de procesamiento
    const processingTimeMs = Date.now() - startTime;

    // 18. Actualizar registro CEA con estado 'completed'
    const { error: updateError } = await supabase
      .from('cea_files')
      .update({
        file_size: excelBuffer.byteLength,
        processing_status: 'completed',
        total_records: ceaDataFrame.length,
        processing_time_ms: processingTimeMs,
        is_latest: true, // Marcar como el más reciente
      })
      .eq('id', ceaRecord.id);

    if (updateError) {
      console.error('❌ Error actualizando registro CEA:', updateError);
      // No fallar aquí, el archivo ya se subió exitosamente
    }

    // 19. Marcar todos los CEAs anteriores como no-latest
    await supabase
      .from('cea_files')
      .update({ is_latest: false })
      .neq('id', ceaRecord.id)
      .eq('is_latest', true);

    console.log('🎉 ========================================');
    console.log(`🎉 CEA generado exitosamente en ${processingTimeMs}ms`);
    console.log('🎉 ========================================');

    // 20. Retornar respuesta de éxito
    return corsJsonResponse({
      success: true,
      message: 'CEA generado exitosamente',
      data: {
        ceaId: ceaRecord.id,
        fileName: ceaFileName,
        filePath: ceaFilePath,
        totalRecords: ceaDataFrame.length,
        processingTimeMs,
        fileSize: excelBuffer.byteLength,
      },
    });
  } catch (error) {
    console.error('❌ ========================================');
    console.error('❌ Error en process-cea:', error);
    console.error('❌ ========================================');

    // Registrar error en processing_logs
    try {
      const supabase = getSupabaseServiceClient(req);
      await supabase.from('processing_logs').insert({
        level: 'error',
        message: 'Error procesando CEA',
        details: {
          error: error.message,
          stack: error.stack,
        },
      });
    } catch (logError) {
      console.error('❌ Error registrando log:', logError);
    }

    return corsErrorResponse(
      'Error procesando CEA',
      500,
      {
        message: error.message,
        stack: Deno.env.get('DENO_ENV') === 'development' ? error.stack : undefined,
      }
    );
  }
});

console.log('🚀 Edge Function process-cea iniciada');
