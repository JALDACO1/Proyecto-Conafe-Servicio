/**
 * Componente: HistorialCea
 * =========================
 * Historial de archivos CEA generados con diseño estilo Explorador de Archivos
 *
 * Características:
 * - Lista todos los CEA generados
 * - Selección múltiple para descarga/eliminación masiva
 * - Descarga y eliminación individual
 * - Ordenamiento por columnas
 * - Indicador de "Más reciente"
 * - Diseño tipo Windows File Explorer con colores CONAFE
 */

import * as React from 'react';
import { useCeaStore } from '@/store/ceaStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { CeaFile } from '@/types/database.types';

// ============================================================================
// Tipos
// ============================================================================

type SortField = 'file_name' | 'file_size' | 'created_at' | 'processing_status' | 'total_records';

// ============================================================================
// Helpers
// ============================================================================

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' }> = {
  processing: { label: 'Procesando...', variant: 'default' },
  completed: { label: 'Completado', variant: 'success' },
  failed: { label: 'Error', variant: 'destructive' },
};

// ============================================================================
// Componente Principal
// ============================================================================

export const HistorialCea: React.FC = () => {
  // Estado del store
  const {
    files,
    fetchFiles,
    fetchLatest,
    downloadCea,
    deleteCea,
    isLoading,
    error,
    clearError,
  } = useCeaStore();

  // Estado local
  const [deleteConfirm, setDeleteConfirm] = React.useState<CeaFile | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [sortField, setSortField] = React.useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Cargar archivos
  React.useEffect(() => {
    fetchFiles();
    fetchLatest();
  }, [fetchFiles, fetchLatest]);

  // Ordenamiento
  const sortedFiles = React.useMemo(() => {
    const sorted = [...files].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'file_name':
          comparison = a.file_name.localeCompare(b.file_name);
          break;
        case 'file_size':
          comparison = a.file_size - b.file_size;
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'processing_status':
          comparison = a.processing_status.localeCompare(b.processing_status);
          break;
        case 'total_records':
          comparison = (a.total_records || 0) - (b.total_records || 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [files, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Selección
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  };

  const selectedFiles = files.filter((f) => selectedIds.has(f.id));

  // Descarga individual
  const handleDownload = async (ceaId: string) => {
    try {
      await downloadCea(ceaId);
    } catch {
      // Error manejado en el store
    }
  };

  // Descarga masiva
  const handleBulkDownload = async () => {
    const downloadable = selectedFiles.filter((f) => f.processing_status === 'completed');
    for (const file of downloadable) {
      await handleDownload(file.id);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  // Eliminación individual
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setIsDeleting(true);
      await deleteCea(deleteConfirm.id);
      setDeleteConfirm(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteConfirm.id);
        return next;
      });
    } catch {
      // Error manejado en el store
    } finally {
      setIsDeleting(false);
    }
  };

  // Eliminación masiva
  const confirmBulkDelete = async () => {
    try {
      setIsDeleting(true);
      for (const file of selectedFiles) {
        await deleteCea(file.id);
      }
      setBulkDeleteConfirm(false);
      setSelectedIds(new Set());
    } catch {
      // Error manejado en el store
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = () => {
    fetchFiles();
    fetchLatest();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 ml-1 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-3 h-3 ml-1 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3 h-3 ml-1 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // ============================================================================
  // Render: Loading
  // ============================================================================
  if (isLoading && files.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-conafe-gris-300 p-12">
        <Spinner size="lg" text="Cargando historial de CEA..." />
      </div>
    );
  }

  // ============================================================================
  // Render: Principal
  // ============================================================================
  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl border border-conafe-gris-300 overflow-hidden">
        {/* Barra de título - estilo Explorer con azul CONAFE */}
        <div className="bg-gradient-to-r from-conafe-azul to-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white">Historial de Archivos CEA</h2>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-white/80">{files.length} archivos</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="border-white/30 text-white hover:bg-white/10 bg-transparent"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refrescar
            </Button>
          </div>
        </div>

        {/* Barra de acciones masivas */}
        {selectedIds.size > 0 && (
          <div className="bg-conafe-azul/5 px-6 py-2 border-b border-conafe-gris-300 flex items-center justify-between">
            <span className="text-sm font-medium text-conafe-azul">
              {selectedIds.size} archivo{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="outline" onClick={handleBulkDownload} className="h-7 text-xs text-conafe-azul border-conafe-azul/30 hover:bg-conafe-azul/10">
                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar seleccionados
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkDeleteConfirm(true)} className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50">
                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar seleccionados
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="h-7 text-xs text-conafe-gris-600">
                Deseleccionar
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-700">{error}</span>
              <button onClick={clearError} className="text-red-500 hover:text-red-700 text-sm font-bold">
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Tabla o estado vacío */}
        {files.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-conafe-gris-100 mb-4">
              <svg className="h-8 w-8 text-conafe-gris-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-conafe-gris-900 mb-2">No hay archivos CEA generados</h3>
            <p className="text-conafe-gris-600 text-sm">Los archivos CEA aparecerán aquí después de procesarlos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-conafe-azul/5 border-b border-conafe-gris-300">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === files.length && files.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-conafe-gris-300 text-conafe-azul focus:ring-conafe-azul"
                    />
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('file_name')} className="flex items-center text-xs font-semibold text-conafe-gris-900 uppercase tracking-wider hover:text-conafe-azul">
                      Nombre <SortIcon field="file_name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('file_size')} className="flex items-center text-xs font-semibold text-conafe-gris-900 uppercase tracking-wider hover:text-conafe-azul">
                      Tamaño <SortIcon field="file_size" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('created_at')} className="flex items-center text-xs font-semibold text-conafe-gris-900 uppercase tracking-wider hover:text-conafe-azul">
                      Fecha <SortIcon field="created_at" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('processing_status')} className="flex items-center text-xs font-semibold text-conafe-gris-900 uppercase tracking-wider hover:text-conafe-azul">
                      Estado <SortIcon field="processing_status" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('total_records')} className="flex items-center text-xs font-semibold text-conafe-gris-900 uppercase tracking-wider hover:text-conafe-azul">
                      Registros <SortIcon field="total_records" />
                    </button>
                  </th>
                  <th className="text-right px-6 py-3">
                    <span className="text-xs font-semibold text-conafe-gris-900 uppercase tracking-wider">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFiles.map((cea) => {
                  const statusConfig = STATUS_CONFIG[cea.processing_status] || STATUS_CONFIG.processing;
                  const isSelected = selectedIds.has(cea.id);
                  return (
                    <tr
                      key={cea.id}
                      className={`border-b border-conafe-gris-100 transition-colors ${isSelected ? 'bg-conafe-azul/5' : 'hover:bg-blue-50/50'}`}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(cea.id)}
                          className="w-4 h-4 rounded border-conafe-gris-300 text-conafe-azul focus:ring-conafe-azul"
                        />
                      </td>
                      {/* Nombre */}
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-conafe-azul/10 rounded flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-conafe-azul" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-conafe-gris-900 text-sm truncate max-w-xs" title={cea.file_name}>
                              {cea.file_name}
                            </span>
                            {cea.is_latest && (
                              <Badge variant="default" className="bg-conafe-ambar text-white text-[10px] px-1.5 py-0">
                                Más reciente
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Tamaño */}
                      <td className="px-4 py-3 text-sm text-conafe-gris-600">
                        {formatFileSize(cea.file_size)}
                      </td>
                      {/* Fecha */}
                      <td className="px-4 py-3 text-sm text-conafe-gris-600">
                        {formatDate(cea.created_at)}
                      </td>
                      {/* Estado */}
                      <td className="px-4 py-3">
                        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                      </td>
                      {/* Registros */}
                      <td className="px-4 py-3 text-sm text-conafe-gris-600">
                        {cea.total_records != null ? cea.total_records.toLocaleString('es-MX') : 'N/A'}
                      </td>
                      {/* Acciones */}
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(cea.id)}
                            disabled={cea.processing_status !== 'completed'}
                            className="text-conafe-azul hover:bg-conafe-azul/10 h-8 px-2"
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Descargar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(cea)}
                            className="text-red-600 hover:bg-red-50 h-8 px-2"
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Barra de estado - estilo Explorer */}
        {files.length > 0 && (
          <div className="bg-conafe-gris-100 px-6 py-2 border-t border-conafe-gris-300 flex items-center justify-between">
            <span className="text-xs text-conafe-gris-600">
              {selectedIds.size > 0
                ? `${selectedIds.size} de ${files.length} seleccionado${selectedIds.size !== 1 ? 's' : ''}`
                : `${files.length} elemento${files.length !== 1 ? 's' : ''}`}
            </span>
            <span className="text-xs text-conafe-gris-600">
              Tamaño total: {formatFileSize(files.reduce((sum, f) => sum + f.file_size, 0))}
            </span>
          </div>
        )}
      </div>

      {/* Dialog de confirmación de eliminación individual */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar archivo CEA</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar <strong>{deleteConfirm?.file_name}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de eliminación masiva */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={(open) => !open && setBulkDeleteConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar archivos seleccionados</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar <strong>{selectedIds.size} archivo{selectedIds.size !== 1 ? 's' : ''}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteConfirm(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={isDeleting}>
              {isDeleting ? 'Eliminando...' : `Eliminar ${selectedIds.size} archivo${selectedIds.size !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
