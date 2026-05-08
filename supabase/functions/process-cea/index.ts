/**
 * Edge Function: process-cea  (reescritura BD-driven)
 * =====================================================
 * Genera el archivo CEA leyendo de la BD (no de los Masters Excel) y
 * rellenando la plantilla `CEA 25-26 VACIO.xlsx` alojada en el bucket
 * `cea-templates`.
 *
 * Flujo:
 *   1. Auth admin
 *   2. Body: { ciclo_escolar: "25-26" }
 *   3. Crear registro en cea_files (status=processing)
 *   4. Bajar plantilla VACIO desde Storage
 *   5. Cargar de la BD: ccts activos + figuras activas + bajas + agregados de
 *      alumnos (excluye alumnos.baja y ccts.activo=false)
 *   6. Rellenar las 4 hojas
 *   7. Subir XLSX a `cea-files`, marcar latest=true, completed
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  corsErrorResponse,
  corsJsonResponse,
  handleCorsPreflightRequest,
} from '../_shared/cors.ts';
import {
  getSupabaseServiceClient,
  isUserAdmin,
  getAuthenticatedUser,
} from '../_shared/supabaseClient.ts';
import {
  fetchCctsActivos,
  fetchFigurasActivas,
  fetchFigurasBajas,
  aggAlumnosPorCct,
} from './queryDb.ts';
import { fillCeaTemplate } from './fillTemplate.ts';

const TEMPLATE_BUCKET = 'cea-templates';
const TEMPLATE_PATH   = 'CEA_25-26_VACIO.xlsx';
const CEA_BUCKET      = 'cea-files';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest();
  if (req.method !== 'POST') return corsErrorResponse('Método no permitido', 405);

  const startTime = Date.now();

  try {
    // 1. Auth
    const user = await getAuthenticatedUser(req);
    if (!user) return corsErrorResponse('No autenticado', 401);
    if (!(await isUserAdmin(req))) return corsErrorResponse('Solo administradores', 403);

    // 2. Body
    const body = await req.json().catch(() => ({}));
    const ciclo = (body.ciclo_escolar ?? body.ciclo ?? '').toString().trim();
    if (!ciclo) return corsErrorResponse('Falta `ciclo_escolar` (ej. "25-26")', 400);

    console.log(`🚀 process-cea: ciclo=${ciclo} user=${user.email}`);

    const supabase = getSupabaseServiceClient(req);
    const fileName = `CEA_${ciclo.replace(/[^0-9A-Za-z-]/g, '_')}_${formatDate()}.xlsx`;
    const filePath = `${crypto.randomUUID()}_${fileName}`;

    // 3. Bajar plantilla
    const { data: tplBlob, error: tplErr } = await supabase.storage
      .from(TEMPLATE_BUCKET)
      .download(TEMPLATE_PATH);
    if (tplErr || !tplBlob) {
      return corsErrorResponse(
        `No se pudo descargar plantilla ${TEMPLATE_BUCKET}/${TEMPLATE_PATH}: ${tplErr?.message}`,
        500,
      );
    }
    const tplBuf = await tplBlob.arrayBuffer();

    // 4. Datos desde BD
    console.log('📥 leyendo BD…');
    const [ccts, figurasActivas, figurasBajas, alumnosAggByCct] = await Promise.all([
      fetchCctsActivos(supabase, ciclo),
      fetchFigurasActivas(supabase, ciclo),
      fetchFigurasBajas(supabase, ciclo),
      aggAlumnosPorCct(supabase, ciclo),
    ]);
    console.log(`   ccts=${ccts.length}  figuras=${figurasActivas.length}  bajas=${figurasBajas.length}  cctsConAlumnos=${alumnosAggByCct.size}`);

    if (ccts.length === 0) {
      return corsErrorResponse(`No hay CCT activos para ciclo ${ciclo}`, 400);
    }

    // 5. Rellenar plantilla
    console.log('📝 rellenando plantilla…');
    const xlsx = await fillCeaTemplate({
      templateBuffer: tplBuf,
      ciclo,
      ccts,
      figurasActivas,
      figurasBajas,
      alumnosAggByCct,
    });

    // 6. Subir a Storage
    console.log(`📤 subiendo a ${CEA_BUCKET}/${filePath}…`);
    const { error: upErr } = await supabase.storage
      .from(CEA_BUCKET)
      .upload(filePath, xlsx, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      });
    if (upErr) {
      return corsErrorResponse(`Error subiendo CEA: ${upErr.message}`, 500);
    }

    // 7. Insertar registro completo (la tabla exige file_size > 0, así que
    //    insertamos al final con el tamaño real del archivo).
    const elapsed = Date.now() - startTime;
    const { data: ceaRecord, error: insErr } = await supabase
      .from('cea_files')
      .insert({
        file_name: fileName,
        file_path: filePath,
        file_size: xlsx.byteLength,
        generated_from_batch: crypto.randomUUID(), // ya no viene de un batch real
        processed_by: user.id,
        processing_status: 'completed',
        total_records: ccts.length,
        processing_time_ms: elapsed,
        is_latest: true,
      })
      .select()
      .single();
    if (insErr || !ceaRecord) {
      console.error('❌ insert cea_files:', insErr);
      // Limpiar el archivo que subimos para no dejar huérfanos
      await supabase.storage.from(CEA_BUCKET).remove([filePath]);
      return corsErrorResponse(`No se pudo crear el registro CEA: ${insErr?.message}`, 500);
    }

    // 8. Marcar CEAs anteriores como no-latest
    await supabase.from('cea_files').update({ is_latest: false })
      .neq('id', ceaRecord.id).eq('is_latest', true);

    console.log(`🎉 CEA generado en ${elapsed}ms — ${xlsx.byteLength} bytes`);

    return corsJsonResponse({
      success: true,
      data: {
        ceaId: ceaRecord.id,
        fileName,
        filePath,
        ciclo,
        ccts: ccts.length,
        figurasActivas: figurasActivas.length,
        figurasBajas: figurasBajas.length,
        processingTimeMs: elapsed,
        fileSize: xlsx.byteLength,
      },
    });
  } catch (e) {
    const err = e as Error;
    console.error('❌ process-cea:', err.message, err.stack);
    return corsErrorResponse('Error procesando CEA', 500, { message: err.message });
  }
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function formatDate(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}_${mm}_${yyyy}`;
}

console.log('🚀 process-cea (BD-driven) iniciada');
