/**
 * Componente UI: Dialog
 * ======================
 * Modal/diálogo para mostrar contenido superpuesto
 *
 * Basado en shadcn/ui (versión simplificada sin Radix UI)
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

// ============================================================================
// Contexto de Dialog
// ============================================================================

/**
 * Contexto para compartir el estado entre componentes de Dialog
 */
interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | undefined>(undefined);

/**
 * Hook para acceder al contexto de Dialog
 */
const useDialogContext = () => {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error('Los componentes de Dialog deben usarse dentro de <Dialog>');
  }
  return context;
};

// ============================================================================
// Dialog (contenedor principal)
// ============================================================================

/**
 * Props del componente Dialog
 */
export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Contenedor principal del diálogo
 *
 * @example
 * <Dialog>
 *   <DialogTrigger asChild>
 *     <Button>Abrir diálogo</Button>
 *   </DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Título</DialogTitle>
 *       <DialogDescription>Descripción</DialogDescription>
 *     </DialogHeader>
 *     <p>Contenido del diálogo</p>
 *     <DialogFooter>
 *       <Button>Cerrar</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 */
export const Dialog: React.FC<DialogProps> = ({
  open,
  onOpenChange,
  defaultOpen = false,
  children,
}) => {
  // Estado interno si no está controlado
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);

  // Valor actual (controlado o no controlado)
  const isOpen = open !== undefined ? open : internalOpen;

  // Handler de cambio
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
    setInternalOpen(newOpen);
  };

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
};

Dialog.displayName = 'Dialog';

// ============================================================================
// DialogTrigger (botón que abre el diálogo)
// ============================================================================

/**
 * Props del componente DialogTrigger
 */
export interface DialogTriggerProps {
  asChild?: boolean;
  children: React.ReactElement;
}

/**
 * Botón que abre el diálogo al hacer clic
 */
export const DialogTrigger: React.FC<DialogTriggerProps> = ({ asChild, children }) => {
  const { onOpenChange } = useDialogContext();

  if (asChild) {
    // Clonar el children y agregarle el onClick
    return React.cloneElement(children, {
      onClick: () => onOpenChange(true),
    });
  }

  return <button onClick={() => onOpenChange(true)}>{children}</button>;
};

DialogTrigger.displayName = 'DialogTrigger';

// ============================================================================
// DialogPortal (portal para renderizar fuera del DOM)
// ============================================================================

/**
 * Portal para renderizar el diálogo en el body
 */
export const DialogPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { open } = useDialogContext();

  if (!open) return null;

  // Renderizar en un portal (fuera del árbol DOM)
  return typeof document !== 'undefined'
    ? createPortal(children, document.body)
    : null;
};

DialogPortal.displayName = 'DialogPortal';

// ============================================================================
// DialogOverlay (fondo oscuro detrás del diálogo)
// ============================================================================

/**
 * Props del componente DialogOverlay
 */
export interface DialogOverlayProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Overlay oscuro detrás del diálogo
 */
export const DialogOverlay = React.forwardRef<HTMLDivElement, DialogOverlayProps>(
  ({ className, ...props }, ref) => {
    const { onOpenChange } = useDialogContext();

    return (
      <div
        ref={ref}
        className={cn(
          'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          className
        )}
        onClick={() => onOpenChange(false)}
        {...props}
      />
    );
  }
);

DialogOverlay.displayName = 'DialogOverlay';

// ============================================================================
// DialogContent (contenido del diálogo)
// ============================================================================

/**
 * Props del componente DialogContent
 */
export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Contenido del diálogo (modal)
 */
export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = useDialogContext();

    if (!open) return null;

    return (
      <DialogPortal>
        <DialogOverlay />
        <div
          ref={ref}
          className={cn(
            'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-gray-200 bg-white p-6 shadow-lg duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            'sm:rounded-lg',
            className
          )}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {children}

          {/* Botón de cerrar (X) */}
          <button
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 disabled:pointer-events-none"
            onClick={() => onOpenChange(false)}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span className="sr-only">Cerrar</span>
          </button>
        </div>
      </DialogPortal>
    );
  }
);

DialogContent.displayName = 'DialogContent';

// ============================================================================
// DialogHeader (encabezado)
// ============================================================================

/**
 * Props del componente DialogHeader
 */
export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Encabezado del diálogo
 */
export const DialogHeader: React.FC<DialogHeaderProps> = ({ className, ...props }) => (
  <div
    className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
    {...props}
  />
);

DialogHeader.displayName = 'DialogHeader';

// ============================================================================
// DialogFooter (pie)
// ============================================================================

/**
 * Props del componente DialogFooter
 */
export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Pie del diálogo (usualmente para botones)
 */
export const DialogFooter: React.FC<DialogFooterProps> = ({ className, ...props }) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);

DialogFooter.displayName = 'DialogFooter';

// ============================================================================
// DialogTitle (título)
// ============================================================================

/**
 * Props del componente DialogTitle
 */
export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

/**
 * Título del diálogo
 */
export const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
);

DialogTitle.displayName = 'DialogTitle';

// ============================================================================
// DialogDescription (descripción)
// ============================================================================

/**
 * Props del componente DialogDescription
 */
export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

/**
 * Descripción del diálogo
 */
export const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-gray-500', className)} {...props} />
  )
);

DialogDescription.displayName = 'DialogDescription';
