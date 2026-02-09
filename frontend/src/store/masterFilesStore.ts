/**
 * Store de Archivos Master con Zustand
 * ======================================
 * Maneja el estado de archivos Master subidos y su validación
 *
 * Funcionalidades:
 * - Subida de archivos Excel a Supabase Storage
 * - Validación automática mediante Edge Function
 * - Gestión de batches (grupos de 4 archivos)
 * - Tracking de estado de validación en tiempo real
 * - Listado y eliminación de archivos
 */

import { create } from 'zustand';
import type { MasterUpload, MasterFileType } from '../types/database.types';
import { supabase } from '../utils/supabase/client';
import {
  uploadFile,
  deleteFile,
  validateMasterFileName,
} from '../utils/supabase/storage';
import {
  getMasterUploads,
  insertMasterUpload,
  deleteMasterUpload,
  checkBatchComplete,
  triggerValidation,
} from '../utils/supabase/database';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Estado de subida de un archivo
 */
export interface UploadProgress {
  fileType: MasterFileType;
  fileName: string;
  progress: number;        // 0-100
  status: 'uploading' | 'validating' | 'completed' | 'error';
  error?: string;
}

/**
 * Estado del store de archivos Master
 */
interface MasterFilesState {
  // Estado actual
  files: MasterUpload[];                    // Lista de archivos Master
  currentBatchId: string | null;            // Batch ID actual
  uploadProgress: Map<string, UploadProgress>; // Progreso de subidas
  isLoading: boolean;                       // ¿Cargando lista?
  error: string | null;                     // Error global

  // Acciones
  fetchFiles: (batchId?: string) => Promise<void>;
  uploadMasterFile: (file: File, fileType: MasterFileType) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  createNewBatch: () => void;
  canProcessBatch: () => Promise<boolean>;
  clearError: () => void;

  // Helpers
  getFilesByType: (fileType: MasterFileType) => MasterUpload[];
  getFileByType: (fileType: MasterFileType) => MasterUpload | null;
  getBatchFiles: () => MasterUpload[];
}

// ============================================================================
// Store de Zustand
// ============================================================================

/**
 * Store global de archivos Master
 *
 * Uso:
 * ```tsx
 * import { useMasterFilesStore } from '@/store/masterFilesStore';
 *
 * function Component() {
 *   const { files, uploadMasterFile, fetchFiles } = useMasterFilesStore();
 *   // ...
 * }
 * ```
 */
export const useMasterFilesStore = create<MasterFilesState>((set, get) => ({
  // ============================================================================
  // Estado inicial
  // ============================================================================
  files: [],
  currentBatchId: crypto.randomUUID(), // Generar batch ID inicial
  uploadProgress: new Map(),
  isLoading: false,
  error: null,

  // ============================================================================
  // Acción: fetchFiles
  // ============================================================================
  /**
   * Obtiene la lista de archivos Master desde la base de datos
   *
   * @param batchId - ID del batch a filtrar (opcional)
   *
   * @example
   * await fetchFiles(); // Todos los archivos
   * await fetchFiles('batch-123'); // Solo del batch especificado
   */
  fetchFiles: async (batchId?: string) => {
    try {
      set({ isLoading: true, error: null });

      const { success, data, error } = await getMasterUploads(
        batchId ? { batch_id: batchId } : undefined
      );

      if (!success || !data) {
        throw new Error(error || 'Error obteniendo archivos Master');
      }

      set({
        files: data,
        isLoading: false,
        error: null,
      });

      console.log(`✅ ${data.length} archivos Master cargados`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

      set({
        isLoading: false,
        error: errorMessage,
      });

      console.error('❌ Error en fetchFiles:', errorMessage);
      throw new Error(errorMessage);
    }
  },

  // ============================================================================
  // Acción: uploadMasterFile
  // ============================================================================
  /**
   * Sube un archivo Master a Supabase Storage y lo registra en la BD
   *
   * Flujo:
   * 1. Validar nombre del archivo
   * 2. Subir a Storage (bucket: master-files)
   * 3. Registrar en BD (tabla: master_uploads)
   * 4. Disparar validación automática (Edge Function)
   * 5. Actualizar lista de archivos
   *
   * @param file - Archivo Excel a subir
   * @param fileType - Tipo de Master (alumnos, servicios, figuras, telefonia)
   *
   * @throws Error si la validación o subida falla
   *
   * @example
   * await uploadMasterFile(file, 'alumnos');
   */
  uploadMasterFile: async (file: File, fileType: MasterFileType) => {
    const { currentBatchId } = get();

    if (!currentBatchId) {
      throw new Error('No hay batch ID activo');
    }

    // Crear ID único para el progreso
    const progressId = `${fileType}-${Date.now()}`;

    try {
      // 1. Inicializar progreso
      set((state) => ({
        uploadProgress: new Map(state.uploadProgress).set(progressId, {
          fileType,
          fileName: file.name,
          progress: 0,
          status: 'uploading',
        }),
        error: null,
      }));

      // 2. Validar nombre del archivo
      console.log(`📝 Validando nombre: ${file.name}`);
      const validationResult = validateMasterFileName(file.name, fileType);

      if (!validationResult.success) {
        throw new Error(validationResult.error || 'Nombre de archivo inválido');
      }

      // Actualizar progreso: validación OK
      set((state) => ({
        uploadProgress: new Map(state.uploadProgress).set(progressId, {
          fileType,
          fileName: file.name,
          progress: 20,
          status: 'uploading',
        }),
      }));

      // 3. Subir archivo a Storage
      console.log(`📤 Subiendo archivo: ${file.name}`);
      const uploadResult = await uploadFile({
        bucket: 'master-files',
        path: `batch-${currentBatchId}/${file.name}`,
        file: file,
        upsert: false,
      });

      if (!uploadResult.success || !uploadResult.data) {
        throw new Error(uploadResult.error || 'Error subiendo archivo');
      }

      const { path: filePath } = uploadResult.data;

      // Actualizar progreso: subida completada
      set((state) => ({
        uploadProgress: new Map(state.uploadProgress).set(progressId, {
          fileType,
          fileName: file.name,
          progress: 60,
          status: 'uploading',
        }),
      }));

      // 4. Obtener el ID del usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // 5. Registrar en la base de datos
      console.log(`📝 Registrando en BD: ${file.name}`);
      const dbResult = await insertMasterUpload({
        uploaded_by: user.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: fileType,
        upload_batch_id: currentBatchId,
        status: 'uploaded',
      });

      if (!dbResult.success || !dbResult.data) {
        // Si falla el registro, eliminar archivo de Storage
        await deleteFile('master-files', filePath);
        throw new Error(dbResult.error || 'Error registrando archivo');
      }

      const masterId = dbResult.data.id;

      // Actualizar progreso: registrado, iniciando validación
      set((state) => ({
        uploadProgress: new Map(state.uploadProgress).set(progressId, {
          fileType,
          fileName: file.name,
          progress: 80,
          status: 'validating',
        }),
      }));

      // 5. Disparar validación automática (Edge Function)
      console.log(`🔍 Validando archivo: ${file.name}`);
      const validationTrigger = await triggerValidation(masterId);

      if (!validationTrigger.success) {
        console.warn('⚠️ No se pudo disparar validación automática');
      }

      // Actualizar progreso: completado
      set((state) => ({
        uploadProgress: new Map(state.uploadProgress).set(progressId, {
          fileType,
          fileName: file.name,
          progress: 100,
          status: 'completed',
        }),
      }));

      // 6. Actualizar lista de archivos
      await get().fetchFiles(currentBatchId);

      console.log(`✅ Archivo subido exitosamente: ${file.name}`);

      // Limpiar progreso después de 3 segundos
      setTimeout(() => {
        set((state) => {
          const newProgress = new Map(state.uploadProgress);
          newProgress.delete(progressId);
          return { uploadProgress: newProgress };
        });
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

      // Actualizar progreso: error
      set((state) => ({
        uploadProgress: new Map(state.uploadProgress).set(progressId, {
          fileType,
          fileName: file.name,
          progress: 0,
          status: 'error',
          error: errorMessage,
        }),
        error: errorMessage,
      }));

      console.error('❌ Error en uploadMasterFile:', errorMessage);

      // Limpiar progreso de error después de 5 segundos
      setTimeout(() => {
        set((state) => {
          const newProgress = new Map(state.uploadProgress);
          newProgress.delete(progressId);
          return { uploadProgress: newProgress };
        });
      }, 5000);

      throw new Error(errorMessage);
    }
  },

  // ============================================================================
  // Acción: deleteFile
  // ============================================================================
  /**
   * Elimina un archivo Master (Storage + BD)
   *
   * @param fileId - ID del archivo en la BD
   *
   * @example
   * await deleteFile('file-id-123');
   */
  deleteFile: async (fileId: string) => {
    try {
      set({ error: null });

      // 1. Buscar el archivo en el estado local
      const { files, currentBatchId } = get();
      const fileToDelete = files.find((f) => f.id === fileId);

      if (!fileToDelete) {
        throw new Error('Archivo no encontrado');
      }

      console.log(`🗑️ Eliminando archivo: ${fileToDelete.file_name}`);

      // 2. Eliminar de Storage
      const storageResult = await deleteFile('master-files', fileToDelete.file_path);

      if (!storageResult.success) {
        console.warn('⚠️ No se pudo eliminar de Storage:', storageResult.error);
        // Continuar de todos modos para eliminar de BD
      }

      // 3. Eliminar de la base de datos
      const dbResult = await deleteMasterUpload(fileId);

      if (!dbResult.success) {
        throw new Error(dbResult.error || 'Error eliminando archivo');
      }

      // 4. Actualizar lista de archivos
      await get().fetchFiles(currentBatchId);

      console.log(`✅ Archivo eliminado: ${fileToDelete.file_name}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

      set({ error: errorMessage });

      console.error('❌ Error en deleteFile:', errorMessage);
      throw new Error(errorMessage);
    }
  },

  // ============================================================================
  // Acción: createNewBatch
  // ============================================================================
  /**
   * Crea un nuevo batch ID para un nuevo conjunto de archivos
   * Útil cuando se quiere empezar de cero
   *
   * @example
   * createNewBatch();
   */
  createNewBatch: () => {
    const newBatchId = crypto.randomUUID();

    set({
      currentBatchId: newBatchId,
      files: [],
      uploadProgress: new Map(),
      error: null,
    });

    console.log(`🆕 Nuevo batch creado: ${newBatchId}`);
  },

  // ============================================================================
  // Acción: canProcessBatch
  // ============================================================================
  /**
   * Verifica si el batch actual está completo y listo para procesar
   * Debe tener exactamente 4 archivos validados (uno de cada tipo)
   *
   * @returns true si puede procesar, false si no
   *
   * @example
   * const ready = await canProcessBatch();
   * if (ready) {
   *   // Habilitar botón "Procesar CEA"
   * }
   */
  canProcessBatch: async () => {
    const { currentBatchId } = get();

    if (!currentBatchId) {
      return false;
    }

    try {
      const result = await checkBatchComplete(currentBatchId);

      if (!result.success || !result.data) {
        return false;
      }

      const { isComplete, count } = result.data;

      console.log(`📊 Batch status: ${count}/4 archivos validados`);

      return isComplete;
    } catch (err) {
      console.error('❌ Error verificando batch:', err);
      return false;
    }
  },

  // ============================================================================
  // Acción: clearError
  // ============================================================================
  /**
   * Limpia el mensaje de error global
   */
  clearError: () => {
    set({ error: null });
  },

  // ============================================================================
  // Helper: getFilesByType
  // ============================================================================
  /**
   * Obtiene todos los archivos de un tipo específico
   *
   * @param fileType - Tipo de archivo
   * @returns Array de archivos del tipo especificado
   *
   * @example
   * const alumnosFiles = getFilesByType('alumnos');
   */
  getFilesByType: (fileType: MasterFileType) => {
    const { files } = get();
    return files.filter((f) => f.file_type === fileType);
  },

  // ============================================================================
  // Helper: getFileByType
  // ============================================================================
  /**
   * Obtiene el primer archivo de un tipo específico en el batch actual
   *
   * @param fileType - Tipo de archivo
   * @returns Archivo o null si no existe
   *
   * @example
   * const alumnosFile = getFileByType('alumnos');
   */
  getFileByType: (fileType: MasterFileType) => {
    const { files, currentBatchId } = get();
    return (
      files.find(
        (f) => f.file_type === fileType && f.upload_batch_id === currentBatchId
      ) || null
    );
  },

  // ============================================================================
  // Helper: getBatchFiles
  // ============================================================================
  /**
   * Obtiene todos los archivos del batch actual
   *
   * @returns Array de archivos del batch actual
   */
  getBatchFiles: () => {
    const { files, currentBatchId } = get();
    return files.filter((f) => f.upload_batch_id === currentBatchId);
  },
}));

// ============================================================================
// Selectores útiles
// ============================================================================

/**
 * Selector para obtener el progreso de subida de un tipo específico
 */
export const useUploadProgress = (fileType?: MasterFileType) => {
  return useMasterFilesStore((state) => {
    if (!fileType) {
      return Array.from(state.uploadProgress.values());
    }

    return Array.from(state.uploadProgress.values()).filter(
      (p) => p.fileType === fileType
    );
  });
};

/**
 * Selector para verificar si hay subidas en progreso
 */
export const useHasActiveUploads = () => {
  return useMasterFilesStore((state) => state.uploadProgress.size > 0);
};

/**
 * Selector para obtener archivos del batch actual
 */
export const useCurrentBatchFiles = () => {
  return useMasterFilesStore((state) => state.getBatchFiles());
};

console.log('📦 Master Files Store con Zustand cargado');
