/**
 * Helpers de Base de Datos
 * =========================
 * Funciones reutilizables para consultas comunes a la base de datos de Supabase.
 * Incluye operaciones sobre: profiles, master_uploads, cea_files, processing_logs
 */

import { supabase } from './client';
import type {
  Profile,
  MasterUpload,
  MasterUploadInsert,
  MasterUploadUpdate,
  CeaFile,
  ProcessingLog,
  MasterFileType,
  MasterUploadStatus,
  CeaProcessingStatus,
} from '../../types/database.types';

// ============================================================================
// Tipos para resultados de operaciones
// ============================================================================

export interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// OPERACIONES SOBRE TABLA: profiles
// ============================================================================

/**
 * Obtiene todos los perfiles de usuarios
 * Solo admins pueden ejecutar esta función (protegido por RLS)
 *
 * @returns Promise<DatabaseResult> con array de perfiles
 *
 * @example
 * const result = await getAllProfiles();
 * if (result.success) {
 *   console.log('Usuarios:', result.data);
 * }
 */
export async function getAllProfiles(): Promise<DatabaseResult<Profile[]>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error obteniendo perfiles:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error en getAllProfiles:', error);
    return {
      success: false,
      error: 'Error inesperado al obtener perfiles',
    };
  }
}

/**
 * Obtiene el perfil de un usuario por ID
 *
 * @param userId - ID del usuario (UUID)
 * @returns Promise<DatabaseResult> con el perfil
 */
export async function getProfileById(
  userId: string
): Promise<DatabaseResult<Profile>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ Error obteniendo perfil:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error en getProfileById:', error);
    return {
      success: false,
      error: 'Error inesperado al obtener perfil',
    };
  }
}

// ============================================================================
// OPERACIONES SOBRE TABLA: master_uploads
// ============================================================================

/**
 * Crea un nuevo registro de archivo Master subido
 *
 * @param masterUpload - Datos del Master a insertar
 * @returns Promise<DatabaseResult> con el Master insertado
 *
 * @example
 * const result = await insertMasterUpload({
 *   uploaded_by: userId,
 *   file_name: 'Master_Alumnos_2025.xlsx',
 *   file_path: 'batch-123/Master_Alumnos_2025.xlsx',
 *   file_size: 1536000,
 *   file_type: 'alumnos',
 *   upload_batch_id: 'batch-123',
 * });
 */
export async function insertMasterUpload(
  masterUpload: MasterUploadInsert
): Promise<DatabaseResult<MasterUpload>> {
  try {
    const { data, error } = await supabase
      .from('master_uploads')
      .insert(masterUpload)
      .select()
      .single();

    if (error) {
      console.error('❌ Error insertando Master:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error en insertMasterUpload:', error);
    return {
      success: false,
      error: 'Error inesperado al insertar Master',
    };
  }
}

/**
 * Obtiene todos los archivos Master (con filtros opcionales)
 *
 * @param filters - Filtros opcionales (batch_id, file_type, status)
 * @returns Promise<DatabaseResult> con array de Masters
 *
 * @example
 * // Obtener todos los Masters de un batch
 * const result = await getMasterUploads({ batch_id: 'batch-123' });
 *
 * // Obtener todos los Masters validados
 * const result = await getMasterUploads({ status: 'validated' });
 */
export async function getMasterUploads(
  filters?: {
    batch_id?: string;
    file_type?: MasterFileType;
    status?: MasterUploadStatus;
  }
): Promise<DatabaseResult<MasterUpload[]>> {
  try {
    let query = supabase
      .from('master_uploads')
      .select('*')
      .order('created_at', { ascending: false });

    // Aplicar filtros si se proporcionan
    if (filters?.batch_id) {
      query = query.eq('upload_batch_id', filters.batch_id);
    }

    if (filters?.file_type) {
      query = query.eq('file_type', filters.file_type);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error obteniendo Masters:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error en getMasterUploads:', error);
    return {
      success: false,
      error: 'Error inesperado al obtener Masters',
    };
  }
}

/**
 * Actualiza un archivo Master existente
 *
 * @param masterId - ID del Master a actualizar
 * @param updates - Campos a actualizar
 * @returns Promise<DatabaseResult> con el Master actualizado
 *
 * @example
 * // Marcar un Master como validado
 * const result = await updateMasterUpload('uuid-del-master', {
 *   status: 'validated',
 *   record_count: 1250,
 * });
 */
export async function updateMasterUpload(
  masterId: string,
  updates: MasterUploadUpdate
): Promise<DatabaseResult<MasterUpload>> {
  try {
    const { data, error } = await supabase
      .from('master_uploads')
      .update(updates)
      .eq('id', masterId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error actualizando Master:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error en updateMasterUpload:', error);
    return {
      success: false,
      error: 'Error inesperado al actualizar Master',
    };
  }
}

/**
 * Elimina un archivo Master
 *
 * @param masterId - ID del Master a eliminar
 * @returns Promise<DatabaseResult> indicando éxito o error
 *
 * @example
 * const result = await deleteMasterUpload('uuid-del-master');
 */
export async function deleteMasterUpload(
  masterId: string
): Promise<DatabaseResult> {
  try {
    const { error } = await supabase
      .from('master_uploads')
      .delete()
      .eq('id', masterId);

    if (error) {
      console.error('❌ Error eliminando Master:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ Error en deleteMasterUpload:', error);
    return {
      success: false,
      error: 'Error inesperado al eliminar Master',
    };
  }
}

/**
 * Verifica si hay 4 Masters validados en un batch
 * (requisito para poder generar un CEA)
 *
 * @param batchId - ID del batch a verificar
 * @returns Promise<DatabaseResult> con información de completitud
 *
 * @example
 * const result = await checkBatchComplete('batch-123');
 * if (result.success && result.data.isComplete) {
 *   console.log('Batch completo! Se puede generar CEA');
 * }
 */
export async function checkBatchComplete(
  batchId: string
): Promise<DatabaseResult<{ isComplete: boolean; count: number; types: MasterFileType[] }>> {
  try {
    const { data, error } = await supabase
      .from('master_uploads')
      .select('file_type')
      .eq('upload_batch_id', batchId)
      .eq('status', 'validated');

    if (error) {
      console.error('❌ Error verificando batch:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Extraer tipos de archivos
    const types = data.map((item) => item.file_type);

    // Verificar que haya exactamente 4 Masters de tipos diferentes
    const uniqueTypes = new Set(types);
    const isComplete = uniqueTypes.size === 4;

    return {
      success: true,
      data: {
        isComplete,
        count: data.length,
        types: Array.from(uniqueTypes),
      },
    };
  } catch (error) {
    console.error('❌ Error en checkBatchComplete:', error);
    return {
      success: false,
      error: 'Error inesperado al verificar batch',
    };
  }
}

// ============================================================================
// OPERACIONES SOBRE TABLA: cea_files
// ============================================================================

/**
 * Obtiene el archivo CEA más reciente (is_latest = true)
 *
 * @returns Promise<DatabaseResult> con el CEA más reciente
 *
 * @example
 * const result = await getLatestCea();
 * if (result.success && result.data) {
 *   console.log('Último CEA:', result.data.file_name);
 * }
 */
export async function getLatestCea(): Promise<DatabaseResult<CeaFile | null>> {
  try {
    const { data, error } = await supabase
      .from('cea_files')
      .select('*')
      .eq('is_latest', true)
      .eq('processing_status', 'completed')
      .single();

    if (error) {
      // Si no hay CEA, no es un error crítico
      if (error.code === 'PGRST116') { // No rows returned
        return {
          success: true,
          data: null,
        };
      }

      console.error('❌ Error obteniendo último CEA:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error en getLatestCea:', error);
    return {
      success: false,
      error: 'Error inesperado al obtener último CEA',
    };
  }
}

/**
 * Obtiene todos los archivos CEA (con filtros opcionales)
 *
 * @param filters - Filtros opcionales (batch_id, status, limit)
 * @returns Promise<DatabaseResult> con array de CEAs
 *
 * @example
 * // Obtener todos los CEAs completados
 * const result = await getAllCeas({ status: 'completed' });
 *
 * // Obtener los últimos 10 CEAs
 * const result = await getAllCeas({ limit: 10 });
 */
export async function getAllCeas(
  filters?: {
    batch_id?: string;
    status?: CeaProcessingStatus;
    limit?: number;
  }
): Promise<DatabaseResult<CeaFile[]>> {
  try {
    let query = supabase
      .from('cea_files')
      .select('*')
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (filters?.batch_id) {
      query = query.eq('generated_from_batch', filters.batch_id);
    }

    if (filters?.status) {
      query = query.eq('processing_status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error obteniendo CEAs:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error en getAllCeas:', error);
    return {
      success: false,
      error: 'Error inesperado al obtener CEAs',
    };
  }
}

/**
 * Obtiene un archivo CEA por ID
 *
 * @param ceaId - ID del CEA
 * @returns Promise<DatabaseResult> con el CEA
 */
export async function getCeaById(
  ceaId: string
): Promise<DatabaseResult<CeaFile>> {
  try {
    const { data, error } = await supabase
      .from('cea_files')
      .select('*')
      .eq('id', ceaId)
      .single();

    if (error) {
      console.error('❌ Error obteniendo CEA:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error en getCeaById:', error);
    return {
      success: false,
      error: 'Error inesperado al obtener CEA',
    };
  }
}

// ============================================================================
// OPERACIONES SOBRE TABLA: processing_logs
// ============================================================================

/**
 * Obtiene logs de procesamiento (con filtros opcionales)
 *
 * @param filters - Filtros opcionales (cea_id, batch_id, level, limit)
 * @returns Promise<DatabaseResult> con array de logs
 *
 * @example
 * // Obtener logs de error de un CEA
 * const result = await getProcessingLogs({
 *   cea_id: 'uuid-del-cea',
 *   level: 'error'
 * });
 */
export async function getProcessingLogs(
  filters?: {
    cea_id?: string;
    batch_id?: string;
    level?: 'info' | 'warning' | 'error';
    limit?: number;
  }
): Promise<DatabaseResult<ProcessingLog[]>> {
  try {
    let query = supabase
      .from('processing_logs')
      .select('*')
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (filters?.cea_id) {
      query = query.eq('cea_file_id', filters.cea_id);
    }

    if (filters?.batch_id) {
      query = query.eq('upload_batch_id', filters.batch_id);
    }

    if (filters?.level) {
      query = query.eq('level', filters.level);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    } else {
      query = query.limit(100); // Límite default
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error obteniendo logs:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error en getProcessingLogs:', error);
    return {
      success: false,
      error: 'Error inesperado al obtener logs',
    };
  }
}

// ============================================================================
// FUNCIONES RPC (Remote Procedure Call)
// ============================================================================

/**
 * Llama a la función RPC get_user_role() para obtener el rol del usuario actual
 *
 * @returns Promise<DatabaseResult> con el rol del usuario
 *
 * @example
 * const result = await callGetUserRole();
 * if (result.success) {
 *   console.log('Rol:', result.data); // 'admin' | 'user'
 * }
 */
export async function callGetUserRole(): Promise<DatabaseResult<string | null>> {
  try {
    const { data, error } = await supabase.rpc('get_user_role');

    if (error) {
      console.error('❌ Error llamando get_user_role:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error en callGetUserRole:', error);
    return {
      success: false,
      error: 'Error inesperado al obtener rol',
    };
  }
}

/**
 * Llama a la función RPC is_admin() para verificar si el usuario actual es admin
 *
 * @returns Promise<DatabaseResult> con true/false
 *
 * @example
 * const result = await callIsAdmin();
 * if (result.success && result.data) {
 *   console.log('Usuario es admin');
 * }
 */
export async function callIsAdmin(): Promise<DatabaseResult<boolean>> {
  try {
    const { data, error } = await supabase.rpc('is_admin');

    if (error) {
      console.error('❌ Error llamando is_admin:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error en callIsAdmin:', error);
    return {
      success: false,
      error: 'Error inesperado al verificar admin',
    };
  }
}

// ============================================================================
// HELPERS PARA GENERAR IDs
// ============================================================================

/**
 * Genera un ID único para un batch de Masters
 * Formato: batch-{timestamp}-{random}
 *
 * @returns String con el ID del batch
 *
 * @example
 * const batchId = generateBatchId();
 * // "batch-1735776000000-abc123"
 */
export function generateBatchId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `batch-${timestamp}-${random}`;
}

// ============================================================================
// FUNCIONES PARA PROCESAMIENTO DE CEA
// ============================================================================

/**
 * Dispara el procesamiento de un batch de Masters para generar CEA
 * Llama a la Edge Function process-cea
 *
 * @param batchId - ID del batch de Masters validados
 * @returns Promise<DatabaseResult> con información del CEA generado
 *
 * @example
 * const result = await processCeaBatch('batch-123');
 */
export async function processCeaBatch(
  batchId: string
): Promise<DatabaseResult<{ ceaId: string; fileName: string; filePath: string }>> {
  try {
    // Llamar a la Edge Function process-cea
    const { data, error } = await supabase.functions.invoke('process-cea', {
      body: { batchId },
    });

    if (error) {
      console.error('❌ Error llamando process-cea:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.message || 'Error procesando CEA',
      };
    }

    return {
      success: true,
      data: {
        ceaId: data.data.ceaId,
        fileName: data.data.fileName,
        filePath: data.data.filePath,
      },
    };
  } catch (error) {
    console.error('❌ Error en processCeaBatch:', error);
    return {
      success: false,
      error: 'Error inesperado al procesar CEA',
    };
  }
}

/**
 * Dispara la validación de un archivo Master
 * Llama a la Edge Function validate-master
 *
 * @param masterId - ID del archivo Master a validar
 * @returns Promise<DatabaseResult> con resultado de validación
 *
 * @example
 * const result = await triggerValidation('master-123');
 */
export async function triggerValidation(
  masterId: string
): Promise<DatabaseResult<{ recordCount?: number; warnings?: string[] }>> {
  try {
    // Llamar a la Edge Function validate-master
    const { data, error } = await supabase.functions.invoke('validate-master', {
      body: { masterId },
    });

    if (error) {
      console.error('❌ Error llamando validate-master:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.message || 'Error validando Master',
      };
    }

    return {
      success: true,
      data: {
        recordCount: data.data?.recordCount,
        warnings: data.data?.warnings,
      },
    };
  } catch (error) {
    console.error('❌ Error en triggerValidation:', error);
    return {
      success: false,
      error: 'Error inesperado al validar Master',
    };
  }
}
