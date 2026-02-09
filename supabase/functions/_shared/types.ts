/**
 * Tipos Compartidos para Edge Functions
 * ======================================
 * Define interfaces y tipos usados por múltiples Edge Functions
 */

// ============================================================================
// Tipos para archivos Master
// ============================================================================

/**
 * Tipos válidos de archivos Master
 */
export type MasterFileType = 'alumnos' | 'servicios' | 'figuras' | 'telefonia';

/**
 * Estados de validación de un archivo Master
 */
export type MasterUploadStatus = 'uploaded' | 'validating' | 'validated' | 'error';

/**
 * Estados de procesamiento de un archivo CEA
 */
export type CeaProcessingStatus = 'processing' | 'completed' | 'failed';

// ============================================================================
// Interfaces para datos procesados
// ============================================================================

/**
 * Datos procesados de un archivo Master de Alumnos
 */
export interface AlumnosData {
  microregion: string[];      // Nombre de la microrregión
  genero: string[];            // H (Hombre) o M (Mujer)
  nivel: string[];             // Nivel educativo
}

/**
 * Datos procesados de un archivo Master de Servicios
 */
export interface ServiciosData {
  microregion: string[];       // Nombre de la microrregión
  modalidad: string[];         // Modalidad del servicio
  cantidad: number[];          // Cantidad de servicios
}

/**
 * Datos procesados de un archivo Master de Figuras
 */
export interface FigurasData {
  microregion: string[];       // Nombre de la microrregión
  figura: string[];            // Tipo de figura educativa
  nombreCompleto: string[];    // Nombre completo de la figura
}

/**
 * Datos procesados de un archivo Master de Telefonía
 * (Actualmente no se procesa, pero se incluye para completitud)
 */
export interface TelefoniaData {
  [key: string]: any;
}

// ============================================================================
// Interfaces para errores
// ============================================================================

/**
 * Error de validación de archivo Master
 */
export interface ValidationError {
  field?: string;              // Campo que falló la validación
  message: string;             // Mensaje de error
  code?: string;               // Código de error
  details?: any;               // Detalles adicionales
}

/**
 * Error de procesamiento de CEA
 */
export interface ProcessingError {
  step?: string;               // Paso donde ocurrió el error
  message: string;             // Mensaje de error
  code?: string;               // Código de error
  stack?: string;              // Stack trace (solo en dev)
  details?: any;               // Detalles adicionales
}

// ============================================================================
// Interfaces para respuestas de Edge Functions
// ============================================================================

/**
 * Respuesta exitosa genérica
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Respuesta de error genérica
 */
export interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
  code?: string;
}

/**
 * Respuesta genérica (éxito o error)
 */
export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// ============================================================================
// Interfaces para requests
// ============================================================================

/**
 * Request para validar un archivo Master
 */
export interface ValidateMasterRequest {
  masterId: string;            // ID del registro en master_uploads
}

/**
 * Request para procesar CEA
 */
export interface ProcessCeaRequest {
  batchId: string;             // ID del batch de Masters a procesar
}

// ============================================================================
// Interfaces para resultados de procesamiento
// ============================================================================

/**
 * Resultado de validación de un archivo Master
 */
export interface ValidationResult {
  isValid: boolean;
  recordCount?: number;
  errors?: ValidationError[];
  warnings?: string[];
}

/**
 * Resultado de procesamiento de CEA
 */
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

/**
 * Nombres de hojas esperadas en cada tipo de archivo Master
 */
export const EXPECTED_SHEET_NAMES: Record<MasterFileType, string> = {
  alumnos: 'Master',
  servicios: 'MasterPRODET06 (2)',
  figuras: 'Master-Figuras-Educativas',
  telefonia: '', // Cualquier nombre (no se procesa actualmente)
};

/**
 * Columnas requeridas en cada tipo de archivo Master
 */
export const REQUIRED_COLUMNS: Record<MasterFileType, string[]> = {
  alumnos: ['Microregion', 'Genero', 'Nivel'],
  servicios: ['nomMicroregion', 'nomModalidad'],
  figuras: [
    'Microregion de servicio',
    'Figura',
    'apellidoPaterno',
    'apellidoMaterno',
    'nombre',
  ],
  telefonia: [], // Sin columnas requeridas (no se procesa)
};

/**
 * Límites de configuración
 */
export const LIMITS = {
  MAX_FILE_SIZE: 52428800,     // 50MB en bytes
  MAX_RECORDS: 100000,          // Máximo de filas por archivo
  PROCESSING_TIMEOUT: 300000,   // 5 minutos en milisegundos
};
