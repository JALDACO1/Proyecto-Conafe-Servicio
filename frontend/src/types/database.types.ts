/**
 * Tipos TypeScript generados para la Base de Datos de Supabase
 * ===========================================================
 * Estos tipos proporcionan autocompletado y type-safety al hacer consultas a Supabase.
 * Los tipos coinciden exactamente con el esquema de base de datos definido en las migraciones SQL.
 *
 * IMPORTANTE: Si modificas el esquema de base de datos, regenera estos tipos con:
 * npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
 */

// ============================================================================
// Tipo principal: Database
// ============================================================================
// Representa toda la estructura de la base de datos, organizada por schemas
export type Database = {
  public: {
    Tables: {
      // Tabla: profiles
      profiles: {
        Row: {
          id: string; // UUID
          email: string;
          full_name: string | null;
          role: 'admin' | 'user';
          created_at: string; // Timestamp ISO 8601
          updated_at: string; // Timestamp ISO 8601
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: 'admin' | 'user';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: 'admin' | 'user';
          created_at?: string;
          updated_at?: string;
        };
      };

      // Tabla: master_uploads
      master_uploads: {
        Row: {
          id: string; // UUID
          uploaded_by: string; // UUID (foreign key a profiles.id)
          file_name: string;
          file_path: string;
          file_size: number; // bigint
          file_type: 'alumnos' | 'servicios' | 'figuras' | 'telefonia';
          status: 'uploaded' | 'validating' | 'validated' | 'error';
          validation_errors: ValidationError[] | null; // JSONB
          record_count: number | null;
          upload_batch_id: string | null; // UUID
          created_at: string; // Timestamp ISO 8601
          updated_at: string; // Timestamp ISO 8601
        };
        Insert: {
          id?: string;
          uploaded_by: string;
          file_name: string;
          file_path: string;
          file_size: number;
          file_type: 'alumnos' | 'servicios' | 'figuras' | 'telefonia';
          status?: 'uploaded' | 'validating' | 'validated' | 'error';
          validation_errors?: ValidationError[] | null;
          record_count?: number | null;
          upload_batch_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          uploaded_by?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number;
          file_type?: 'alumnos' | 'servicios' | 'figuras' | 'telefonia';
          status?: 'uploaded' | 'validating' | 'validated' | 'error';
          validation_errors?: ValidationError[] | null;
          record_count?: number | null;
          upload_batch_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // Tabla: cea_files
      cea_files: {
        Row: {
          id: string; // UUID
          file_name: string;
          file_path: string;
          file_size: number; // bigint
          generated_from_batch: string; // UUID
          processed_by: string; // UUID (foreign key a profiles.id)
          processing_status: 'processing' | 'completed' | 'failed';
          processing_errors: ProcessingError[] | null; // JSONB
          total_records: number | null;
          processing_time_ms: number | null;
          version: number;
          is_latest: boolean;
          created_at: string; // Timestamp ISO 8601
        };
        Insert: {
          id?: string;
          file_name: string;
          file_path: string;
          file_size: number;
          generated_from_batch: string;
          processed_by: string;
          processing_status?: 'processing' | 'completed' | 'failed';
          processing_errors?: ProcessingError[] | null;
          total_records?: number | null;
          processing_time_ms?: number | null;
          version?: number;
          is_latest?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number;
          generated_from_batch?: string;
          processed_by?: string;
          processing_status?: 'processing' | 'completed' | 'failed';
          processing_errors?: ProcessingError[] | null;
          total_records?: number | null;
          processing_time_ms?: number | null;
          version?: number;
          is_latest?: boolean;
          created_at?: string;
        };
      };

      // Tabla: processing_logs
      processing_logs: {
        Row: {
          id: string; // UUID
          cea_file_id: string | null; // UUID (foreign key a cea_files.id)
          upload_batch_id: string | null; // UUID
          level: 'info' | 'warning' | 'error';
          message: string;
          details: Record<string, any> | null; // JSONB
          created_at: string; // Timestamp ISO 8601
        };
        Insert: {
          id?: string;
          cea_file_id?: string | null;
          upload_batch_id?: string | null;
          level: 'info' | 'warning' | 'error';
          message: string;
          details?: Record<string, any> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          cea_file_id?: string | null;
          upload_batch_id?: string | null;
          level?: 'info' | 'warning' | 'error';
          message?: string;
          details?: Record<string, any> | null;
          created_at?: string;
        };
      };
    };

    // Funciones disponibles via RPC
    Functions: {
      get_user_role: {
        Args: Record<string, never>; // Sin argumentos
        Returns: string | null; // Retorna el rol del usuario actual
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean; // true si el usuario actual es admin
      };
    };
  };
};

// ============================================================================
// Tipos auxiliares para JSONB fields
// ============================================================================

/**
 * Estructura de errores de validación en master_uploads.validation_errors
 */
export interface ValidationError {
  field?: string; // Campo que falló la validación
  message: string; // Mensaje de error
  code?: string; // Código de error (ej: "MISSING_COLUMN")
  details?: Record<string, any>; // Detalles adicionales
}

/**
 * Estructura de errores de procesamiento en cea_files.processing_errors
 */
export interface ProcessingError {
  step?: string; // Paso en el que falló (ej: "merge_dataframes")
  message: string; // Mensaje de error
  code?: string; // Código de error
  stack?: string; // Stack trace (solo en dev)
  details?: Record<string, any>; // Detalles adicionales
}

// ============================================================================
// Tipos helper para consultas
// ============================================================================

/**
 * Tipo de una fila de profiles (cuando se obtiene de la DB)
 */
export type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Tipo para insertar un nuevo profile
 */
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];

/**
 * Tipo para actualizar un profile
 */
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

/**
 * Tipo de una fila de master_uploads
 */
export type MasterUpload = Database['public']['Tables']['master_uploads']['Row'];

/**
 * Tipo para insertar un nuevo master_upload
 */
export type MasterUploadInsert = Database['public']['Tables']['master_uploads']['Insert'];

/**
 * Tipo para actualizar un master_upload
 */
export type MasterUploadUpdate = Database['public']['Tables']['master_uploads']['Update'];

/**
 * Tipo de una fila de cea_files
 */
export type CeaFile = Database['public']['Tables']['cea_files']['Row'];

/**
 * Tipo para insertar un nuevo cea_file
 */
export type CeaFileInsert = Database['public']['Tables']['cea_files']['Insert'];

/**
 * Tipo para actualizar un cea_file
 */
export type CeaFileUpdate = Database['public']['Tables']['cea_files']['Update'];

/**
 * Tipo de una fila de processing_logs
 */
export type ProcessingLog = Database['public']['Tables']['processing_logs']['Row'];

/**
 * Tipo para insertar un nuevo processing_log
 */
export type ProcessingLogInsert = Database['public']['Tables']['processing_logs']['Insert'];

// ============================================================================
// Tipos para tipos de archivo Master
// ============================================================================

/**
 * Tipos válidos de archivos Master
 */
export type MasterFileType = 'alumnos' | 'servicios' | 'figuras' | 'telefonia';

/**
 * Estados válidos de validación de Master
 */
export type MasterUploadStatus = 'uploaded' | 'validating' | 'validated' | 'error';

/**
 * Estados válidos de procesamiento de CEA
 */
export type CeaProcessingStatus = 'processing' | 'completed' | 'failed';

/**
 * Roles de usuario
 */
export type UserRole = 'admin' | 'user';

/**
 * Niveles de log
 */
export type LogLevel = 'info' | 'warning' | 'error';

// ============================================================================
// Tipos para respuestas de Supabase
// ============================================================================

/**
 * Respuesta exitosa de una consulta a Supabase
 */
export interface SupabaseSuccess<T> {
  data: T;
  error: null;
}

/**
 * Respuesta con error de una consulta a Supabase
 */
export interface SupabaseError {
  data: null;
  error: {
    message: string;
    details?: string;
    hint?: string;
    code?: string;
  };
}

/**
 * Respuesta genérica de Supabase (success o error)
 */
export type SupabaseResponse<T> = SupabaseSuccess<T> | SupabaseError;
