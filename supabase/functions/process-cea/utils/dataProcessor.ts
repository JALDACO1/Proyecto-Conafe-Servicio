/**
 * Data Processor — JavaScript Puro
 * ==================================
 * Procesamiento de datos para generar archivos CEA.
 * Usa SheetJS para leer Excel y Maps/Arrays nativos para agrupar datos.
 *
 * Reemplaza la versión anterior basada en Danfo.js que no funcionaba en Deno.
 */

import * as XLSX from 'xlsx';
import type {
  AlumnosData,
  ServiciosData,
  FigurasData,
  CeaRow,
  ModalidadCEA,
} from '../../_shared/types.ts';
import { MODALIDADES_CEA } from '../../_shared/types.ts';

// ============================================================================
// FUNCIÓN: processMasterAlumnos
// ============================================================================
/**
 * Lee y procesa el archivo Master de Alumnos.
 * Extrae microrregión, género, programa e IdCentro de cada alumno activo.
 */
export async function processMasterAlumnos(
  arrayBuffer: ArrayBuffer
): Promise<AlumnosData> {
  console.log('📖 Leyendo Master de Alumnos...');
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

  // Intentar hoja "Master", si no existe usar la primera hoja
  const sheetName = workbook.SheetNames.includes('Master')
    ? 'Master'
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error('No se encontró hoja válida en Master de Alumnos');

  const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);
  console.log(`✅ Master de Alumnos leído: ${jsonData.length} registros (hoja: ${sheetName})`);

  const rows = [];
  for (const row of jsonData) {
    const microregion = normalizar(row['Microregion']);
    const genero = normalizar(row['Genero']);
    const programa = normalizar(row['Programa']);
    const idCentro = normalizar(row['IdCentro']);
    const estatus = normalizar(row['EstatusAlumno']);

    // Saltar filas sin datos clave
    if (!microregion || !genero || !programa) continue;

    // Filtrar solo alumnos activos o sin estatus (incluir por defecto)
    if (estatus && estatus !== 'ACTIVO' && estatus !== 'INSCRITO' && estatus !== 'REINSCRITO') continue;

    rows.push({ microregion, genero, programa, idCentro });
  }

  console.log(`✅ Alumnos válidos: ${rows.length}`);
  return { rows };
}

// ============================================================================
// FUNCIÓN: processMasterServicios
// ============================================================================
/**
 * Lee y procesa el archivo Master de Servicios.
 * Retorna filas de servicios activos y un Map de CCT → modalidad categorizada.
 */
export async function processMasterServicios(
  arrayBuffer: ArrayBuffer
): Promise<ServiciosData> {
  console.log('📖 Leyendo Master de Servicios...');
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

  const sheetName = workbook.SheetNames.includes('MasterPRODET06 (2)')
    ? 'MasterPRODET06 (2)'
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error('No se encontró hoja válida en Master de Servicios');

  const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);
  console.log(`✅ Master de Servicios leído: ${jsonData.length} registros (hoja: ${sheetName})`);

  const rows = [];
  const cctModalidadMap = new Map<string, string>();

  for (const row of jsonData) {
    const microregion = normalizar(row['nomMicroregion']);
    const modalidad = normalizar(row['nomModalidad']);
    const cct = normalizar(row['cct']);
    const status = normalizar(row['StatusSUCECOM']);
    const totalAlumnos = Number(row['TOT_ALUM']) || 0;

    if (!microregion || !modalidad) continue;

    // Filtrar solo servicios activos
    if (status && status !== 'ACTIVO') continue;

    const modalidadCategorizada = categorizarModalidad(modalidad);

    rows.push({ microregion, modalidad, modalidadCategorizada, cct, totalAlumnos });

    // Construir mapa CCT → modalidad categorizada
    if (cct) {
      cctModalidadMap.set(cct, modalidadCategorizada);
    }
  }

  console.log(`✅ Servicios activos: ${rows.length}, CCTs mapeados: ${cctModalidadMap.size}`);
  return { rows, cctModalidadMap };
}

// ============================================================================
// FUNCIÓN: processMasterFiguras
// ============================================================================
/**
 * Lee y procesa el archivo Master de Figuras Educativas.
 * Extrae figuras activas con su microrregión, tipo y nombre completo.
 */
export async function processMasterFiguras(
  arrayBuffer: ArrayBuffer
): Promise<FigurasData> {
  console.log('📖 Leyendo Master de Figuras...');
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

  const sheetName = workbook.SheetNames.includes('Master-Figuras-Educativas')
    ? 'Master-Figuras-Educativas'
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error('No se encontró hoja válida en Master de Figuras');

  const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);
  console.log(`✅ Master de Figuras leído: ${jsonData.length} registros (hoja: ${sheetName})`);

  const rows = [];

  for (const row of jsonData) {
    const microregion = normalizar(row['Microregion de servicio']);
    const figura = normalizar(row['Figura']);
    const idFigura = normalizar(row['idFigura']);
    const situacion = normalizar(row['situacionActual']);
    const descripcionSituacion = normalizar(row['Descripcion_Situacion_Actual']);

    const paterno = String(row['apellidoPaterno'] || '').trim();
    const materno = String(row['apellidoMaterno'] || '').trim();
    const nombre = String(row['nombre'] || '').trim();
    const nombreCompleto = `${paterno} ${materno} ${nombre}`.trim();

    if (!microregion || !nombreCompleto) continue;

    // Determinar si está activo
    const activo = situacion === 'A' ||
      descripcionSituacion === 'ACTIVO' ||
      (!situacion && !descripcionSituacion);

    rows.push({
      microregion,
      figura: figura || '',
      idFigura: idFigura || '',
      nombreCompleto,
      activo,
    });
  }

  console.log(`✅ Figuras totales: ${rows.length}, activas: ${rows.filter(r => r.activo).length}`);
  return { rows };
}

// ============================================================================
// FUNCIÓN: categorizarModalidad
// ============================================================================
/**
 * Categoriza la modalidad de servicio en una de las 6 categorías del CEA.
 *
 * Reglas (basadas en nomModalidad del Master de Servicios):
 * - "inicial"                          → Inicial
 * - "centro infantil" o "cic"          → CIC
 * - "preescolar" + "migrante"          → PreeMig
 * - "preescolar"                       → Preescolar
 * - "primaria"                         → Prim
 * - "secundaria"                       → Sec
 */
export function categorizarModalidad(modalidad: string): ModalidadCEA {
  const m = modalidad.toLowerCase();

  if (m.includes('centro infantil') || m.includes('cic')) return 'CIC';
  if (m.includes('inicial')) return 'Inicial';
  if (m.includes('preescolar') && m.includes('migrante')) return 'PreeMig';
  if (m.includes('preescolar')) return 'Preescolar';
  if (m.includes('primaria')) return 'Prim';
  if (m.includes('secundaria')) return 'Sec';

  // Fallback: intentar mapear por programa
  return 'Prim'; // valor por defecto si no coincide
}

// ============================================================================
// FUNCIÓN: categorizarPorPrograma
// ============================================================================
/**
 * Categoriza el programa educativo del alumno.
 * Se usa como fallback cuando el CCT del alumno no está en el mapa de servicios.
 */
export function categorizarPorPrograma(programa: string): ModalidadCEA {
  const p = programa.toLowerCase();

  if (p.includes('inicial')) return 'Inicial';
  if (p.includes('preescolar') && p.includes('migrante')) return 'PreeMig';
  if (p.includes('preescolar')) return 'Preescolar';
  if (p.includes('primaria')) return 'Prim';
  if (p.includes('secundaria')) return 'Sec';

  return 'Prim'; // fallback
}

// ============================================================================
// FUNCIÓN: generarCEA
// ============================================================================
/**
 * Fusiona datos de alumnos, servicios y figuras para generar el CONCENTRADO.
 * Esta es la función principal del sistema.
 *
 * Flujo:
 * 1. Clasifica cada alumno por microrregión + modalidad + género
 * 2. Agrupa servicios por microrregión para calcular Metas
 * 3. Busca ECA y Coordinador por microrregión desde figuras
 * 4. Genera un registro CEA por microrregión
 *
 * @returns Array de CeaRow (objetos con propiedades nombradas)
 */
export function generarCEA(
  alumnos: AlumnosData,
  servicios: ServiciosData,
  figuras: FigurasData,
): CeaRow[] {
  console.log('🔄 Generando CONCENTRADO CEA...');

  // ---- 1. Clasificar alumnos por microrregión, modalidad y género ----
  // Estructura: Map<microregion, Map<"Modalidad_Genero", count>>
  const conteoAlumnos = new Map<string, Map<string, number>>();
  const microregionesSet = new Set<string>();

  for (const alumno of alumnos.rows) {
    // Determinar modalidad: preferir mapa de CCT, fallback a programa
    const modalidad = servicios.cctModalidadMap.get(alumno.idCentro)
      || categorizarPorPrograma(alumno.programa);

    // Convertir género: H → M (masculino), M → F (femenino)
    const generoKey = alumno.genero === 'H' ? 'M' : 'F';
    const key = `${modalidad}_${generoKey}`;

    microregionesSet.add(alumno.microregion);

    if (!conteoAlumnos.has(alumno.microregion)) {
      conteoAlumnos.set(alumno.microregion, new Map());
    }
    const mrMap = conteoAlumnos.get(alumno.microregion)!;
    mrMap.set(key, (mrMap.get(key) || 0) + 1);
  }

  // Agregar microrregiones de servicios y figuras
  for (const s of servicios.rows) microregionesSet.add(s.microregion);
  for (const f of figuras.rows) if (f.activo) microregionesSet.add(f.microregion);

  // ---- 2. Calcular Metas por microrregión (suma de TOT_ALUM de servicios) ----
  const metasPorMr = new Map<string, number>();
  for (const s of servicios.rows) {
    metasPorMr.set(s.microregion, (metasPorMr.get(s.microregion) || 0) + s.totalAlumnos);
  }

  // ---- 3. Buscar ECA y Coordinador por microrregión ----
  const ecaPorMr = new Map<string, string>();
  const coordPorMr = new Map<string, string>();

  // Primero buscar figuras con roles específicos (ECA, CS/CT)
  for (const f of figuras.rows) {
    if (!f.activo) continue;
    const id = f.idFigura.toUpperCase();
    const fig = f.figura.toLowerCase();

    // Identificar ECA
    if (id === 'ECA' || fig.includes('acompañamiento')) {
      if (!ecaPorMr.has(f.microregion)) {
        ecaPorMr.set(f.microregion, f.nombreCompleto);
      }
    }

    // Identificar Coordinador de Seguimiento
    if (id === 'CS' || id === 'CT' || fig.includes('seguimiento') || fig.includes('capacitador')) {
      if (!coordPorMr.has(f.microregion)) {
        coordPorMr.set(f.microregion, f.nombreCompleto);
      }
    }
  }

  // Si no se encontraron ECA específicos, usar el primer EC activo por microrregión
  for (const f of figuras.rows) {
    if (!f.activo) continue;
    if (f.idFigura.toUpperCase() === 'EC' || f.figura.toLowerCase().includes('educador comunitario')) {
      if (!ecaPorMr.has(f.microregion)) {
        ecaPorMr.set(f.microregion, f.nombreCompleto);
      }
    }
  }

  // ---- 4. Generar filas del CONCENTRADO ----
  const ceaData: CeaRow[] = [];

  // Ordenar microrregiones alfabéticamente
  const microregiones = Array.from(microregionesSet).sort();

  for (const mr of microregiones) {
    const conteos = conteoAlumnos.get(mr) || new Map<string, number>();

    const registro: CeaRow = {
      Microregion: mr,
      ECA: ecaPorMr.get(mr) || '',
      CoordinadorSeguimiento: coordPorMr.get(mr) || '',
      Inicial_M: conteos.get('Inicial_M') || 0,
      Inicial_F: conteos.get('Inicial_F') || 0,
      Preescolar_M: conteos.get('Preescolar_M') || 0,
      Preescolar_F: conteos.get('Preescolar_F') || 0,
      CIC_M: conteos.get('CIC_M') || 0,
      CIC_F: conteos.get('CIC_F') || 0,
      PreeMig_M: conteos.get('PreeMig_M') || 0,
      PreeMig_F: conteos.get('PreeMig_F') || 0,
      Prim_M: conteos.get('Prim_M') || 0,
      Prim_F: conteos.get('Prim_F') || 0,
      Sec_M: conteos.get('Sec_M') || 0,
      Sec_F: conteos.get('Sec_F') || 0,
      Total_M: 0,
      Total_F: 0,
      Total_Gen: 0,
      Metas: metasPorMr.get(mr) || 0,
      Faltantes: 0,
    };

    // Calcular totales
    for (const mod of MODALIDADES_CEA) {
      registro.Total_M += (conteos.get(`${mod}_M`) || 0);
      registro.Total_F += (conteos.get(`${mod}_F`) || 0);
    }
    registro.Total_Gen = registro.Total_M + registro.Total_F;
    registro.Faltantes = registro.Metas - registro.Total_Gen;

    ceaData.push(registro);
  }

  console.log(`✅ CONCENTRADO generado: ${ceaData.length} microrregiones`);
  return ceaData;
}

// ============================================================================
// Helpers
// ============================================================================

/** Normaliza un valor: convierte a string, trim, uppercase */
function normalizar(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  return String(val).trim().toUpperCase();
}

console.log('📦 Data Processor cargado (JavaScript puro)');
