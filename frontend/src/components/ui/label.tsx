/**
 * Componente UI: Label
 * =====================
 * Etiqueta para campos de formulario
 *
 * Basado en shadcn/ui
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Props del componente Label
 */
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

// ============================================================================
// Componente Principal
// ============================================================================

/**
 * Etiqueta para campos de formulario
 *
 * @example
 * // Label básico
 * <Label htmlFor="email">Email</Label>
 * <Input id="email" type="email" />
 *
 * @example
 * // Label con indicador de campo requerido
 * <Label htmlFor="name">
 *   Nombre <span className="text-red-600">*</span>
 * </Label>
 * <Input id="name" required />
 */
export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  )
);

Label.displayName = 'Label';
