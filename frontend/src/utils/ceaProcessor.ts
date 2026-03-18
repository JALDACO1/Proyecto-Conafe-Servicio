/**
 * CEA Processor — Browser-side
 * ==============================
 * Procesa los archivos Master en el navegador usando SheetJS.
 * Misma lógica que la Edge Function process-cea/utils/dataProcessor.ts,
 * pero ejecutada en el browser para evitar los límites de CPU de las Edge Functions.
 */

import * as XLSX from 'xlsx';

// ============================================================================
// Tipos de datos intermedios
// ============================================================================

export interface AlumnoRow {
  microregion: string;
  genero: string;    // H o M
  programa: string;
  idCentro: string;
}

export interface AlumnosData {
  rows: AlumnoRow[];
}

export interface ServicioRow {
  microregion: string;
  modalidad: string;
  modalidadCategorizada: string;
  cct: string;
  totalAlumnos: number;
}

export interface ServiciosData {
  rows: ServicioRow[];
  cctModalidadMap: Map<string, string>;
}

export interface FiguraRow {
  microregion: string;
  figura: string;
  idFigura: string;
  nombreCompleto: string;
  activo: boolean;
}

export interface FigurasData {
  rows: FiguraRow[];
}

export type ModalidadCEA = 'Inicial' | 'Preescolar' | 'CIC' | 'PreeMig' | 'Prim' | 'Sec';

export interface CeaRow {
  Microregion: string;
  ECA: string;
  CoordinadorSeguimiento: string;
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

const MODALIDADES_CEA: ModalidadCEA[] = ['Inicial', 'Preescolar', 'CIC', 'PreeMig', 'Prim', 'Sec'];

// ============================================================================
// processMasterAlumnos
// ============================================================================

export async function processMasterAlumnos(arrayBuffer: ArrayBuffer): Promise<AlumnosData> {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

  const sheetName = workbook.SheetNames.includes('Master')
    ? 'Master'
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error('No se encontró hoja válida en Master de Alumnos');

  const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);

  const rows: AlumnoRow[] = [];
  for (const row of jsonData) {
    const microregion = normalizar(row['Microregion']);
    const genero = normalizar(row['Genero']);
    const programa = normalizar(row['Programa']);
    const idCentro = normalizar(row['IdCentro']);
    const estatus = normalizar(row['EstatusAlumno']);

    if (!microregion || !genero || !programa) continue;
    if (estatus && estatus !== 'ACTIVO' && estatus !== 'INSCRITO' && estatus !== 'REINSCRITO') continue;

    rows.push({ microregion, genero, programa, idCentro });
  }

  return { rows };
}

// ============================================================================
// processMasterServicios
// ============================================================================

export async function processMasterServicios(arrayBuffer: ArrayBuffer): Promise<ServiciosData> {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

  const sheetName = workbook.SheetNames.includes('MasterPRODET06 (2)')
    ? 'MasterPRODET06 (2)'
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error('No se encontró hoja válida en Master de Servicios');

  const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);

  const rows: ServicioRow[] = [];
  const cctModalidadMap = new Map<string, string>();

  for (const row of jsonData) {
    const microregion = normalizar(row['nomMicroregion']);
    const modalidad = normalizar(row['nomModalidad']);
    const cct = normalizar(row['cct']);
    const status = normalizar(row['StatusSUCECOM']);
    const totalAlumnos = Number(row['TOT_ALUM']) || 0;

    if (!microregion || !modalidad) continue;
    if (status && status !== 'ACTIVO') continue;

    const modalidadCategorizada = categorizarModalidad(modalidad);
    rows.push({ microregion, modalidad, modalidadCategorizada, cct, totalAlumnos });

    if (cct) {
      cctModalidadMap.set(cct, modalidadCategorizada);
    }
  }

  return { rows, cctModalidadMap };
}

// ============================================================================
// processMasterFiguras
// ============================================================================

export async function processMasterFiguras(arrayBuffer: ArrayBuffer): Promise<FigurasData> {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

  const sheetName = workbook.SheetNames.includes('Master-Figuras-Educativas')
    ? 'Master-Figuras-Educativas'
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error('No se encontró hoja válida en Master de Figuras');

  const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);

  const rows: FiguraRow[] = [];
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

    const activo = situacion === 'A' ||
      descripcionSituacion === 'ACTIVO' ||
      (!situacion && !descripcionSituacion);

    rows.push({ microregion, figura: figura || '', idFigura: idFigura || '', nombreCompleto, activo });
  }

  return { rows };
}

// ============================================================================
// generarCEA
// ============================================================================

export function generarCEA(
  alumnos: AlumnosData,
  servicios: ServiciosData,
  figuras: FigurasData,
): CeaRow[] {
  const conteoAlumnos = new Map<string, Map<string, number>>();
  const microregionesSet = new Set<string>();

  for (const alumno of alumnos.rows) {
    const modalidad = servicios.cctModalidadMap.get(alumno.idCentro)
      || categorizarPorPrograma(alumno.programa);

    const generoKey = alumno.genero === 'H' ? 'M' : 'F';
    const key = `${modalidad}_${generoKey}`;

    microregionesSet.add(alumno.microregion);

    if (!conteoAlumnos.has(alumno.microregion)) {
      conteoAlumnos.set(alumno.microregion, new Map());
    }
    const mrMap = conteoAlumnos.get(alumno.microregion)!;
    mrMap.set(key, (mrMap.get(key) || 0) + 1);
  }

  for (const s of servicios.rows) microregionesSet.add(s.microregion);
  for (const f of figuras.rows) if (f.activo) microregionesSet.add(f.microregion);

  const metasPorMr = new Map<string, number>();
  for (const s of servicios.rows) {
    metasPorMr.set(s.microregion, (metasPorMr.get(s.microregion) || 0) + s.totalAlumnos);
  }

  const ecaPorMr = new Map<string, string>();
  const coordPorMr = new Map<string, string>();

  for (const f of figuras.rows) {
    if (!f.activo) continue;
    const id = f.idFigura.toUpperCase();
    const fig = f.figura.toLowerCase();

    if (id === 'ECA' || fig.includes('acompañamiento')) {
      if (!ecaPorMr.has(f.microregion)) ecaPorMr.set(f.microregion, f.nombreCompleto);
    }
    if (id === 'CS' || id === 'CT' || fig.includes('seguimiento') || fig.includes('capacitador')) {
      if (!coordPorMr.has(f.microregion)) coordPorMr.set(f.microregion, f.nombreCompleto);
    }
  }

  for (const f of figuras.rows) {
    if (!f.activo) continue;
    if (f.idFigura.toUpperCase() === 'EC' || f.figura.toLowerCase().includes('educador comunitario')) {
      if (!ecaPorMr.has(f.microregion)) ecaPorMr.set(f.microregion, f.nombreCompleto);
    }
  }

  const ceaData: CeaRow[] = [];
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

    for (const mod of MODALIDADES_CEA) {
      registro.Total_M += (conteos.get(`${mod}_M`) || 0);
      registro.Total_F += (conteos.get(`${mod}_F`) || 0);
    }
    registro.Total_Gen = registro.Total_M + registro.Total_F;
    registro.Faltantes = registro.Metas - registro.Total_Gen;

    ceaData.push(registro);
  }

  return ceaData;
}

// ============================================================================
// Helpers
// ============================================================================

function normalizar(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  return String(val).trim().toUpperCase();
}

function categorizarModalidad(modalidad: string): ModalidadCEA {
  const m = modalidad.toLowerCase();
  if (m.includes('centro infantil') || m.includes('cic')) return 'CIC';
  if (m.includes('inicial')) return 'Inicial';
  if (m.includes('preescolar') && m.includes('migrante')) return 'PreeMig';
  if (m.includes('preescolar')) return 'Preescolar';
  if (m.includes('primaria')) return 'Prim';
  if (m.includes('secundaria')) return 'Sec';
  return 'Prim';
}

function categorizarPorPrograma(programa: string): ModalidadCEA {
  const p = programa.toLowerCase();
  if (p.includes('inicial')) return 'Inicial';
  if (p.includes('preescolar') && p.includes('migrante')) return 'PreeMig';
  if (p.includes('preescolar')) return 'Preescolar';
  if (p.includes('primaria')) return 'Prim';
  if (p.includes('secundaria')) return 'Sec';
  return 'Prim';
}
