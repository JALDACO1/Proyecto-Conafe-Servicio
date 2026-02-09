/**
 * Componente UI: Spinner
 * =======================
 * Indicador de carga animado
 *
 * Componente personalizado para el proyecto
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Tamaños del spinner
 */
export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Props del componente Spinner
 */
export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  text?: string; // Texto opcional a mostrar debajo del spinner
}

// ============================================================================
// Estilos por tamaño
// ============================================================================

/**
 * Clases según tamaño
 */
const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
  xl: 'h-16 w-16 border-4',
};

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Spinner de carga animado
 *
 * @example
 * // Spinner simple
 * <Spinner />
 *
 * @example
 * // Spinner con texto
 * <Spinner text="Cargando..." />
 *
 * @example
 * // Spinner grande
 * <Spinner size="lg" text="Procesando archivos..." />
 */
export const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = 'md', text, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex flex-col items-center justify-center', className)} {...props}>
        {/* SVG del spinner */}
        <div
          className={cn(
            'animate-spin rounded-full border-b-blue-600 border-t-transparent border-l-transparent border-r-transparent',
            sizeClasses[size]
          )}
          role="status"
          aria-label="Cargando"
        />

        {/* Texto opcional */}
        {text && (
          <p className="mt-3 text-sm text-gray-600">
            {text}
          </p>
        )}
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';

// ============================================================================
// Componente: LoadingOverlay
// ============================================================================

/**
 * Props del componente LoadingOverlay
 */
export interface LoadingOverlayProps {
  show: boolean;
  text?: string;
}

/**
 * Overlay de carga que cubre toda la pantalla
 *
 * @example
 * <LoadingOverlay show={isLoading} text="Procesando..." />
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ show, text }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-lg bg-white p-8 shadow-xl">
        <Spinner size="lg" text={text} />
      </div>
    </div>
  );
};

LoadingOverlay.displayName = 'LoadingOverlay';
