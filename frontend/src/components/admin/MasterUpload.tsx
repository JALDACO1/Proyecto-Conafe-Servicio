/**
 * Componente: MasterUpload
 * ==========================
 * Panel de administrador para subir archivos Master
 *
 * Características:
 * - 4 zonas de upload (una por cada tipo de Master)
 * - Integración con masterFilesStore
 * - Validación automática de archivos
 * - Estado de progreso en tiempo real
 * - Modal de ayuda con nomenclatura
 */

import * as React from 'react';
import { useMasterFilesStore } from '@/store/masterFilesStore';
import { FileUploadZone } from '../shared/FileUploadZone';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCeaStore } from '@/store/ceaStore';
import { Spinner } from '@/components/ui/spinner';
import { useMasterUploadsRealtime } from '@/hooks/useRealtime';
import { supabase } from '@/utils/supabase/client';
import type { MasterFileType } from '@/types/database.types';

// ============================================================================
// Constantes
// ============================================================================

/**
 * Tipos de archivos Master requeridos
 */
const MASTER_FILE_TYPES: MasterFileType[] = [
  'servicios',
  'figuras',
  'alumnos',
];

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Panel de subida de archivos Master
 */
export const MasterUpload: React.FC = () => {
  // ============================================================================
  // Estado del store
  // ============================================================================
  const {
    uploadMasterFile,
    getFileByType,
    deleteFile,
    currentBatchId,
    cicloEscolar,
    setCicloEscolar,
    createNewBatch,
    fetchFiles,
    error: storeError,
    clearError,
    uploadProgress,
    files,
  } = useMasterFilesStore();

  // ============================================================================
  // Estado del store CEA
  // ============================================================================
  const { generateCea, processingStatus } = useCeaStore();

  // ============================================================================
  // Derivar canProcess del estado real de la BD
  // ============================================================================
  // El CEA se genera a partir de los datos en la BD, no de los archivos. El
  // botón se habilita siempre que existan CCT activos para el ciclo, sin
  // importar si los Masters fueron subidos en esta sesión o ya estaban
  // cargados desde antes. Subir los Masters sólo sirve para actualizar la BD.
  const [hasDataInDb, setHasDataInDb] = React.useState(false);
  const [dbCounts, setDbCounts] = React.useState<{ ccts: number; figuras: number; alumnos: number }>({
    ccts: 0, figuras: 0, alumnos: 0,
  });

  const refreshDbCounts = React.useCallback(async () => {
    const [{ count: cctsCount }, { count: figurasCount }, { count: alumnosCount }] = await Promise.all([
      supabase.from('ccts').select('cct', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('figuras').select('numero_control', { count: 'exact', head: true }).eq('ciclo_escolar', cicloEscolar),
      supabase.from('alumnos').select('id_alumno', { count: 'exact', head: true })
        .eq('ciclo_escolar', cicloEscolar).is('baja', null),
    ]);
    const ccts = cctsCount ?? 0;
    const figuras = figurasCount ?? 0;
    const alumnos = alumnosCount ?? 0;
    setDbCounts({ ccts, figuras, alumnos });
    setHasDataInDb(ccts > 0);
  }, [cicloEscolar]);

  React.useEffect(() => {
    refreshDbCounts().catch((err) => console.error('refreshDbCounts:', err));
  }, [refreshDbCounts, files]);

  const canProcess = hasDataInDb;

  // ============================================================================
  // Realtime: escuchar cambios de status en master_uploads
  // ============================================================================
  const handleRealtimeUpdate = React.useCallback(() => {
    // Cuando un archivo cambia de status (ej: uploaded → validated), refrescar lista
    if (currentBatchId) {
      fetchFiles(currentBatchId);
    }
  }, [currentBatchId, fetchFiles]);

  useMasterUploadsRealtime({
    onUpdate: handleRealtimeUpdate,
    enabled: !!currentBatchId,
  });

  // ============================================================================
  // Cargar archivos al montar o cambiar de ciclo
  // ============================================================================
  // Cargamos TODOS los archivos para que el botón "Generar CEA" se habilite
  // aunque los Masters hayan sido ingeridos en sesiones anteriores. La nueva
  // edge function process-cea trabaja por ciclo escolar, no por batch.
  React.useEffect(() => {
    fetchFiles();
  }, [fetchFiles, cicloEscolar]);

  // ============================================================================
  // Manejadores
  // ============================================================================

  /**
   * Maneja la selección de un archivo
   */
  const handleFileSelect = async (file: File, fileType: MasterFileType) => {
    try {
      await uploadMasterFile(file, fileType);
    } catch (err) {
      console.error('Error subiendo archivo:', err);
    }
  };

  /**
   * Maneja la eliminación de un archivo
   */
  const handleFileDelete = async (fileType: MasterFileType) => {
    const file = getFileByType(fileType);
    if (file) {
      try {
        await deleteFile(file.id);
      } catch (err) {
        console.error('Error eliminando archivo:', err);
      }
    }
  };

  /**
   * Maneja la generación de CEA
   */
  const handleGenerateCea = async () => {
    try {
      // generateCea acepta cicloEscolar (la nueva edge function lo requiere).
      // El segundo argumento opcional es el currentBatchId para trazabilidad.
      await generateCea(cicloEscolar, currentBatchId ?? undefined);
    } catch (err) {
      console.error('Error generando CEA:', err);
    }
  };

  /**
   * Maneja la creación de un nuevo batch
   */
  const handleNewBatch = () => {
    if (confirm('¿Estás seguro? Esto limpiará todos los archivos actuales.')) {
      createNewBatch();
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Actualizar Base de Datos
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Subir los 3 archivos Master (Servicios, Figuras, Alumnos) actualiza
            la base de datos del ciclo seleccionado. <strong>No es obligatorio
            subirlos</strong> para generar un CEA: si ya hay datos en la BD,
            puedes generarlo directamente.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Botón de ayuda */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Ayuda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nomenclatura de Archivos Master</DialogTitle>
                <DialogDescription>
                  Guía de nombres correctos para cada tipo de archivo
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">
                    📋 Master de Alumnos
                  </h4>
                  <p className="text-sm text-blue-800 mb-2">
                    El nombre debe contener: <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">&quot;alumno&quot;</span> o <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">&quot;alumnos&quot;</span>
                  </p>
                  <p className="text-xs text-blue-700">
                    ✅ Ejemplos válidos: <span className="font-mono">Master_Alumnos_2024.xlsx</span>, <span className="font-mono">alumnos-enero.xlsx</span>
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">
                    🏫 Master de Servicios
                  </h4>
                  <p className="text-sm text-green-800 mb-2">
                    El nombre debe contener: <span className="font-mono bg-green-100 px-2 py-0.5 rounded">&quot;servicio&quot;</span> o <span className="font-mono bg-green-100 px-2 py-0.5 rounded">&quot;servicios&quot;</span>
                  </p>
                  <p className="text-xs text-green-700">
                    ✅ Ejemplos válidos: <span className="font-mono">Master_Servicios_2024.xlsx</span>, <span className="font-mono">servicios.xlsx</span>
                  </p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-2">
                    👥 Master de Figuras
                  </h4>
                  <p className="text-sm text-purple-800 mb-2">
                    El nombre debe contener: <span className="font-mono bg-purple-100 px-2 py-0.5 rounded">&quot;figura&quot;</span> o <span className="font-mono bg-purple-100 px-2 py-0.5 rounded">&quot;figuras&quot;</span>
                  </p>
                  <p className="text-xs text-purple-700">
                    ✅ Ejemplos válidos: <span className="font-mono">Master_Figuras_Educativas.xlsx</span>, <span className="font-mono">figuras-2024.xlsx</span>
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Botón nuevo batch */}
          <Button variant="outline" size="sm" onClick={handleNewBatch}>
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Nuevo Batch
          </Button>
        </div>
      </div>

      {/* Error global */}
      {storeError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{storeError}</span>
            <button
              onClick={clearError}
              className="text-red-900 hover:text-red-700"
            >
              ✕
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Información del batch + ciclo escolar */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-gray-700">
              Batch ID actual
            </p>
            <p className="text-xs text-gray-500 font-mono mt-1">
              {currentBatchId}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="ciclo-escolar"
              className="text-sm font-medium text-gray-700 whitespace-nowrap"
            >
              Ciclo escolar:
            </label>
            <input
              id="ciclo-escolar"
              type="text"
              value={cicloEscolar}
              onChange={(e) => setCicloEscolar(e.target.value)}
              placeholder="2024-2025"
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono w-32 focus:outline-none focus:ring-2 focus:ring-conafe-verde"
            />
          </div>

          {/* Estado de la BD para el ciclo */}
          <Badge variant={canProcess ? 'success' : 'secondary'}>
            {canProcess
              ? `✓ BD lista (${dbCounts.ccts} CCT)`
              : 'Sin datos en BD'}
          </Badge>
        </div>
      </div>

      {/* Grid de zonas de upload */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MASTER_FILE_TYPES.map((fileType) => {
          const existingFile = getFileByType(fileType);
          const progress = Array.from(uploadProgress.values()).find((p) => p.fileType === fileType);

          return (
            <div key={fileType} className="space-y-2">
              <FileUploadZone
                fileType={fileType}
                onFileSelect={(file) => handleFileSelect(file, fileType)}
                isUploading={progress?.status === 'uploading' || progress?.status === 'validating'}
                progress={progress?.progress || 0}
                existingFile={existingFile?.file_name}
              />

              {/* Botón de eliminar si existe archivo */}
              {existingFile && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {/* Badge de estado */}
                    {existingFile.status === 'ingested' && (
                      <Badge variant="success">Ingerido</Badge>
                    )}
                    {existingFile.status === 'validated' && (
                      <Badge variant="success">Validado</Badge>
                    )}
                    {existingFile.status === 'uploaded' && (
                      <Badge variant="secondary">Subido</Badge>
                    )}
                    {existingFile.status === 'ingesting' && (
                      <Badge variant="default">Ingiriendo...</Badge>
                    )}
                    {existingFile.status === 'validating' && (
                      <Badge variant="default">Validando...</Badge>
                    )}
                    {existingFile.status === 'error' && (
                      <Badge variant="destructive">Error</Badge>
                    )}

                    {/* Tamaño del archivo */}
                    <span className="text-xs text-gray-500">
                      {(existingFile.file_size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFileDelete(fileType)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <svg
                      className="h-4 w-4 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Eliminar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botón Generar CEA */}
      <div className="bg-white border border-conafe-gris-300 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Generar CEA</h3>
            <p className="text-sm text-gray-600 mt-1">
              {canProcess
                ? `Datos disponibles para el ciclo ${cicloEscolar}: ${dbCounts.ccts} CCT activos, ${dbCounts.figuras} figuras, ${dbCounts.alumnos} alumnos.`
                : `No hay datos en la base de datos para el ciclo ${cicloEscolar}. Sube los Masters para cargarlos.`}
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleGenerateCea}
            disabled={!canProcess || processingStatus?.isProcessing}
            className="bg-conafe-verde hover:bg-conafe-verde/90 text-white px-6"
          >
            {processingStatus?.isProcessing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                {processingStatus.message || 'Procesando...'}
              </>
            ) : (
              <>
                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Generar CEA
              </>
            )}
          </Button>
        </div>
        {processingStatus?.isProcessing && (
          <div className="px-6 pb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-conafe-verde h-2 rounded-full transition-all duration-500"
                style={{ width: `${processingStatus.progress}%` }}
              />
            </div>
          </div>
        )}
        {processingStatus?.error && (
          <div className="px-6 pb-4">
            <p className="text-sm text-red-600">{processingStatus.error}</p>
          </div>
        )}
      </div>

      {/* Instrucciones */}
      <Alert>
        <AlertTitle>📌 Instrucciones</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Verifica el <strong>ciclo escolar</strong> antes de operar.</li>
            <li>Si quieres actualizar la base de datos, sube los Masters (Servicios, Figuras, Alumnos). Cada uno se ingiere automáticamente.</li>
            <li>Para generar el CEA basta con que la BD tenga datos del ciclo: presiona <strong>Generar CEA</strong> cuando estés listo.</li>
            <li>Subir Masters es opcional: si la BD ya tiene datos cargados antes, puedes generar el CEA sin volver a subir nada.</li>
          </ol>
        </AlertDescription>
      </Alert>
    </div>
  );
};
