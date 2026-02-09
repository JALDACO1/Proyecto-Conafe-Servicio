/**
 * Componente: FileUploadZone
 * ============================
 * Zona de arrastrar y soltar (drag & drop) para subir archivos
 *
 * Características:
 * - Drag & drop de archivos
 * - Click para seleccionar archivo
 * - Validación de tipo y tamaño
 * - Estados visuales (idle, hover, uploading)
 * - Indicador de progreso
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { MasterFileType } from '@/types/database.types';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Props del componente FileUploadZone
 */
export interface FileUploadZoneProps {
  fileType: MasterFileType;              // Tipo de archivo esperado
  onFileSelect: (file: File) => void;    // Callback cuando se selecciona un archivo
  isUploading?: boolean;                 // ¿Está subiendo?
  progress?: number;                     // Progreso de subida (0-100)
  disabled?: boolean;                    // ¿Deshabilitado?
  existingFile?: string;                 // Nombre del archivo ya subido
  maxSizeMB?: number;                    // Tamaño máximo en MB (default: 50)
}

// ============================================================================
// Constantes
// ============================================================================

/**
 * Mapeo de tipos de archivo a etiquetas legibles
 */
const FILE_TYPE_LABELS: Record<MasterFileType, string> = {
  alumnos: 'Master de Alumnos',
  servicios: 'Master de Servicios',
  figuras: 'Master de Figuras',
  telefonia: 'Master de Telefonía',
};

/**
 * Palabras clave que debe contener el nombre del archivo
 */
const FILE_TYPE_KEYWORDS: Record<MasterFileType, string[]> = {
  alumnos: ['alumno', 'alumnos'],
  servicios: ['servicio', 'servicios'],
  figuras: ['figura', 'figuras'],
  telefonia: ['telefon', 'telefonia'],
};

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Zona de drag & drop para subir archivos Master
 *
 * @example
 * <FileUploadZone
 *   fileType="alumnos"
 *   onFileSelect={(file) => console.log('Archivo seleccionado:', file)}
 *   isUploading={false}
 * />
 */
export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  fileType,
  onFileSelect,
  isUploading = false,
  progress = 0,
  disabled = false,
  existingFile,
  maxSizeMB = 50,
}) => {
  // ============================================================================
  // Estado local
  // ============================================================================
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ============================================================================
  // Manejadores de eventos
  // ============================================================================

  /**
   * Valida que el archivo cumpla con los requisitos
   */
  const validateFile = (file: File): string | null => {
    // 1. Verificar extensión
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
      return 'El archivo debe ser un Excel (.xlsx o .xls)';
    }

    // 2. Verificar tamaño
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      return `El archivo debe ser menor a ${maxSizeMB}MB (actual: ${fileSizeMB.toFixed(1)}MB)`;
    }

    // 3. Verificar que el nombre contenga las palabras clave
    const fileName = file.name.toLowerCase();
    const keywords = FILE_TYPE_KEYWORDS[fileType];
    const hasKeyword = keywords.some((keyword) => fileName.includes(keyword));

    if (!hasKeyword) {
      return `El nombre del archivo debe contener: "${keywords.join('" o "')}"`;
    }

    return null;
  };

  /**
   * Maneja la selección de archivo (drag o click)
   */
  const handleFile = (file: File) => {
    setError(null);

    // Validar archivo
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Archivo válido, notificar al padre
    onFileSelect(file);
  };

  /**
   * Handler: Drag over
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  /**
   * Handler: Drag leave
   */
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Handler: Drop
   */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    // Obtener primer archivo
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  /**
   * Handler: Click en la zona (abrir selector de archivos)
   */
  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  /**
   * Handler: Cambio en input de archivo
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }

    // Resetear input para permitir seleccionar el mismo archivo de nuevo
    e.target.value = '';
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="w-full">
      {/* Zona de drag & drop */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 cursor-pointer',
          // Estados
          isDragging && 'border-blue-500 bg-blue-50',
          !isDragging && !existingFile && 'border-gray-300 hover:border-blue-400 hover:bg-gray-50',
          existingFile && 'border-green-500 bg-green-50',
          isUploading && 'border-blue-500 bg-blue-50',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-red-500 bg-red-50'
        )}
      >
        {/* Input oculto de archivo */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileInputChange}
          disabled={disabled || isUploading}
          className="hidden"
        />

        {/* Contenido de la zona */}
        <div className="flex flex-col items-center space-y-3">
          {/* Icono */}
          <div
            className={cn(
              'p-3 rounded-full',
              existingFile && 'bg-green-100',
              isUploading && 'bg-blue-100',
              !existingFile && !isUploading && 'bg-gray-100'
            )}
          >
            {existingFile ? (
              // Icono de check (archivo ya subido)
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : isUploading ? (
              // Icono de upload con animación
              <svg
                className="h-8 w-8 text-blue-600 animate-pulse"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            ) : (
              // Icono de documento
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            )}
          </div>

          {/* Título */}
          <div className="text-center">
            <p className="text-sm font-medium text-gray-900">
              {FILE_TYPE_LABELS[fileType]}
            </p>

            {existingFile ? (
              <p className="mt-1 text-xs text-green-600 font-medium">
                ✓ {existingFile}
              </p>
            ) : isUploading ? (
              <p className="mt-1 text-xs text-blue-600 font-medium">
                Subiendo... {progress}%
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                Arrastra un archivo aquí o haz clic para seleccionar
              </p>
            )}
          </div>

          {/* Requisitos */}
          {!existingFile && !isUploading && (
            <div className="text-center">
              <p className="text-xs text-gray-400">
                Excel (.xlsx, .xls) • Máx. {maxSizeMB}MB
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Debe contener: <span className="font-medium">&quot;{FILE_TYPE_KEYWORDS[fileType].join('&quot; o &quot;')}&quot;</span>
              </p>
            </div>
          )}

          {/* Barra de progreso */}
          {isUploading && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 text-sm text-red-600 flex items-start">
          <svg
            className="h-5 w-5 mr-1 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
