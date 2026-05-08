/**
 * Edge Function: ingest-master
 * =============================
 * Reemplaza a validate-master. Además de validar el archivo, persiste los
 * datos del Master (Servicios / Figuras / Alumnos) en las tablas relacionales
 * definidas por la hoja "Esquema relacional" de Datos_a_recuperar.xlsx.
 *
 * Flujo:
 *   1) El frontend sube el archivo a Storage y crea la fila en master_uploads
 *      con status='uploaded'.
 *   2) Llama a esta función con { masterId, cicloEscolar }.
 *   3) La función:
 *      - Marca status='ingesting'.
 *      - Descarga el xlsx.
 *      - Valida hoja y columnas requeridas.
 *      - Upsert por lotes a las tablas relacionales respetando las FKs.
 *      - Actualiza status='ingested' con ingest_stats.
 *
 * Sólo se persisten las columnas listadas en masterSchema.ts. Las demás
 * columnas del Excel se ignoran silenciosamente.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import * as XLSX from 'xlsx';

import {
  corsErrorResponse,
  corsJsonResponse,
  handleCorsPreflightRequest,
} from '../_shared/cors.ts';
import {
  getSupabaseServiceClient,
  isUserAdmin,
} from '../_shared/supabaseClient.ts';
import {
  ALUMNOS_MAP,
  FIGURAS_MAP,
  SERVICIOS_MAP,
  MASTER_SHEETS,
  MASTER_REQUIRED_COLUMNS,
  type MasterType,
  type TableMap,
  mapRow,
  coerce,
} from '../_shared/masterSchema.ts';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500;

interface IngestRequest {
  masterId: string;
  cicloEscolar?: string; // opcional; si viene, sobrescribe el del archivo
}

interface IngestStats {
  [table: string]: number;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest();
  if (req.method !== 'POST') return corsErrorResponse('Método no permitido', 405);

  try {
    if (!(await isUserAdmin(req))) {
      return corsErrorResponse('Acceso denegado. Solo administradores', 403);
    }

    const body = (await req.json()) as IngestRequest;
    const { masterId, cicloEscolar } = body;
    if (!masterId) return corsErrorResponse('Falta masterId', 400);

    console.log(`🔍 ingest-master: masterId=${masterId} ciclo=${cicloEscolar ?? '(archivo)'}`);

    const supabase = getSupabaseServiceClient(req);

    // 1) Cargar master_uploads
    const { data: master, error: fetchErr } = await supabase
      .from('master_uploads')
      .select('*')
      .eq('id', masterId)
      .single();

    if (fetchErr || !master) {
      return corsErrorResponse('Archivo Master no encontrado', 404);
    }

    const fileType = master.file_type as MasterType;
    if (!['servicios', 'figuras', 'alumnos'].includes(fileType)) {
      return corsErrorResponse(`Tipo de master no soportado: ${fileType}`, 400);
    }

    const ingestBatchId = crypto.randomUUID();

    // 2) Estado ingesting
    await supabase
      .from('master_uploads')
      .update({
        status: 'ingesting',
        ingest_batch_id: ingestBatchId,
        ciclo_escolar: cicloEscolar ?? null,
      })
      .eq('id', masterId);

    // 3) Descargar archivo
    const { data: blob, error: dlErr } = await supabase.storage
      .from('master-files')
      .download(master.file_path);
    if (dlErr || !blob) {
      await markError(supabase, masterId, 'DOWNLOAD_FAILED', dlErr?.message);
      return corsErrorResponse('Error descargando el archivo', 500);
    }

    // 4) Leer hoja
    const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array', cellDates: true });
    const sheetName = MASTER_SHEETS[fileType];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      await markError(supabase, masterId, 'SHEET_NOT_FOUND', `Falta la hoja "${sheetName}"`, {
        availableSheets: wb.SheetNames,
      });
      return corsErrorResponse(`No se encontró la hoja "${sheetName}"`, 400);
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
    if (!rows.length) {
      await markError(supabase, masterId, 'EMPTY_SHEET', 'La hoja está vacía');
      return corsErrorResponse('La hoja está vacía', 400);
    }

    // 5) Validar columnas requeridas
    const available = Object.keys(rows[0] ?? {});
    const required = MASTER_REQUIRED_COLUMNS[fileType];
    const missing = required.filter((c) => !available.includes(c));
    if (missing.length) {
      await markError(supabase, masterId, 'MISSING_COLUMNS', 'Faltan columnas requeridas', {
        missing,
        availableSample: available.slice(0, 30),
      });
      return corsErrorResponse(`Faltan columnas: ${missing.join(', ')}`, 400);
    }

    // 6) Ingestar según tipo
    const cicloResolved = cicloEscolar ?? inferCiclo(rows, fileType) ?? null;
    if (!cicloResolved && (fileType === 'figuras' || fileType === 'alumnos' || fileType === 'servicios')) {
      // ciclo_escolar es requerido para las tablas transaccionales
      await markError(supabase, masterId, 'MISSING_CICLO',
        'No se pudo inferir el ciclo escolar y no se recibió en el request');
      return corsErrorResponse('Falta ciclo escolar', 400);
    }

    let stats: IngestStats = {};
    try {
      if (fileType === 'servicios') {
        stats = await ingestServicios(supabase, rows, cicloResolved!, ingestBatchId);
      } else if (fileType === 'figuras') {
        stats = await ingestFiguras(supabase, rows, cicloResolved!, ingestBatchId);
      } else {
        stats = await ingestAlumnos(supabase, rows, cicloResolved!, ingestBatchId);
      }
    } catch (e: any) {
      console.error('❌ Error durante ingesta:', e);
      await markError(supabase, masterId, 'INGEST_FAILED', e.message ?? String(e));
      return corsErrorResponse('Error durante la ingesta', 500, { message: e.message });
    }

    // 7) Éxito
    await supabase
      .from('master_uploads')
      .update({
        status: 'ingested',
        validation_errors: null,
        record_count: rows.length,
        ciclo_escolar: cicloResolved,
        ingest_batch_id: ingestBatchId,
        ingested_at: new Date().toISOString(),
        ingest_stats: stats,
      })
      .eq('id', masterId);

    return corsJsonResponse({
      success: true,
      data: {
        masterId,
        ingestBatchId,
        cicloEscolar: cicloResolved,
        totalRows: rows.length,
        stats,
      },
    });
  } catch (err: any) {
    console.error('❌ ingest-master fatal:', err);
    return corsErrorResponse('Error inesperado', 500, { message: err?.message });
  }
});

// ---------------------------------------------------------------------------
// Helpers generales
// ---------------------------------------------------------------------------

async function markError(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  masterId: string,
  code: string,
  message: string | undefined,
  details?: unknown,
): Promise<void> {
  await supabase
    .from('master_uploads')
    .update({
      status: 'error',
      validation_errors: [{ code, message: message ?? 'Error', details }],
    })
    .eq('id', masterId);
}

/** Intenta leer ciclo_escolar de la primera fila que lo contenga. */
function inferCiclo(rows: Record<string, unknown>[], fileType: MasterType): string | null {
  const key =
    fileType === 'alumnos' ? 'CicloEscolar'
    : fileType === 'figuras' ? 'cicloEscolar'
    : null;
  if (!key) return null;
  for (const r of rows) {
    const v = r[key];
    if (v !== null && v !== undefined && v !== '') return String(v).trim();
  }
  return null;
}

/**
 * Upsert por lotes. Usa la PK indicada por `onConflict`.
 * Devuelve el número total de filas enviadas (no siempre equivale a filas
 * afectadas, pero es la métrica suficiente para ingest_stats).
 */
async function upsertBatched(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<number> {
  if (!rows.length) return 0;
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`Upsert ${table} [${i}..${i + chunk.length}] falló: ${error.message}`);
    }
    count += chunk.length;
  }
  return count;
}

/**
 * Deduplica filas por PK compuesta (última gana). Necesario para upsert porque
 * si un mismo ID aparece varias veces en el lote, Postgres rechaza
 * "ON CONFLICT DO UPDATE command cannot affect row a second time".
 */
function dedupe<T extends Record<string, unknown>>(
  rows: T[],
  keyFields: readonly string[],
): T[] {
  const map = new Map<string, T>();
  for (const r of rows) {
    const k = keyFields.map((f) => String(r[f] ?? '')).join('|');
    map.set(k, r);
  }
  return [...map.values()];
}

/** Aplica mapRow a todas las filas y descarta las que den null. */
function mapAll(
  rows: Record<string, unknown>[],
  table: TableMap,
  extras: Record<string, unknown> = {},
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const m = mapRow(r, table, extras);
    if (m) out.push(m);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ingesta: Servicios
// ---------------------------------------------------------------------------

async function ingestServicios(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  rows: Record<string, unknown>[],
  ciclo: string,
  batchId: string,
): Promise<IngestStats> {
  const m = SERVICIOS_MAP;
  const stats: IngestStats = {};

  // Orden respetando FKs: estados → zonas → regiones → microrregiones →
  // municipios → localidades → modalidades → ccts → servicio_estadisticas.
  stats.estados         = await upsertBatched(supabase, 'estados',
                            dedupe(mapAll(rows, m.estados as TableMap), m.estados.pk), 'cve_estado');
  stats.zonas           = await upsertBatched(supabase, 'zonas',
                            dedupe(mapAll(rows, m.zonas as TableMap), m.zonas.pk), 'cve_zona');
  stats.regiones        = await upsertBatched(supabase, 'regiones',
                            dedupe(mapAll(rows, m.regiones as TableMap), m.regiones.pk), 'cve_region');
  stats.microrregiones  = await upsertBatched(supabase, 'microrregiones',
                            dedupe(mapAll(rows, m.microrregiones as TableMap), m.microrregiones.pk), 'cve_microregion');
  stats.municipios      = await upsertBatched(supabase, 'municipios',
                            dedupe(mapAll(rows, m.municipios as TableMap), m.municipios.pk), 'cve_municipio');
  stats.localidades     = await upsertBatched(supabase, 'localidades',
                            dedupe(mapAll(rows, m.localidades as TableMap), m.localidades.pk), 'cve_localidad');
  stats.modalidades     = await upsertBatched(supabase, 'modalidades',
                            dedupe(mapAll(rows, m.modalidades as TableMap), m.modalidades.pk), 'cve_modalidad');
  // CCTs del Master: se reactivan, se sella ciclo_ultima_vista y se limpia fecha_clausura.
  // Los CCTs que llegan por figuras/alumnos nunca tocan estos campos (ver ingestFiguras/Alumnos).
  const cctsRows = dedupe(
    mapAll(rows, m.ccts as TableMap, {
      activo: true,
      ciclo_ultima_vista: ciclo,
      fecha_clausura: null,
    }),
    m.ccts.pk,
  );
  stats.ccts = await upsertBatched(supabase, 'ccts', cctsRows, 'cct');

  // Clausura: todo CCT que (a) estaba activo, (b) ya había sido visto por algún Master
  // de Servicios previo (ciclo_ultima_vista IS NOT NULL) y (c) no aparece en este ciclo,
  // se marca como inactivo con fecha_clausura = ahora.
  const { data: clausurados, error: clauseErr } = await supabase
    .from('ccts')
    .update({ activo: false, fecha_clausura: new Date().toISOString() })
    .eq('activo', true)
    .not('ciclo_ultima_vista', 'is', null)
    .neq('ciclo_ultima_vista', ciclo)
    .select('cct');
  if (clauseErr) {
    throw new Error(`Marcar CCTs clausurados falló: ${clauseErr.message}`);
  }
  stats.ccts_clausurados = clausurados?.length ?? 0;

  const est = dedupe(
    mapAll(rows, m.servicio_estadisticas as TableMap, { ciclo_escolar: ciclo, ingest_batch_id: batchId }),
    m.servicio_estadisticas.pk,
  );
  stats.servicio_estadisticas = await upsertBatched(supabase, 'servicio_estadisticas', est, 'cct,ciclo_escolar');

  return stats;
}

// ---------------------------------------------------------------------------
// Ingesta: Figuras
// ---------------------------------------------------------------------------

async function ingestFiguras(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  rows: Record<string, unknown>[],
  ciclo: string,
  batchId: string,
): Promise<IngestStats> {
  const m = FIGURAS_MAP;
  const stats: IngestStats = {};

  // Catálogos primero
  stats.bancos          = await upsertBatched(supabase, 'bancos',
                            dedupe(mapAll(rows, m.bancos as TableMap), m.bancos.pk), 'cve_banco');
  stats.sedes_formacion = await upsertBatched(supabase, 'sedes_formacion',
                            dedupe(mapAll(rows, m.sedes_formacion as TableMap), m.sedes_formacion.pk), 'cv_sede');

  // Las figuras necesitan que sus CCTs ya existan; si el Master Servicios no
  // se ingestó aún, los ccts vendrán solo con la PK (sin FKs geográficas).
  // Esto permite la ingesta en cualquier orden.
  const cctsFromFig = dedupe(
    rows
      .map((r) => ({ cct: coerce(r['Clave de Centro de Trabajo'], 'string') }))
      .filter((o) => o.cct) as Record<string, unknown>[],
    ['cct'],
  );
  if (cctsFromFig.length) {
    const { error } = await supabase.from('ccts').upsert(cctsFromFig, {
      onConflict: 'cct',
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`Upsert ccts (desde figuras) falló: ${error.message}`);
  }

  const figRows = dedupe(
    mapAll(rows, m.figuras as TableMap, { ciclo_escolar: ciclo, ingest_batch_id: batchId }),
    m.figuras.pk,
  );
  stats.figuras = await upsertBatched(supabase, 'figuras', figRows, 'numero_control');

  const bajaRows = dedupe(
    mapAll(rows, m.figura_bajas as TableMap, { ciclo_escolar: ciclo, ingest_batch_id: batchId }),
    m.figura_bajas.pk,
  );
  stats.figura_bajas = await upsertBatched(supabase, 'figura_bajas', bajaRows, 'numero_control');

  return stats;
}

// ---------------------------------------------------------------------------
// Ingesta: Alumnos
// ---------------------------------------------------------------------------

async function ingestAlumnos(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  rows: Record<string, unknown>[],
  ciclo: string,
  batchId: string,
): Promise<IngestStats> {
  const m = ALUMNOS_MAP;
  const stats: IngestStats = {};

  // Asegurar que los CCTs existan
  const cctsFromAlu = dedupe(
    rows
      .map((r) => ({ cct: coerce(r['IdCentro'], 'string') }))
      .filter((o) => o.cct) as Record<string, unknown>[],
    ['cct'],
  );
  if (cctsFromAlu.length) {
    const { error } = await supabase.from('ccts').upsert(cctsFromAlu, {
      onConflict: 'cct',
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`Upsert ccts (desde alumnos) falló: ${error.message}`);
  }

  const aluRows = dedupe(
    mapAll(rows, m.alumnos as TableMap, { ciclo_escolar: ciclo, ingest_batch_id: batchId }),
    m.alumnos.pk,
  );
  stats.alumnos = await upsertBatched(supabase, 'alumnos', aluRows, 'id_alumno');

  // Tutores (fan-out 1 alumno → hasta 2 tutores)
  const tutorRows: Record<string, unknown>[] = [];
  for (const r of rows) {
    const idAlumno = coerce(r['IdAlumno'], 'int');
    if (idAlumno === null) continue;
    for (const tutor of m.tutores.fanOut.tutors) {
      const rec: Record<string, unknown> = {
        id_alumno: idAlumno,
        num_tutor: tutor.num,
        ciclo_escolar: ciclo,
        ingest_batch_id: batchId,
      };
      let hasAny = false;
      for (const [dbCol, excelCol] of Object.entries(tutor.columns)) {
        const v = r[excelCol];
        if (v !== null && v !== undefined && v !== '') hasAny = true;
        rec[dbCol] = coerce(v, 'string');
      }
      if (hasAny) tutorRows.push(rec);
    }
  }
  stats.tutores = await upsertBatched(
    supabase,
    'tutores',
    dedupe(tutorRows, ['id_alumno', 'num_tutor']),
    'id_alumno,num_tutor',
  );

  const califRows = dedupe(
    mapAll(rows, m.calificaciones as TableMap, { ciclo_escolar: ciclo, ingest_batch_id: batchId }),
    m.calificaciones.pk,
  );
  stats.calificaciones = await upsertBatched(supabase, 'calificaciones', califRows, 'id_alumno,ciclo_escolar');

  const evalRows = dedupe(
    mapAll(rows, m.evaluaciones_lectoras as TableMap, { ciclo_escolar: ciclo, ingest_batch_id: batchId }),
    m.evaluaciones_lectoras.pk,
  );
  stats.evaluaciones_lectoras = await upsertBatched(supabase, 'evaluaciones_lectoras', evalRows, 'id_alumno,ciclo_escolar');

  return stats;
}

console.log('🚀 Edge Function ingest-master iniciada');
