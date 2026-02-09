/**
 * Componente UI: Input
 * =====================
 * Campo de entrada de texto reutilizable
 *
 * Basado en shadcn/ui
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Props del componente Input
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Campo de entrada de texto
 *
 * @example
 * // Input básico
 * <Input type="text" placeholder="Ingresa tu nombre" />
 *
 * @example
 * // Input con label
 * <div>
 *   <label htmlFor="email">Email</label>
 *   <Input id="email" type="email" placeholder="tu@email.com" />
 * </div>
 *
 * @example
 * // Input deshabilitado
 * <Input disabled value="No editable" />
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Estilos base
          'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors',
          // Focus
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
          // Placeholder
          'placeholder:text-gray-400',
          // Disabled
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
          // File input
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
