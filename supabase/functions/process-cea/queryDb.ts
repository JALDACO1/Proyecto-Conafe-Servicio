/**
 * queryDb.ts
 * ===========
 * Lectura de datos para la generación del CEA. Toda la lógica de filtrado por
 * "alumnos.baja IS NULL" y "ccts.activo = true" vive aquí, junto con las
 * agregaciones por microrregión que usa la hoja CONCENTRADO.
 *
 * El estilo es deliberadamente plano (sin clases): cada función toma el
 * cliente y el ciclo, y devuelve un objeto bien tipado.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CctRow {
  cct: string;
  nombre_cct: string | null;
  cve_localidad: number | null;
  cve_microregion: number | null;
  cve_modalidad: number | null;
  activo: boolean;
  ciclo_ultima_vista: string | null;
  // Joins
  microrregion_nombre: string | null;
  region_nombre: string | null;
  localidad_nombre: string | null;
  municipio_nombre: string | null;
  modalidad_nombre: string | null;
  grado_marginacion: string | null;
  pobtot: number | null;
  // Estadísticas del ciclo
  estad: ServicioEstadistica | null;
  // Externos / manuales
  ext: CctDatosExternos | null;
  infra: CctInfraestructura | null;
}

export interface ServicioEstadistica {
  cct: string;
  ciclo_escolar: string;
  instructores_h: number | null;
  instructores_m: number | null;
  no_instructores_total: number | null;
  n1_h_ciclo: number | null;
  n2_h_ciclo: number | null;
  n3_h_ciclo: number | null;
  n1_m_ciclo: number | null;
  n2_m_ciclo: number | null;
  n3_m_ciclo: number | null;
  alum_h: number | null;
  alum_m: number | null;
  tot_alum: number | null;
  ninos: number | null;
  ninas: number | null;
  madres: number | null;
  padres: number | null;
  embarazadas: number | null;
  cuidadores: number | null;
}

export interface CctDatosExternos {
  cct: string;
  clave_inegi: string | null;
  cp: string | null;
  latitud: number | null;
  longitud: number | null;
  porcentaje_analfabetismo: number | null;
  identificador_inmueble: string | null;
  ec_polivalente: boolean | null;
  programas_atendidos: string | null;
  apoyo_desayunos_escolares: string | null;
  ec_meta: number | null;
}

export interface CctInfraestructura {
  cct: string;
  tipo_aula: string | null;
  documento_probatorio: string | null;
  tipo_material: string | null;
  banos: string | null;
  areas_deportivas: string | null;
  comedores: string | null;
  cerco: string | null;
  energia_electrica: string | null;
  agua: string | null;
  drenaje: string | null;
  senal_telefonica: string | null;
  internet_comunidad: string | null;
  internet_escuela: string | null;
  proveedor_internet: string | null;
  apoyo_leen: string | null;
}

export interface FiguraRow {
  numero_control: string;
  curp: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  nombre: string | null;
  edad: number | null;
  genero: string | null;
  fecha_nacimiento: string | null;
  telefono: string | null;
  correo: string | null;
  id_figura: string | null;
  figura: string | null;
  generacion: number | null;
  fecha_ingreso: string | null;
  anios_servicio_conafe: number | null;
  situacion_actual: string | null;
  cct: string | null;
  // Joins
  microrregion_nombre: string | null;
  cct_nombre: string | null;
  modalidad_nombre: string | null;
  // Manual / SIIINAFE
  manuales: FiguraManuales | null;
  siiinafe: FiguraSiiinafe | null;
}

export interface FiguraManuales {
  numero_control: string;
  eca_responsable: string | null;
  coordinador_seguimiento: string | null;
  estado_civil: string | null;
  es_madre: boolean | null;
  colonia_localidad: string | null;
  calle: string | null;
  no_ext: string | null;
  no_int: string | null;
  cp: string | null;
  es_de_la_comunidad: boolean | null;
  pernocta: boolean | null;
  cercano_comunidad: boolean | null;
  nivel_academico: string | null;
  especialidad: string | null;
  institucion: string | null;
  situacion_academica: string | null;
}

export interface FiguraSiiinafe {
  numero_control: string;
  documentos: Record<string, unknown>;
  total_documentacion: number | null;
  observaciones: string | null;
}

export interface FiguraBajaRow extends FiguraRow {
  fecha_baja: string | null;
  causa_desercion: string | null;
  causa_baja: string | null;
  baja_observaciones: string | null;
}

export interface AlumnoRow {
  id_alumno: number;
  curp: string | null;
  nombre: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  genero: string | null;
  fecha_nacimiento: string | null;
  edad_anios_inicio_ciclo: number | null;
  edad_meses_inicio_ciclo: number | null;
  nivel: string | null;
  id_programa: number | null;
  programa: string | null;
  cct: string | null;
  // Estos llegan via filtro: SOLO alumnos sin baja se incluyen
}

// ---------------------------------------------------------------------------
// Helpers de paginación (Supabase limita a 1000 filas por defecto)
// ---------------------------------------------------------------------------

const PAGE_SIZE = 1000;

async function selectAll<T>(
  query: ReturnType<SupabaseClient['from']>['select'] extends (...args: any) => infer R ? R : never,
): Promise<T[]> {
  // Las consultas con joins anidados pueden devolver mucho. Iteramos.
  const acc: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await (query as any).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    acc.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Trae todos los CCT activos del ciclo, con sus joins de catálogo y sus
 * estadísticas del ciclo. Excluye los marcados activo=false (clausura).
 */
export async function fetchCctsActivos(
  supabase: SupabaseClient,
  ciclo: string,
): Promise<CctRow[]> {
  const { data, error } = await supabase
    .from('ccts')
    .select(`
      cct,
      nombre_cct,
      cve_localidad,
      cve_microregion,
      cve_modalidad,
      activo,
      ciclo_ultima_vista,
      microrregiones:cve_microregion (
        nom_microregion,
        regiones:cve_region ( nom_region )
      ),
      localidades:cve_localidad (
        nom_localidad,
        grado_marginacion,
        pobtot,
        municipios:cve_municipio ( nom_municipio )
      ),
      modalidades:cve_modalidad ( nom_modalidad )
    `)
    .eq('activo', true)
    .order('cve_microregion', { ascending: true })
    .order('cct', { ascending: true });

  if (error) throw new Error(`fetchCctsActivos: ${error.message}`);

  const ccts = (data ?? []).map((row: any): CctRow => ({
    cct: row.cct,
    nombre_cct: row.nombre_cct,
    cve_localidad: row.cve_localidad,
    cve_microregion: row.cve_microregion,
    cve_modalidad: row.cve_modalidad,
    activo: row.activo,
    ciclo_ultima_vista: row.ciclo_ultima_vista,
    microrregion_nombre: row.microrregiones?.nom_microregion ?? null,
    region_nombre: row.microrregiones?.regiones?.nom_region ?? null,
    localidad_nombre: row.localidades?.nom_localidad ?? null,
    municipio_nombre: row.localidades?.municipios?.nom_municipio ?? null,
    modalidad_nombre: row.modalidades?.nom_modalidad ?? null,
    grado_marginacion: row.localidades?.grado_marginacion ?? null,
    pobtot: row.localidades?.pobtot ?? null,
    estad: null,
    ext: null,
    infra: null,
  }));

  // Cargar estadísticas del ciclo en bloque y mergear por cct
  const cctKeys = ccts.map((c) => c.cct);
  const [estads, exts, infras] = await Promise.all([
    fetchByCctsBatched<ServicioEstadistica>(
      supabase, 'servicio_estadisticas', cctKeys, ciclo,
    ),
    fetchByCctsBatched<CctDatosExternos>(
      supabase, 'cct_datos_externos', cctKeys, ciclo,
    ),
    fetchByCctsBatched<CctInfraestructura>(
      supabase, 'cct_infraestructura', cctKeys, ciclo,
    ),
  ]);

  const estadByCct = new Map(estads.map((e) => [e.cct, e]));
  const extByCct = new Map(exts.map((e) => [e.cct, e]));
  const infraByCct = new Map(infras.map((e) => [e.cct, e]));

  for (const c of ccts) {
    c.estad = estadByCct.get(c.cct) ?? null;
    c.ext = extByCct.get(c.cct) ?? null;
    c.infra = infraByCct.get(c.cct) ?? null;
  }

  return ccts;
}

/**
 * Trae filas de una tabla filtrando por (cct IN [...], ciclo_escolar=ciclo)
 * en bloques para no exceder el límite del IN.
 */
async function fetchByCctsBatched<T>(
  supabase: SupabaseClient,
  table: string,
  ccts: string[],
  ciclo: string,
): Promise<T[]> {
  if (ccts.length === 0) return [];
  const BATCH = 200;
  const acc: T[] = [];
  for (let i = 0; i < ccts.length; i += BATCH) {
    const slice = ccts.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .in('cct', slice)
      .eq('ciclo_escolar', ciclo);
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    if (data) acc.push(...(data as T[]));
  }
  return acc;
}

/**
 * Figuras ACTIVAS del ciclo (excluye las que tienen baja). Para Estadística
 * Figuras y Atención.
 */
export async function fetchFigurasActivas(
  supabase: SupabaseClient,
  ciclo: string,
): Promise<FiguraRow[]> {
  // 1) Trae todas las bajas del ciclo para excluirlas
  const { data: bajas, error: bajasErr } = await supabase
    .from('figura_bajas')
    .select('numero_control')
    .eq('ciclo_escolar', ciclo);
  if (bajasErr) throw new Error(`fetch bajas: ${bajasErr.message}`);
  const bajasSet = new Set((bajas ?? []).map((b: any) => b.numero_control));

  // 2) Figuras del ciclo + joins
  const { data, error } = await supabase
    .from('figuras')
    .select(`
      *,
      ccts:cct (
        nombre_cct,
        cve_microregion,
        microrregiones:cve_microregion ( nom_microregion ),
        modalidades:cve_modalidad ( nom_modalidad )
      )
    `)
    .eq('ciclo_escolar', ciclo);
  if (error) throw new Error(`fetch figuras: ${error.message}`);

  const figuras = (data ?? [])
    .filter((f: any) => !bajasSet.has(f.numero_control))
    .map((f: any) => mapFigura(f));

  await attachFiguraExtras(supabase, figuras);
  return figuras;
}

/**
 * Figuras DADAS DE BAJA del ciclo. Para hoja "Bajas de Figuras".
 */
export async function fetchFigurasBajas(
  supabase: SupabaseClient,
  ciclo: string,
): Promise<FiguraBajaRow[]> {
  // INNER join figuras×figura_bajas filtrado por ciclo
  const { data, error } = await supabase
    .from('figura_bajas')
    .select(`
      numero_control,
      fecha_baja,
      causa_desercion,
      causa_baja,
      observaciones,
      figuras:numero_control (
        *,
        ccts:cct (
          nombre_cct,
          cve_microregion,
          microrregiones:cve_microregion ( nom_microregion ),
          modalidades:cve_modalidad ( nom_modalidad )
        )
      )
    `)
    .eq('ciclo_escolar', ciclo);
  if (error) throw new Error(`fetch figura_bajas: ${error.message}`);

  const bajas: FiguraBajaRow[] = (data ?? [])
    .filter((row: any) => row.figuras)
    .map((row: any) => {
      const base = mapFigura(row.figuras);
      return {
        ...base,
        fecha_baja: row.fecha_baja,
        causa_desercion: row.causa_desercion,
        causa_baja: row.causa_baja,
        baja_observaciones: row.observaciones,
      };
    });

  await attachFiguraExtras(supabase, bajas);
  return bajas;
}

function mapFigura(f: any): FiguraRow {
  return {
    numero_control: f.numero_control,
    curp: f.curp,
    apellido_paterno: f.apellido_paterno,
    apellido_materno: f.apellido_materno,
    nombre: f.nombre,
    edad: f.edad,
    genero: f.genero,
    fecha_nacimiento: f.fecha_nacimiento,
    telefono: f.telefono,
    correo: f.correo,
    id_figura: f.id_figura,
    figura: f.figura,
    generacion: f.generacion,
    fecha_ingreso: f.fecha_ingreso,
    anios_servicio_conafe: f.anios_servicio_conafe,
    situacion_actual: f.situacion_actual,
    cct: f.cct,
    cct_nombre: f.ccts?.nombre_cct ?? null,
    microrregion_nombre: f.ccts?.microrregiones?.nom_microregion ?? null,
    modalidad_nombre: f.ccts?.modalidades?.nom_modalidad ?? null,
    manuales: null,
    siiinafe: null,
  };
}

async function attachFiguraExtras(
  supabase: SupabaseClient,
  figuras: FiguraRow[],
) {
  if (figuras.length === 0) return;
  const ids = figuras.map((f) => f.numero_control);
  const BATCH = 200;
  const manualesAll: FiguraManuales[] = [];
  const siiinafeAll: FiguraSiiinafe[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const [{ data: man }, { data: sii }] = await Promise.all([
      supabase.from('figura_datos_manuales').select('*').in('numero_control', slice),
      supabase.from('figura_siiinafe').select('*').in('numero_control', slice),
    ]);
    if (man) manualesAll.push(...(man as FiguraManuales[]));
    if (sii) siiinafeAll.push(...(sii as FiguraSiiinafe[]));
  }
  const manMap = new Map(manualesAll.map((m) => [m.numero_control, m]));
  const siiMap = new Map(siiinafeAll.map((s) => [s.numero_control, s]));
  for (const f of figuras) {
    f.manuales = manMap.get(f.numero_control) ?? null;
    f.siiinafe = siiMap.get(f.numero_control) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Agregación de alumnos por CCT (para hoja "Estadística de Servicios" y para
// el bloque 3 del CONCENTRADO). Filtra alumnos.baja IS NULL.
// ---------------------------------------------------------------------------

export interface AlumnosAggCct {
  cct: string;
  // Inicial: rangos de edad x género (basado en edad_anios_inicio_ciclo)
  inicial_ninas_0_2: number;
  inicial_ninos_0_2: number;
  inicial_ninas_2_3: number;
  inicial_ninos_2_3: number;
  inicial_ninas_3_4: number;
  inicial_ninos_3_4: number;
  embarazadas: number;
  cuidadores: number;
  padres_inicial: number;
  madres_inicial: number;
  // Preescolar
  pre_1_h: number; pre_1_m: number;
  pre_2_h: number; pre_2_m: number;
  pre_3_h: number; pre_3_m: number;
  // Primaria
  pri_1_h: number; pri_1_m: number;
  pri_2_h: number; pri_2_m: number;
  pri_3_h: number; pri_3_m: number;
  pri_4_h: number; pri_4_m: number;
  pri_5_h: number; pri_5_m: number;
  pri_6_h: number; pri_6_m: number;
  // Secundaria
  sec_1_h: number; sec_1_m: number;
  sec_2_h: number; sec_2_m: number;
  sec_3_h: number; sec_3_m: number;
}

const EMPTY_AGG = (): AlumnosAggCct => ({
  cct: '',
  inicial_ninas_0_2: 0, inicial_ninos_0_2: 0,
  inicial_ninas_2_3: 0, inicial_ninos_2_3: 0,
  inicial_ninas_3_4: 0, inicial_ninos_3_4: 0,
  embarazadas: 0, cuidadores: 0, padres_inicial: 0, madres_inicial: 0,
  pre_1_h: 0, pre_1_m: 0, pre_2_h: 0, pre_2_m: 0, pre_3_h: 0, pre_3_m: 0,
  pri_1_h: 0, pri_1_m: 0, pri_2_h: 0, pri_2_m: 0, pri_3_h: 0, pri_3_m: 0,
  pri_4_h: 0, pri_4_m: 0, pri_5_h: 0, pri_5_m: 0, pri_6_h: 0, pri_6_m: 0,
  sec_1_h: 0, sec_1_m: 0, sec_2_h: 0, sec_2_m: 0, sec_3_h: 0, sec_3_m: 0,
});

/**
 * Agrega alumnos vivos (baja IS NULL) por CCT. Devuelve un Map cct→AlumnosAggCct.
 */
export async function aggAlumnosPorCct(
  supabase: SupabaseClient,
  ciclo: string,
): Promise<Map<string, AlumnosAggCct>> {
  const map = new Map<string, AlumnosAggCct>();

  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('alumnos')
      .select('cct, genero, nivel, edad_anios_inicio_ciclo, edad_meses_inicio_ciclo, programa')
      .eq('ciclo_escolar', ciclo)
      .is('baja', null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`agg alumnos: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const a of data as any[]) {
      if (!a.cct) continue;
      let agg = map.get(a.cct);
      if (!agg) { agg = EMPTY_AGG(); agg.cct = a.cct; map.set(a.cct, agg); }
      assignAlumnoToBucket(agg, a);
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return map;
}

function assignAlumnoToBucket(agg: AlumnosAggCct, a: any) {
  const nivel = (a.nivel ?? '').toString().toUpperCase();
  const genero = (a.genero ?? '').toString().toUpperCase();
  // En CONAFE: H = Hombre, M = Mujer (convención del Master de Alumnos).
  const isHombre = ['H', 'HOMBRE', 'MASCULINO'].includes(genero);
  const isMujer  = ['M', 'F', 'MUJER', 'FEMENINO'].includes(genero);

  if (nivel.includes('INICIAL')) {
    const edadAnios = a.edad_anios_inicio_ciclo ?? 0;
    if (edadAnios < 2) {
      if (isMujer) agg.inicial_ninas_0_2++; else if (isHombre) agg.inicial_ninos_0_2++;
    } else if (edadAnios < 3) {
      if (isMujer) agg.inicial_ninas_2_3++; else if (isHombre) agg.inicial_ninos_2_3++;
    } else {
      if (isMujer) agg.inicial_ninas_3_4++; else if (isHombre) agg.inicial_ninos_3_4++;
    }
    return;
  }

  if (nivel.includes('PREESCOLAR')) {
    const grado = parseGrado(a.programa);
    if (grado === 1) { if (isHombre) agg.pre_1_h++; else if (isMujer) agg.pre_1_m++; }
    if (grado === 2) { if (isHombre) agg.pre_2_h++; else if (isMujer) agg.pre_2_m++; }
    if (grado === 3) { if (isHombre) agg.pre_3_h++; else if (isMujer) agg.pre_3_m++; }
    return;
  }

  if (nivel.includes('PRIMARIA')) {
    const grado = parseGrado(a.programa);
    const buckets = [
      ['pri_1_h', 'pri_1_m'], ['pri_2_h', 'pri_2_m'], ['pri_3_h', 'pri_3_m'],
      ['pri_4_h', 'pri_4_m'], ['pri_5_h', 'pri_5_m'], ['pri_6_h', 'pri_6_m'],
    ] as const;
    if (grado >= 1 && grado <= 6) {
      const [hKey, mKey] = buckets[grado - 1];
      if (isHombre) (agg as any)[hKey]++;
      else if (isMujer) (agg as any)[mKey]++;
    }
    return;
  }

  if (nivel.includes('SECUNDARIA')) {
    const grado = parseGrado(a.programa);
    if (grado === 1) { if (isHombre) agg.sec_1_h++; else if (isMujer) agg.sec_1_m++; }
    if (grado === 2) { if (isHombre) agg.sec_2_h++; else if (isMujer) agg.sec_2_m++; }
    if (grado === 3) { if (isHombre) agg.sec_3_h++; else if (isMujer) agg.sec_3_m++; }
    return;
  }

  // Otros: ignorar; el manual del CEA pone el resto bajo "Inicial" agregando padres/madres
}

/** Extrae el grado (1-6) de la cadena de programa (ej. "Primaria 3°", "1ER GRADO"). */
function parseGrado(programa: unknown): number {
  if (!programa) return 0;
  const s = String(programa).toUpperCase();
  const m = s.match(/(\d)/);
  return m ? parseInt(m[1], 10) : 0;
}
