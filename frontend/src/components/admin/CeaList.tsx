/**
 * Componente: CeaList
 * ====================
 * Lista de archivos CEA generados con opción de descarga
 *
 * Características:
 * - Tabla de archivos CEA
 * - Indicador del más reciente
 * - Botón de descarga
 * - Estado de procesamiento
 * - Información de versión y estadísticas
 */

import * as React from 'react';
import { useCeaStore, useIsProcessing, useProcessingMessage } from '@/store/ceaStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Lista de archivos CEA generados
 */
export const CeaList: React.FC = () => {
  // ============================================================================
  // Estado del store
  // ============================================================================
  const {
    files,
    latestCea,
    fetchFiles,
    fetchLatest,
    downloadCea,
    isLoading,
    error,
    clearError,
  } = useCeaStore();

  const isProcessing = useIsProcessing();
  const processingMessage = useProcessingMessage();

  // ============================================================================
  // Efectos
  // ============================================================================

  /**
   * Cargar archivos al montar el componente
   */
  React.useEffect(() => {
    fetchFiles();
    fetchLatest();
  }, [fetchFiles, fetchLatest]);

  // ============================================================================
  // Manejadores
  // ============================================================================

  /**
   * Maneja la descarga de un archivo CEA
   */
  const handleDownload = async (ceaId: string) => {
    try {
      await downloadCea(ceaId);
    } catch (err) {
      console.error('Error descargando CEA:', err);
    }
  };

  /**
   * Formatea el tamaño del archivo
   */
  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  /**
   * Formatea la fecha
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  /**
   * Formatea el tiempo de procesamiento
   */
  const formatProcessingTime = (ms: number | null): string => {
    if (!ms) return 'N/A';

    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      return `${(ms / 60000).toFixed(1)}min`;
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  // Estado de procesamiento activo
  if (isProcessing) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Spinner size="lg" />
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">
                Generando CEA...
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {processingMessage}
              </p>
              <p className="text-xs text-gray-500 mt-3">
                Este proceso puede tomar varios minutos dependiendo del tamaño de los archivos Master
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado de carga
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <Spinner size="lg" text="Cargando archivos CEA..." />
        </CardContent>
      </Card>
    );
  }

  // Sin archivos CEA
  if (files.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Archivos CEA Generados</CardTitle>
          <CardDescription>
            Lista de reportes CEA disponibles para descarga
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
              <svg
                className="h-8 w-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay archivos CEA
            </h3>
            <p className="text-gray-600">
              Sube 4 archivos Master validados y genera tu primer CEA
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Lista de archivos
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Archivos CEA Generados</CardTitle>
            <CardDescription>
              {files.length} archivo{files.length !== 1 ? 's' : ''} disponible{files.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>

          {/* Botón refrescar */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchFiles();
              fetchLatest();
            }}
          >
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refrescar
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={clearError}
                className="text-red-900 hover:text-red-700"
              >
                ✕
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabla de archivos */}
        <div className="space-y-3">
          {files.map((cea) => (
            <div
              key={cea.id}
              className={`border rounded-lg p-4 transition-all ${
                cea.is_latest
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                {/* Información del archivo */}
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-base font-semibold text-gray-900">
                      {cea.file_name}
                    </h4>

                    {/* Badge de más reciente */}
                    {cea.is_latest && (
                      <Badge variant="default">Más reciente</Badge>
                    )}

                    {/* Badge de estado */}
                    {cea.processing_status === 'completed' && (
                      <Badge variant="success">Completado</Badge>
                    )}
                    {cea.processing_status === 'processing' && (
                      <Badge variant="default">Procesando...</Badge>
                    )}
                    {cea.processing_status === 'failed' && (
                      <Badge variant="destructive">Error</Badge>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
                    <div>
                      <span className="text-gray-500">Fecha:</span>{' '}
                      {formatDate(cea.created_at)}
                    </div>
                    <div>
                      <span className="text-gray-500">Tamaño:</span>{' '}
                      {formatFileSize(cea.file_size)}
                    </div>
                    <div>
                      <span className="text-gray-500">Registros:</span>{' '}
                      {cea.total_records || 'N/A'}
                    </div>
                    <div>
                      <span className="text-gray-500">Tiempo:</span>{' '}
                      {formatProcessingTime(cea.processing_time_ms)}
                    </div>
                  </div>
                </div>

                {/* Botón de descarga */}
                <Button
                  onClick={() => handleDownload(cea.id)}
                  disabled={cea.processing_status !== 'completed'}
                  size="sm"
                >
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Descargar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
