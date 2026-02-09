/**
 * Componente UI: Alert
 * =====================
 * Alerta para mostrar mensajes importantes al usuario
 *
 * Basado en shadcn/ui
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Variantes de estilo del alert
 */
export type AlertVariant = 'default' | 'success' | 'warning' | 'destructive';

/**
 * Props del componente Alert
 */
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

/**
 * Props del componente AlertTitle
 */
export interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

/**
 * Props del componente AlertDescription
 */
export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

// ============================================================================
// Estilos por variante
// ============================================================================

/**
 * Clases base compartidas
 */
const baseClasses = 'relative w-full rounded-lg border px-4 py-3 text-sm';

/**
 * Clases según variante
 */
const variantClasses: Record<AlertVariant, string> = {
  default: 'bg-blue-50 text-blue-900 border-blue-200',
  success: 'bg-green-50 text-green-900 border-green-200',
  warning: 'bg-yellow-50 text-yellow-900 border-yellow-200',
  destructive: 'bg-red-50 text-red-900 border-red-200',
};

// ============================================================================
// Alert (contenedor principal)
// ============================================================================

/**
 * Componente Alert
 *
 * @example
 * // Alert básico
 * <Alert>
 *   <AlertTitle>Atención</AlertTitle>
 *   <AlertDescription>
 *     Este es un mensaje importante.
 *   </AlertDescription>
 * </Alert>
 *
 * @example
 * // Alert de éxito
 * <Alert variant="success">
 *   <AlertTitle>Éxito</AlertTitle>
 *   <AlertDescription>
 *     La operación se completó exitosamente.
 *   </AlertDescription>
 * </Alert>
 *
 * @example
 * // Alert de error
 * <Alert variant="destructive">
 *   <AlertTitle>Error</AlertTitle>
 *   <AlertDescription>
 *     Ocurrió un error al procesar tu solicitud.
 *   </AlertDescription>
 * </Alert>
 */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    />
  )
);

Alert.displayName = 'Alert';

// ============================================================================
// AlertTitle (título)
// ============================================================================

/**
 * Título del Alert
 */
export const AlertTitle = React.forwardRef<HTMLHeadingElement, AlertTitleProps>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-1 font-medium leading-none tracking-tight', className)}
      {...props}
    />
  )
);

AlertTitle.displayName = 'AlertTitle';

// ============================================================================
// AlertDescription (descripción)
// ============================================================================

/**
 * Descripción del Alert
 */
export const AlertDescription = React.forwardRef<HTMLParagraphElement, AlertDescriptionProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-sm [&_p]:leading-relaxed', className)}
      {...props}
    />
  )
);

AlertDescription.displayName = 'AlertDescription';
