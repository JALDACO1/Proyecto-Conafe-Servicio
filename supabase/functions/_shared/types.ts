/**
 * Tipos Compartidos para Edge Functions
 * ======================================
 * Define interfaces y tipos usados por múltiples Edge Functions
 */

// ============================================================================
// Tipos para archivos Master
// ============================================================================

export type MasterFileType = 'alumnos' | 'servicios' | 'figuras' | 'telefonia';
export type MasterUploadStatus = 'uploaded' | 'validating' | 'validated' | 'error';
export type CeaProcessingStatus = 'processing' | 'completed' | 'failed';

// ============================================================================
// Interfaces para datos procesados
// ============================================================================

/** Fila de alumno extraída del Master de Alumnos */
export interface AlumnoRow {
  microregion: string;
  genero: string;       // H o M
  programa: string;     // EDUCACIÓN INICIAL CONAFE, PREESCOLAR COMUNITARIO, etc.
  idCentro: string;     // CCT del centro (ej. 06KJN0190S)
}

/** Resultado de procesar Master de Alumnos */
export interface AlumnosData {
  rows: AlumnoRow[];
}

/** Fila de servicio extraída del Master de Servicios */
export interface ServicioRow {
  microregion: string;
  modalidad: string;
  modalidadCategorizada: string;  // Inicial, Preescolar, CIC, PreeMig, Prim, Sec
  cct: string;
  totalAlumnos: number;
}

/** Resultado de procesar Master de Servicios */
export interface ServiciosData {
  rows: ServicioRow[];
  cctModalidadMap: Map<string, string>;  // cct → modalidadCategorizada
}

/** Fila de figura extraída del Master de Figuras */
export interface FiguraRow {
  microregion: string;
  figura: string;       // Texto descriptivo
  idFigura: string;     // EC, ECA, CT, etc.
  nombreCompleto: string;
  activo: boolean;
}

/** Resultado de procesar Master de Figuras */
export interface FigurasData {
  rows: FiguraRow[];
}

/** Datos procesados de Telefonía (no se usa en CONCENTRADO) */
export interface TelefoniaData {
  [key: string]: any;
}

// ============================================================================
// Categorías del CEA
// ============================================================================

/** Categorías de modalidad para el CONCENTRADO */
export type ModalidadCEA = 'Inicial' | 'Preescolar' | 'CIC' | 'PreeMig' | 'Prim' | 'Sec';

/** Fila del CEA CONCENTRADO */
export interface CeaRow {
  Microregion: string;
  ECA: string;                    // Educador Comunitario de Acompañamiento
  CoordinadorSeguimiento: string; // Coordinador de Seguimiento
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

// ============================================================================
// Interfaces para errores y respuestas
// ============================================================================

export interface ValidationError {
  field?: string;
  message: string;
  code?: string;
  details?: any;
}

export interface ProcessingError {
  step?: string;
  message: string;
  code?: string;
  stack?: string;
  details?: any;
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
  code?: string;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// ============================================================================
// Interfaces para requests
// ============================================================================

export interface ValidateMasterRequest {
  masterId: string;
}

export interface ProcessCeaRequest {
  batchId: string;
}

// ============================================================================
// Interfaces para resultados de procesamiento
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  recordCount?: number;
  errors?: ValidationError[];
  warnings?: string[];
}

export interface ProcessingResult {
  success: boolean;
  ceaFileId?: string;
  filePath?: string;
  totalRecords?: number;
  processingTimeMs?: number;
  errors?: ProcessingError[];
}

// ============================================================================
// Constantes
// ============================================================================

export const EXPECTED_SHEET_NAMES: Record<MasterFileType, string> = {
  alumnos: 'Master',
  servicios: 'MasterPRODET06 (2)',
  figuras: 'Master-Figuras-Educativas',
  telefonia: '',
};

export const REQUIRED_COLUMNS: Record<MasterFileType, string[]> = {
  alumnos: ['Microregion', 'Genero', 'Programa', 'IdCentro'],
  servicios: ['nomMicroregion', 'nomModalidad', 'cct'],
  figuras: [
    'Microregion de servicio',
    'Figura',
    'apellidoPaterno',
    'apellidoMaterno',
    'nombre',
  ],
  telefonia: [],
};

export const LIMITS = {
  MAX_FILE_SIZE: 52428800,
  MAX_RECORDS: 100000,
  PROCESSING_TIMEOUT: 300000,
};

/** Todas las modalidades del CEA en orden */
export const MODALIDADES_CEA: ModalidadCEA[] = [
  'Inicial', 'Preescolar', 'CIC', 'PreeMig', 'Prim', 'Sec',
];
