/**
 * Componente UI: Card
 * ====================
 * Tarjeta contenedora con header, content y footer
 *
 * Basado en shadcn/ui
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Card (contenedor principal)
// ============================================================================

/**
 * Props del componente Card
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Tarjeta contenedora principal
 *
 * @example
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Título</CardTitle>
 *     <CardDescription>Descripción</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     Contenido de la tarjeta
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Acción</Button>
 *   </CardFooter>
 * </Card>
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-gray-200 bg-white text-gray-950 shadow-sm',
        className
      )}
      {...props}
    />
  )
);

Card.displayName = 'Card';

// ============================================================================
// CardHeader (encabezado)
// ============================================================================

/**
 * Props del componente CardHeader
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Encabezado de la tarjeta
 */
export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  )
);

CardHeader.displayName = 'CardHeader';

// ============================================================================
// CardTitle (título)
// ============================================================================

/**
 * Props del componente CardTitle
 */
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

/**
 * Título de la tarjeta
 */
export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-semibold leading-none tracking-tight text-lg', className)}
      {...props}
    />
  )
);

CardTitle.displayName = 'CardTitle';

// ============================================================================
// CardDescription (descripción)
// ============================================================================

/**
 * Props del componente CardDescription
 */
export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

/**
 * Descripción de la tarjeta
 */
export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-gray-500', className)}
      {...props}
    />
  )
);

CardDescription.displayName = 'CardDescription';

// ============================================================================
// CardContent (contenido)
// ============================================================================

/**
 * Props del componente CardContent
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Contenido principal de la tarjeta
 */
export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);

CardContent.displayName = 'CardContent';

// ============================================================================
// CardFooter (pie)
// ============================================================================

/**
 * Props del componente CardFooter
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Pie de la tarjeta (usualmente para botones)
 */
export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  )
);

CardFooter.displayName = 'CardFooter';
