/**
 * Store de Archivos CEA con Zustand
 * ===================================
 * Maneja el estado de archivos CEA generados
 *
 * Funcionalidades:
 * - Listado de archivos CEA generados
 * - Obtención del CEA más reciente
 * - Generación de nuevos CEA desde batches validados
 * - Descarga de archivos CEA
 * - Historial de versiones
 */

import { create } from 'zustand';
import type { CeaFile } from '../types/database.types';
import {
  getAllCeas,
  getLatestCea,
  getCeaById,
  processCeaBatch,
} from '../utils/supabase/database';
import { downloadFile, getSignedUrl } from '../utils/supabase/storage';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Estado de procesamiento de CEA
 */
export interface ProcessingStatus {
  isProcessing: boolean;       // ¿Está procesando?
  progress: number;             // Progreso estimado (0-100)
  message: string;              // Mensaje de estado
  error?: string;               // Error si falló
}

/**
 * Estado del store de archivos CEA
 */
interface CeaFilesState {
  // Estado actual
  files: CeaFile[];                      // Lista de archivos CEA
  latestCea: CeaFile | null;             // CEA más reciente
  processingStatus: ProcessingStatus | null; // Estado de procesamiento
  isLoading: boolean;                    // ¿Cargando lista?
  error: string | null;                  // Error global

  // Acciones
  fetchFiles: () => Promise<void>;
  fetchLatest: () => Promise<void>;
  generateCea: (batchId: string) => Promise<void>;
  downloadCea: (ceaId: string) => Promise<void>;
  clearError: () => void;

  // Helpers
  getFileById: (ceaId: string) => CeaFile | null;
}

// ============================================================================
// Store de Zustand
// ============================================================================

/**
 * Store global de archivos CEA
 *
 * Uso:
 * ```tsx
 * import { useCeaStore } from '@/store/ceaStore';
 *
 * function Component() {
 *   const { latestCea, downloadCea, fetchLatest } = useCeaStore();
 *   // ...
 * }
 * ```
 */
export const useCeaStore = create<CeaFilesState>((set, get) => ({
  // ============================================================================
  // Estado inicial
  // ============================================================================
  files: [],
  latestCea: null,
  processingStatus: null,
  isLoading: false,
  error: null,

  // ============================================================================
  // Acción: fetchFiles
  // ============================================================================
  /**
   * Obtiene la lista completa de archivos CEA desde la base de datos
   *
   * @example
   * await fetchFiles();
   */
  fetchFiles: async () => {
    try {
      set({ isLoading: true, error: null });

      const { success, data, error } = await getAllCeas();

      if (!success || !data) {
        throw new Error(error || 'Error obteniendo archivos CEA');
      }

      set({
        files: data,
        isLoading: false,
        error: null,
      });

      console.log(`✅ ${data.length} archivos CEA cargados`);
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
  // Acción: fetchLatest
  // ============================================================================
  /**
   * Obtiene el archivo CEA más reciente (is_latest = true)
   *
   * @example
   * await fetchLatest();
   */
  fetchLatest: async () => {
    try {
      set({ isLoading: true, error: null });

      const { success, data, error } = await getLatestCea();

      if (!success) {
        throw new Error(error || 'Error obteniendo CEA más reciente');
      }

      set({
        latestCea: data || null,
        isLoading: false,
        error: null,
      });

      if (data) {
        console.log(`✅ CEA más reciente cargado: ${data.file_name}`);
      } else {
        console.log('ℹ️ No hay archivos CEA generados aún');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

      set({
        isLoading: false,
        error: errorMessage,
      });

      console.error('❌ Error en fetchLatest:', errorMessage);
      throw new Error(errorMessage);
    }
  },

  // ============================================================================
  // Acción: generateCea
  // ============================================================================
  /**
   * Genera un nuevo archivo CEA a partir de un batch de Masters validados
   *
   * Flujo:
   * 1. Verificar que el batch tenga 4 archivos validados
   * 2. Llamar a Edge Function process-cea
   * 3. Edge Function procesa con Danfo.js y genera Excel
   * 4. Actualizar estado cuando termine
   *
   * @param batchId - ID del batch de Masters a procesar
   *
   * @throws Error si el procesamiento falla
   *
   * @example
   * await generateCea('batch-123');
   */
  generateCea: async (batchId: string) => {
    try {
      // 1. Inicializar estado de procesamiento
      set({
        processingStatus: {
          isProcessing: true,
          progress: 0,
          message: 'Iniciando procesamiento...',
        },
        error: null,
      });

      console.log(`🚀 Iniciando generación de CEA para batch: ${batchId}`);

      // 2. Actualizar progreso: descargando Masters
      set({
        processingStatus: {
          isProcessing: true,
          progress: 20,
          message: 'Descargando archivos Master...',
        },
      });

      // 3. Llamar a Edge Function para procesar
      const result = await processCeaBatch(batchId);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Error procesando CEA');
      }

      // 4. Actualizar progreso: procesamiento completado
      set({
        processingStatus: {
          isProcessing: true,
          progress: 100,
          message: 'CEA generado exitosamente',
        },
      });

      console.log(`✅ CEA generado exitosamente: ${result.data.fileName}`);

      // 5. Recargar lista de archivos y último CEA
      await Promise.all([get().fetchFiles(), get().fetchLatest()]);

      // 6. Limpiar estado de procesamiento después de 3 segundos
      setTimeout(() => {
        set({ processingStatus: null });
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

      // Actualizar estado de error
      set({
        processingStatus: {
          isProcessing: false,
          progress: 0,
          message: 'Error',
          error: errorMessage,
        },
        error: errorMessage,
      });

      console.error('❌ Error en generateCea:', errorMessage);

      // Limpiar estado de procesamiento después de 5 segundos
      setTimeout(() => {
        set({ processingStatus: null });
      }, 5000);

      throw new Error(errorMessage);
    }
  },

  // ============================================================================
  // Acción: downloadCea
  // ============================================================================
  /**
   * Descarga un archivo CEA desde Storage
   *
   * @param ceaId - ID del archivo CEA en la BD
   *
   * @throws Error si la descarga falla
   *
   * @example
   * await downloadCea('cea-id-123');
   */
  downloadCea: async (ceaId: string) => {
    try {
      set({ error: null });

      // 1. Obtener información del archivo desde la BD
      const { success, data: ceaFile, error } = await getCeaById(ceaId);

      if (!success || !ceaFile) {
        throw new Error(error || 'Archivo CEA no encontrado');
      }

      console.log(`📥 Descargando CEA: ${ceaFile.file_name}`);

      // 2. Obtener URL firmada de Storage (válida por 15 minutos)
      const urlResult = await getSignedUrl('cea-files', ceaFile.file_path, 900);

      if (!urlResult.success || !urlResult.data) {
        throw new Error(urlResult.error || 'Error obteniendo URL de descarga');
      }

      // 3. Descargar archivo usando la URL firmada
      const link = document.createElement('a');
      link.href = urlResult.data.signedUrl;
      link.download = ceaFile.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log(`✅ Descarga iniciada: ${ceaFile.file_name}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

      set({ error: errorMessage });

      console.error('❌ Error en downloadCea:', errorMessage);
      throw new Error(errorMessage);
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
  // Helper: getFileById
  // ============================================================================
  /**
   * Obtiene un archivo CEA por su ID
   *
   * @param ceaId - ID del archivo
   * @returns Archivo o null si no existe
   *
   * @example
   * const cea = getFileById('cea-id-123');
   */
  getFileById: (ceaId: string) => {
    const { files } = get();
    return files.find((f) => f.id === ceaId) || null;
  },
}));

// ============================================================================
// Selectores útiles
// ============================================================================

/**
 * Selector para verificar si hay un procesamiento activo
 */
export const useIsProcessing = () => {
  return useCeaStore((state) => state.processingStatus?.isProcessing || false);
};

/**
 * Selector para obtener el progreso de procesamiento
 */
export const useProcessingProgress = () => {
  return useCeaStore((state) => state.processingStatus?.progress || 0);
};

/**
 * Selector para obtener el mensaje de procesamiento
 */
export const useProcessingMessage = () => {
  return useCeaStore((state) => state.processingStatus?.message || '');
};

console.log('📦 CEA Files Store con Zustand cargado');
