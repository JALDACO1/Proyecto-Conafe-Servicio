/**
 * Componente: HistorialMasters
 * ==============================
 * Historial de archivos Master subidos con diseño estilo Explorador de Archivos
 *
 * Características:
 * - Lista todos los Masters subidos (todos los batches)
 * - Selección múltiple para descarga/eliminación masiva
 * - Descarga y eliminación individual
 * - Ordenamiento por columnas
 * - Diseño tipo Windows File Explorer con colores CONAFE
 */

import * as React from 'react';
import { getMasterUploads, deleteMasterUpload } from '@/utils/supabase/database';
import { deleteFile as deleteStorageFile, getSignedUrl } from '@/utils/supabase/storage';
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
import type { MasterUpload, MasterFileType } from '@/types/database.types';

// ============================================================================
// Tipos
// ============================================================================

type SortField = 'file_name' | 'file_type' | 'file_size' | 'created_at' | 'status';

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

const FILE_TYPE_LABELS: Record<MasterFileType, string> = {
  alumnos: 'Alumnos',
  servicios: 'Servicios',
  figuras: 'Figuras',
  telefonia: 'Telefonía',
};

const FILE_TYPE_COLORS: Record<MasterFileType, string> = {
  alumnos: 'bg-conafe-guinda/10 text-conafe-guinda border-conafe-guinda/20',
  servicios: 'bg-conafe-verde/10 text-conafe-verde border-conafe-verde/20',
  figuras: 'bg-conafe-azul/10 text-conafe-azul border-conafe-azul/20',
  telefonia: 'bg-conafe-ambar/10 text-amber-700 border-conafe-ambar/20',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'secondary' }> = {
  uploaded: { label: 'Subido', variant: 'secondary' },
  validating: { label: 'Validando...', variant: 'default' },
  validated: { label: 'Validado', variant: 'success' },
  error: { label: 'Error', variant: 'destructive' },
};

// ============================================================================
// Componente Principal
// ============================================================================

export const HistorialMasters: React.FC = () => {
  // Estado local
  const [files, setFiles] = React.useState<MasterUpload[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<MasterUpload | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [sortField, setSortField] = React.useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Cargar archivos
  const loadFiles = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getMasterUploads();
      if (result.success && result.data) {
        setFiles(result.data);
      } else {
        setError(result.error || 'Error cargando archivos');
      }
    } catch {
      setError('Error inesperado al cargar archivos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Ordenamiento
  const sortedFiles = React.useMemo(() => {
    const sorted = [...files].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'file_name':
          comparison = a.file_name.localeCompare(b.file_name);
          break;
        case 'file_type':
          comparison = a.file_type.localeCompare(b.file_type);
          break;
        case 'file_size':
          comparison = a.file_size - b.file_size;
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
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
  const handleDownload = async (file: MasterUpload) => {
    try {
      const urlResult = await getSignedUrl('master-files', file.file_path, 900);
      if (!urlResult.success || !urlResult.data) {
        setError(urlResult.error || 'Error obteniendo URL de descarga');
        return;
      }
      const link = document.createElement('a');
      link.href = urlResult.data.signedUrl;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setError('Error al descargar el archivo');
    }
  };

  // Descarga masiva
  const handleBulkDownload = async () => {
    for (const file of selectedFiles) {
      await handleDownload(file);
      // Pequeña pausa entre descargas para que el navegador las procese
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  // Eliminación individual
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setIsDeleting(true);
      await deleteStorageFile('master-files', deleteConfirm.file_path);
      const result = await deleteMasterUpload(deleteConfirm.id);
      if (!result.success) {
        setError(result.error || 'Error eliminando archivo');
        return;
      }
      setDeleteConfirm(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteConfirm.id);
        return next;
      });
      await loadFiles();
    } catch {
      setError('Error al eliminar el archivo');
    } finally {
      setIsDeleting(false);
    }
  };

  // Eliminación masiva
  const confirmBulkDelete = async () => {
    try {
      setIsDeleting(true);
      for (const file of selectedFiles) {
        await deleteStorageFile('master-files', file.file_path);
        await deleteMasterUpload(file.id);
      }
      setBulkDeleteConfirm(false);
      setSelectedIds(new Set());
      await loadFiles();
    } catch {
      setError('Error al eliminar archivos');
    } finally {
      setIsDeleting(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 ml-1 text-conafe-gris-600/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-3 h-3 ml-1 text-conafe-guinda" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3 h-3 ml-1 text-conafe-guinda" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // ============================================================================
  // Render: Loading
  // ============================================================================
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-conafe-gris-300 p-12">
        <Spinner size="lg" text="Cargando historial de Masters..." />
      </div>
    );
  }

  // ============================================================================
  // Render: Principal
  // ============================================================================
  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl border border-conafe-gris-300 overflow-hidden">
        {/* Barra de título - estilo Explorer */}
        <div className="bg-gradient-to-r from-conafe-guinda to-conafe-guinda-dark px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white">Historial de Archivos Master</h2>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-white/80">{files.length} archivos</span>
            <Button
              variant="outline"
              size="sm"
              onClick={loadFiles}
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
          <div className="bg-conafe-guinda/5 px-6 py-2 border-b border-conafe-gris-300 flex items-center justify-between">
            <span className="text-sm font-medium text-conafe-guinda">
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
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-sm font-bold">
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-conafe-gris-900 mb-2">No hay archivos Master subidos</h3>
            <p className="text-conafe-gris-600 text-sm">Los archivos Master aparecerán aquí después de subirlos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-conafe-guinda/5 border-b border-conafe-gris-300">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === files.length && files.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-conafe-gris-300 text-conafe-guinda focus:ring-conafe-guinda"
                    />
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('file_name')} className="flex items-center text-xs font-semibold text-conafe-gris-900 uppercase tracking-wider hover:text-conafe-guinda">
                      Nombre <SortIcon field="file_name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('file_type')} className="flex items-center text-xs font-semibold text-conafe-gris-900 uppercase tracking-wider hover:text-conafe-guinda">
                      Tipo <SortIcon field="file_type" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('file_size')} className="flex items-center text-xs font-semibold text-conafe-gris-900 uppercase tracking-wider hover:text-conafe-guinda">
                      Tamaño <SortIcon field="file_size" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('created_at')} className="flex items-center text-xs font-semibold text-conafe-gris-900 uppercase tracking-wider hover:text-conafe-guinda">
                      Fecha <SortIcon field="created_at" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort('status')} className="flex items-center text-xs font-semibold text-conafe-gris-900 uppercase tracking-wider hover:text-conafe-guinda">
                      Estado <SortIcon field="status" />
                    </button>
                  </th>
                  <th className="text-right px-6 py-3">
                    <span className="text-xs font-semibold text-conafe-gris-900 uppercase tracking-wider">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFiles.map((file) => {
                  const statusConfig = STATUS_CONFIG[file.status] || STATUS_CONFIG.uploaded;
                  const isSelected = selectedIds.has(file.id);
                  return (
                    <tr
                      key={file.id}
                      className={`border-b border-conafe-gris-100 transition-colors ${isSelected ? 'bg-conafe-guinda/5' : 'hover:bg-conafe-verde-light/30'}`}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(file.id)}
                          className="w-4 h-4 rounded border-conafe-gris-300 text-conafe-guinda focus:ring-conafe-guinda"
                        />
                      </td>
                      {/* Nombre */}
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-conafe-verde/10 rounded flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-conafe-verde" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <span className="font-medium text-conafe-gris-900 text-sm truncate max-w-xs" title={file.file_name}>
                            {file.file_name}
                          </span>
                        </div>
                      </td>
                      {/* Tipo */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${FILE_TYPE_COLORS[file.file_type]}`}>
                          {FILE_TYPE_LABELS[file.file_type]}
                        </span>
                      </td>
                      {/* Tamaño */}
                      <td className="px-4 py-3 text-sm text-conafe-gris-600">
                        {formatFileSize(file.file_size)}
                      </td>
                      {/* Fecha */}
                      <td className="px-4 py-3 text-sm text-conafe-gris-600">
                        {formatDate(file.created_at)}
                      </td>
                      {/* Estado */}
                      <td className="px-4 py-3">
                        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                      </td>
                      {/* Acciones */}
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(file)}
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
                            onClick={() => setDeleteConfirm(file)}
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
            <DialogTitle>Eliminar archivo Master</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar <strong>{deleteConfirm?.file_name}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
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
