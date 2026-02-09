/**
 * Helpers de Supabase Storage
 * ============================
 * Funciones reutilizables para operaciones con archivos en Supabase Storage.
 * Incluye: subir, descargar, eliminar archivos, obtener URLs firmadas, etc.
 */

import { supabase } from './client';
import type { MasterFileType } from '../../types/database.types';

// ============================================================================
// Constantes de configuración
// ============================================================================

/**
 * Nombres de los buckets de Storage
 * Deben coincidir con los buckets creados en las migraciones SQL
 */
export const STORAGE_BUCKETS = {
  MASTER_FILES: 'master-files',  // Archivos Master subidos por admins
  CEA_FILES: 'cea-files',        // Archivos CEA generados por el sistema
} as const;

/**
 * Tamaño máximo de archivo en bytes (50MB)
 * Puedes ajustar este valor según tus necesidades
 */
export const MAX_FILE_SIZE = parseInt(
  import.meta.env.VITE_MAX_FILE_SIZE_MB || '50'
) * 1024 * 1024; // Convertir MB a bytes

/**
 * Extensiones de archivo permitidas
 */
export const ALLOWED_FILE_EXTENSIONS = ['.xlsx', '.xls'];

/**
 * Tiempo de expiración de URLs firmadas en segundos (15 minutos)
 */
export const SIGNED_URL_EXPIRY_SECONDS = parseInt(
  import.meta.env.VITE_SIGNED_URL_EXPIRY_SECONDS || '900'
);

// ============================================================================
// Tipos
// ============================================================================

/**
 * Resultado de operación de Storage
 */
export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Metadata de un archivo en Storage
 */
export interface FileMetadata {
  name: string;           // Nombre del archivo
  path: string;           // Ruta completa en Storage
  size: number;           // Tamaño en bytes
  mimeType: string;       // Tipo MIME (ej: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
  createdAt: string;      // Fecha de creación
  updatedAt: string;      // Fecha de última modificación
}

/**
 * Opciones para subir un archivo
 */
export interface UploadOptions {
  bucket: string;         // Nombre del bucket
  path: string;           // Ruta donde guardar el archivo
  file: File;             // Archivo a subir
  upsert?: boolean;       // Si true, sobrescribir archivo existente
  onProgress?: (progress: number) => void; // Callback de progreso (0-100)
}

// ============================================================================
// FUNCIÓN: validateFile
// ============================================================================
/**
 * Valida que un archivo cumpla con los requisitos (tamaño, extensión)
 *
 * @param file - Archivo a validar
 * @returns StorageResult con información de validación
 *
 * @example
 * const validation = validateFile(file);
 * if (!validation.success) {
 *   alert(validation.error);
 * }
 */
export function validateFile(file: File): StorageResult {
  // 1. Validar que el archivo existe
  if (!file) {
    return {
      success: false,
      error: 'No se proporcionó ningún archivo',
    };
  }

  // 2. Validar tamaño del archivo
  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      success: false,
      error: `El archivo es demasiado grande (${fileSizeMB}MB). Máximo permitido: ${maxSizeMB}MB`,
    };
  }

  // 3. Validar extensión del archivo
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.includes(fileExtension)) {
    return {
      success: false,
      error: `Extensión de archivo no permitida. Solo se permiten: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`,
    };
  }

  // 4. Validar tipo MIME (doble verificación)
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  if (file.type && !allowedMimeTypes.includes(file.type)) {
    return {
      success: false,
      error: 'Tipo de archivo no válido. Solo se permiten archivos Excel (.xlsx, .xls)',
    };
  }

  return {
    success: true,
  };
}

// ============================================================================
// FUNCIÓN: validateMasterFileName
// ============================================================================
/**
 * Valida que el nombre del archivo Master contenga la palabra clave correcta
 *
 * @param fileName - Nombre del archivo
 * @param fileType - Tipo de Master esperado
 * @returns StorageResult con información de validación
 *
 * @example
 * const validation = validateMasterFileName('Master_Alumnos_2025.xlsx', 'alumnos');
 * if (!validation.success) {
 *   alert(validation.error);
 * }
 */
export function validateMasterFileName(
  fileName: string,
  fileType: MasterFileType
): StorageResult {
  // Convertir a minúsculas para comparación case-insensitive
  const fileNameLower = fileName.toLowerCase();

  // Palabras clave requeridas según el tipo de Master
  const keywords: Record<MasterFileType, string[]> = {
    alumnos: ['alumno', 'alumnos'],
    servicios: ['servicio', 'servicios'],
    figuras: ['figura', 'figuras'],
    telefonia: ['telefon', 'telefonia'],
  };

  // Verificar si el nombre contiene alguna de las palabras clave
  const requiredKeywords = keywords[fileType];
  const containsKeyword = requiredKeywords.some((keyword) =>
    fileNameLower.includes(keyword)
  );

  if (!containsKeyword) {
    return {
      success: false,
      error: `El nombre del archivo debe contener "${requiredKeywords.join('" o "')}"`,
    };
  }

  return {
    success: true,
  };
}

// ============================================================================
// FUNCIÓN: uploadFile
// ============================================================================
/**
 * Sube un archivo a Supabase Storage
 *
 * @param options - Opciones de subida (bucket, path, file, etc.)
 * @returns Promise<StorageResult> con la ruta del archivo subido
 *
 * @example
 * const result = await uploadFile({
 *   bucket: STORAGE_BUCKETS.MASTER_FILES,
 *   path: `batch-123/Master_Alumnos.xlsx`,
 *   file: file,
 *   onProgress: (progress) => console.log(`Progreso: ${progress}%`)
 * });
 *
 * if (result.success) {
 *   console.log('Archivo subido en:', result.data.path);
 * }
 */
export async function uploadFile(
  options: UploadOptions
): Promise<StorageResult<{ path: string; fullPath: string }>> {
  const { bucket, path, file, upsert = false, onProgress } = options;

  try {
    // 1. Validar el archivo antes de subir
    const validation = validateFile(file);
    if (!validation.success) {
      return validation;
    }

    // 2. Subir el archivo a Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',  // Cache de 1 hora
        upsert,                 // Sobrescribir si ya existe
      });

    if (error) {
      console.error('❌ Error subiendo archivo:', error);

      // Traducir errores comunes
      let errorMessage = error.message;
      if (error.message.includes('already exists')) {
        errorMessage = 'Ya existe un archivo con ese nombre';
      } else if (error.message.includes('Unauthorized')) {
        errorMessage = 'No tienes permisos para subir archivos';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    // 3. Simular progreso si se proporciona callback
    // (Supabase no proporciona eventos de progreso nativamente)
    if (onProgress) {
      onProgress(100);
    }

    return {
      success: true,
      data: {
        path: data.path,
        fullPath: `${bucket}/${data.path}`,
      },
    };
  } catch (error) {
    console.error('❌ Error en uploadFile:', error);
    return {
      success: false,
      error: 'Error inesperado al subir el archivo',
    };
  }
}

// ============================================================================
// FUNCIÓN: downloadFile
// ============================================================================
/**
 * Descarga un archivo desde Supabase Storage
 *
 * @param bucket - Nombre del bucket
 * @param path - Ruta del archivo en Storage
 * @returns Promise<StorageResult> con el Blob del archivo
 *
 * @example
 * const result = await downloadFile(
 *   STORAGE_BUCKETS.CEA_FILES,
 *   'CEA_22_10_2025.xlsx'
 * );
 *
 * if (result.success) {
 *   // Crear URL para descarga
 *   const url = URL.createObjectURL(result.data);
 *   window.open(url);
 * }
 */
export async function downloadFile(
  bucket: string,
  path: string
): Promise<StorageResult<Blob>> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) {
      console.error('❌ Error descargando archivo:', error);
      return {
        success: false,
        error: 'Error al descargar el archivo',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('❌ Error en downloadFile:', error);
    return {
      success: false,
      error: 'Error inesperado al descargar el archivo',
    };
  }
}

// ============================================================================
// FUNCIÓN: getSignedUrl
// ============================================================================
/**
 * Obtiene una URL firmada (temporaria) para descargar un archivo
 * Las URLs firmadas expiran después de un tiempo configurado (default: 15 min)
 *
 * @param bucket - Nombre del bucket
 * @param path - Ruta del archivo en Storage
 * @param expiresIn - Tiempo de expiración en segundos (opcional)
 * @returns Promise<StorageResult> con la URL firmada
 *
 * @example
 * const result = await getSignedUrl(
 *   STORAGE_BUCKETS.CEA_FILES,
 *   'CEA_22_10_2025.xlsx',
 *   900 // 15 minutos
 * );
 *
 * if (result.success) {
 *   window.open(result.data.signedUrl);
 * }
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = SIGNED_URL_EXPIRY_SECONDS
): Promise<StorageResult<{ signedUrl: string }>> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('❌ Error obteniendo URL firmada:', error);
      return {
        success: false,
        error: 'Error al generar URL de descarga',
      };
    }

    return {
      success: true,
      data: {
        signedUrl: data.signedUrl,
      },
    };
  } catch (error) {
    console.error('❌ Error en getSignedUrl:', error);
    return {
      success: false,
      error: 'Error inesperado al generar URL de descarga',
    };
  }
}

// ============================================================================
// FUNCIÓN: deleteFile
// ============================================================================
/**
 * Elimina un archivo de Supabase Storage
 *
 * @param bucket - Nombre del bucket
 * @param path - Ruta del archivo en Storage
 * @returns Promise<StorageResult> indicando éxito o error
 *
 * @example
 * const result = await deleteFile(
 *   STORAGE_BUCKETS.MASTER_FILES,
 *   'batch-123/Master_Alumnos.xlsx'
 * );
 *
 * if (result.success) {
 *   console.log('Archivo eliminado');
 * }
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<StorageResult> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]); // remove() acepta array de paths

    if (error) {
      console.error('❌ Error eliminando archivo:', error);
      return {
        success: false,
        error: 'Error al eliminar el archivo',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ Error en deleteFile:', error);
    return {
      success: false,
      error: 'Error inesperado al eliminar el archivo',
    };
  }
}

// ============================================================================
// FUNCIÓN: listFiles
// ============================================================================
/**
 * Lista archivos en un bucket de Storage
 *
 * @param bucket - Nombre del bucket
 * @param path - Carpeta dentro del bucket (opcional, default: raíz)
 * @returns Promise<StorageResult> con array de archivos
 *
 * @example
 * const result = await listFiles(
 *   STORAGE_BUCKETS.MASTER_FILES,
 *   'batch-123'
 * );
 *
 * if (result.success) {
 *   result.data.forEach(file => {
 *     console.log('Archivo:', file.name, 'Tamaño:', file.metadata.size);
 *   });
 * }
 */
export async function listFiles(
  bucket: string,
  path: string = ''
): Promise<StorageResult<FileMetadata[]>> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path, {
        limit: 100,           // Límite de archivos a retornar
        offset: 0,            // Offset para paginación
        sortBy: {
          column: 'created_at',
          order: 'desc',      // Más recientes primero
        },
      });

    if (error) {
      console.error('❌ Error listando archivos:', error);
      return {
        success: false,
        error: 'Error al listar archivos',
      };
    }

    // Mapear los datos a nuestro tipo FileMetadata
    const files: FileMetadata[] = data.map((file) => ({
      name: file.name,
      path: path ? `${path}/${file.name}` : file.name,
      size: file.metadata?.size || 0,
      mimeType: file.metadata?.mimetype || '',
      createdAt: file.created_at || '',
      updatedAt: file.updated_at || '',
    }));

    return {
      success: true,
      data: files,
    };
  } catch (error) {
    console.error('❌ Error en listFiles:', error);
    return {
      success: false,
      error: 'Error inesperado al listar archivos',
    };
  }
}

// ============================================================================
// FUNCIÓN: getPublicUrl
// ============================================================================
/**
 * Obtiene la URL pública de un archivo (solo para buckets públicos)
 * IMPORTANTE: Los buckets master-files y cea-files son PRIVADOS,
 * así que esta función NO funcionará para ellos. Usa getSignedUrl() en su lugar.
 *
 * @param bucket - Nombre del bucket
 * @param path - Ruta del archivo en Storage
 * @returns StorageResult con la URL pública
 *
 * @example
 * // Solo para buckets públicos
 * const result = getPublicUrl('avatars', 'user-123.jpg');
 * if (result.success) {
 *   <img src={result.data.publicUrl} />
 * }
 */
export function getPublicUrl(
  bucket: string,
  path: string
): StorageResult<{ publicUrl: string }> {
  try {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return {
      success: true,
      data: {
        publicUrl: data.publicUrl,
      },
    };
  } catch (error) {
    console.error('❌ Error en getPublicUrl:', error);
    return {
      success: false,
      error: 'Error al obtener URL pública',
    };
  }
}

// ============================================================================
// FUNCIÓN: formatFileSize
// ============================================================================
/**
 * Formatea el tamaño de un archivo en un string legible
 *
 * @param bytes - Tamaño en bytes
 * @returns String formateado (ej: "1.5 MB")
 *
 * @example
 * formatFileSize(1536000) // "1.46 MB"
 * formatFileSize(2048)    // "2.00 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// FUNCIÓN: getMasterFileKeyword
// ============================================================================
/**
 * Obtiene la palabra clave que debe contener un archivo Master según su tipo
 *
 * @param fileType - Tipo de archivo Master
 * @returns String con la palabra clave
 *
 * @example
 * getMasterFileKeyword('alumnos') // "alumno o alumnos"
 */
export function getMasterFileKeyword(fileType: MasterFileType): string {
  const keywords: Record<MasterFileType, string> = {
    alumnos: 'alumno o alumnos',
    servicios: 'servicio o servicios',
    figuras: 'figura o figuras',
    telefonia: 'telefon o telefonia',
  };

  return keywords[fileType];
}
