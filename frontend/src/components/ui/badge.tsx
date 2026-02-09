/**
 * Componente UI: Badge
 * =====================
 * Insignia/etiqueta pequeña para mostrar estados o categorías
 *
 * Basado en shadcn/ui
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Variantes de estilo del badge
 */
export type BadgeVariant =
  | 'default'     // Azul (por defecto)
  | 'secondary'   // Gris
  | 'success'     // Verde (éxito)
  | 'warning'     // Amarillo (advertencia)
  | 'destructive' // Rojo (error/peligro)
  | 'outline';    // Con borde

/**
 * Props del componente Badge
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

// ============================================================================
// Estilos por variante
// ============================================================================

/**
 * Clases base compartidas
 */
const baseClasses =
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2';

/**
 * Clases según variante
 */
const variantClasses: Record<BadgeVariant, string> = {
  default: 'border-transparent bg-blue-600 text-white shadow hover:bg-blue-700',
  secondary: 'border-transparent bg-gray-100 text-gray-900 hover:bg-gray-200',
  success: 'border-transparent bg-green-100 text-green-800 hover:bg-green-200',
  warning: 'border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  destructive: 'border-transparent bg-red-100 text-red-800 hover:bg-red-200',
  outline: 'text-gray-950 border-gray-300',
};

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Componente Badge
 *
 * @example
 * // Badge por defecto (azul)
 * <Badge>Nuevo</Badge>
 *
 * @example
 * // Badge de éxito (verde)
 * <Badge variant="success">Validado</Badge>
 *
 * @example
 * // Badge de error (rojo)
 * <Badge variant="destructive">Error</Badge>
 *
 * @example
 * // Badge con icono
 * <Badge>
 *   <CheckIcon className="mr-1 h-3 w-3" />
 *   Completado
 * </Badge>
 */
export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], className)}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
