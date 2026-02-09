/**
 * Componente UI: Button
 * ======================
 * Botón reutilizable con variantes de estilo
 *
 * Basado en shadcn/ui
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Variantes de estilo del botón
 */
export type ButtonVariant =
  | 'default'     // Azul sólido (acción principal)
  | 'destructive' // Rojo (acciones peligrosas)
  | 'outline'     // Con borde (acción secundaria)
  | 'secondary'   // Gris (acción secundaria)
  | 'ghost'       // Transparente (acción terciaria)
  | 'link';       // Estilo de enlace

/**
 * Tamaños del botón
 */
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

/**
 * Props del componente Button
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

// ============================================================================
// Estilos por variante
// ============================================================================

/**
 * Clases base compartidas por todas las variantes
 */
const baseClasses =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50';

/**
 * Clases según variante
 */
const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-blue-600 text-white shadow hover:bg-blue-700',
  destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  outline: 'border border-gray-300 bg-white shadow-sm hover:bg-gray-100 hover:text-gray-900',
  secondary: 'bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200',
  ghost: 'hover:bg-gray-100 hover:text-gray-900',
  link: 'text-blue-600 underline-offset-4 hover:underline',
};

/**
 * Clases según tamaño
 */
const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 rounded-md px-3 text-xs',
  lg: 'h-10 rounded-md px-8',
  icon: 'h-9 w-9',
};

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Componente Button
 *
 * @example
 * // Botón principal
 * <Button>Guardar</Button>
 *
 * @example
 * // Botón destructivo
 * <Button variant="destructive">Eliminar</Button>
 *
 * @example
 * // Botón con icono
 * <Button size="icon">
 *   <TrashIcon />
 * </Button>
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
