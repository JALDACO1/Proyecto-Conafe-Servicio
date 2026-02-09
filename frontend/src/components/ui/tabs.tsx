/**
 * Componente UI: Tabs
 * ====================
 * Pestañas para organizar contenido en secciones
 *
 * Basado en shadcn/ui (versión simplificada sin Radix UI)
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Contexto de Tabs
// ============================================================================

/**
 * Contexto para compartir el estado entre componentes de Tabs
 */
interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

/**
 * Hook para acceder al contexto de Tabs
 */
const useTabsContext = () => {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Los componentes de Tabs deben usarse dentro de <Tabs>');
  }
  return context;
};

// ============================================================================
// Tabs (contenedor principal)
// ============================================================================

/**
 * Props del componente Tabs
 */
export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;                          // Pestaña activa
  onValueChange?: (value: string) => void; // Callback cuando cambia
  defaultValue?: string;                  // Valor inicial (si no controlado)
}

/**
 * Contenedor principal de las pestañas
 *
 * @example
 * <Tabs defaultValue="tab1">
 *   <TabsList>
 *     <TabsTrigger value="tab1">Pestaña 1</TabsTrigger>
 *     <TabsTrigger value="tab2">Pestaña 2</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="tab1">Contenido 1</TabsContent>
 *   <TabsContent value="tab2">Contenido 2</TabsContent>
 * </Tabs>
 */
export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, value, onValueChange, defaultValue, children, ...props }, ref) => {
    // Estado interno si no está controlado
    const [internalValue, setInternalValue] = React.useState(defaultValue || value);

    // Valor actual (controlado o no controlado)
    const currentValue = value || internalValue;

    // Handler de cambio
    const handleValueChange = (newValue: string) => {
      if (onValueChange) {
        onValueChange(newValue);
      }
      setInternalValue(newValue);
    };

    return (
      <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
        <div ref={ref} className={cn('', className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);

Tabs.displayName = 'Tabs';

// ============================================================================
// TabsList (contenedor de triggers)
// ============================================================================

/**
 * Props del componente TabsList
 */
export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Contenedor de los botones de pestañas
 */
export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500',
        className
      )}
      {...props}
    />
  )
);

TabsList.displayName = 'TabsList';

// ============================================================================
// TabsTrigger (botón de pestaña)
// ============================================================================

/**
 * Props del componente TabsTrigger
 */
export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

/**
 * Botón para activar una pestaña
 */
export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const { value: activeValue, onValueChange } = useTabsContext();
    const isActive = activeValue === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-white transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          isActive
            ? 'bg-white text-gray-950 shadow'
            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900',
          className
        )}
        onClick={() => onValueChange(value)}
        {...props}
      />
    );
  }
);

TabsTrigger.displayName = 'TabsTrigger';

// ============================================================================
// TabsContent (contenido de pestaña)
// ============================================================================

/**
 * Props del componente TabsContent
 */
export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

/**
 * Contenido de una pestaña
 * Solo se muestra cuando la pestaña está activa
 */
export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { value: activeValue } = useTabsContext();
    const isActive = activeValue === value;

    if (!isActive) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn(
          'mt-2 ring-offset-white',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2',
          className
        )}
        {...props}
      />
    );
  }
);

TabsContent.displayName = 'TabsContent';
