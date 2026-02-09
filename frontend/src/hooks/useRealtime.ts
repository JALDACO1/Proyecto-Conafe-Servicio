/**
 * Hook: useRealtime
 * ==================
 * Hook personalizado para manejar subscripciones de Supabase Realtime
 *
 * Características:
 * - Subscripción a cambios en tablas (INSERT, UPDATE, DELETE)
 * - Auto-cleanup al desmontar componente
 * - Manejo de errores de conexión
 * - TypeScript type-safe
 */

import { useEffect } from 'react';
import { supabase } from '../utils/supabase/client';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Tipo de evento de Realtime
 */
export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Payload de cambios de Postgres Realtime
 */
export interface RealtimePayload<T = Record<string, unknown>> {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: RealtimeEvent;
  new: T;
  old: T;
  errors: string[] | null;
}

/**
 * Configuración de subscripción a una tabla
 */
export interface TableSubscription<T = Record<string, unknown>> {
  /**
   * Nombre de la tabla a la que subscribirse
   */
  table: string;

  /**
   * Evento(s) a escuchar: INSERT, UPDATE, DELETE, o * (todos)
   */
  event: RealtimeEvent;

  /**
   * Filtro opcional (ej: "status=eq.completed")
   */
  filter?: string;

  /**
   * Callback cuando ocurre el evento
   */
  callback: (payload: RealtimePayload<T>) => void;
}

// ============================================================================
// Hook: useRealtime
// ============================================================================

/**
 * Hook para subscribirse a cambios en tiempo real de Supabase
 *
 * @param subscriptions - Array de subscripciones a tablas
 * @param enabled - Si está habilitado (default: true)
 *
 * @example
 * useRealtime([
 *   {
 *     table: 'master_uploads',
 *     event: 'UPDATE',
 *     filter: 'status=eq.validated',
 *     callback: (payload) => {
 *       console.log('Master validado:', payload.new);
 *     }
 *   }
 * ]);
 */
export function useRealtime<T = Record<string, unknown>>(
  subscriptions: TableSubscription<T>[],
  enabled: boolean = true
) {
  useEffect(() => {
    // Si no está habilitado, no hacer nada
    if (!enabled || subscriptions.length === 0) {
      return;
    }

    // Crear un canal único para estas subscripciones
    const channelName = `realtime-${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Configurar cada subscripción
    subscriptions.forEach((subscription) => {
      const { table, event, filter, callback } = subscription;

      // Configurar el listener de cambios en Postgres
      const config = {
        event: event,
        schema: 'public',
        table: table,
        ...(filter && { filter }),
      };

      // @ts-expect-error - Supabase Realtime types are complex
      channel.on('postgres_changes', config, (payload: RealtimePayload<T>) => {
        console.log(`🔔 Realtime event [${table}/${event}]:`, payload);
        callback(payload);
      });
    });

    // Subscribirse al canal
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Realtime subscribed: ${channelName}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`❌ Realtime error: ${channelName}`);
      } else if (status === 'TIMED_OUT') {
        console.warn(`⏱️ Realtime timeout: ${channelName}`);
      } else if (status === 'CLOSED') {
        console.log(`🔌 Realtime closed: ${channelName}`);
      }
    });

    // Cleanup: desuscribirse cuando el componente se desmonte
    return () => {
      console.log(`🧹 Cleaning up Realtime: ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [subscriptions, enabled]);
}

// ============================================================================
// Hook especializado: useMasterUploadsRealtime
// ============================================================================

/**
 * Hook para escuchar cambios en master_uploads
 *
 * @param onUpdate - Callback cuando se actualiza un master
 * @param onInsert - Callback cuando se inserta un nuevo master
 * @param enabled - Si está habilitado (default: true)
 *
 * @example
 * useMasterUploadsRealtime({
 *   onUpdate: (master) => {
 *     console.log('Master actualizado:', master);
 *     // Recargar lista de masters
 *   },
 *   onInsert: (master) => {
 *     console.log('Nuevo master:', master);
 *   }
 * });
 */
export function useMasterUploadsRealtime(options: {
  onUpdate?: (payload: RealtimePayload<Record<string, unknown>>) => void;
  onInsert?: (payload: RealtimePayload<Record<string, unknown>>) => void;
  onDelete?: (payload: RealtimePayload<Record<string, unknown>>) => void;
  enabled?: boolean;
}) {
  const { onUpdate, onInsert, onDelete, enabled = true } = options;

  const subscriptions: TableSubscription[] = [];

  if (onUpdate) {
    subscriptions.push({
      table: 'master_uploads',
      event: 'UPDATE',
      callback: onUpdate,
    });
  }

  if (onInsert) {
    subscriptions.push({
      table: 'master_uploads',
      event: 'INSERT',
      callback: onInsert,
    });
  }

  if (onDelete) {
    subscriptions.push({
      table: 'master_uploads',
      event: 'DELETE',
      callback: onDelete,
    });
  }

  useRealtime(subscriptions, enabled);
}

// ============================================================================
// Hook especializado: useCeaFilesRealtime
// ============================================================================

/**
 * Hook para escuchar cambios en cea_files
 *
 * @param onUpdate - Callback cuando se actualiza un CEA
 * @param onInsert - Callback cuando se genera un nuevo CEA
 * @param enabled - Si está habilitado (default: true)
 *
 * @example
 * useCeaFilesRealtime({
 *   onInsert: (payload) => {
 *     if (payload.new.processing_status === 'completed') {
 *       toast.success('CEA generado exitosamente!');
 *       // Recargar lista de CEAs
 *     }
 *   },
 *   onUpdate: (payload) => {
 *     if (payload.new.processing_status === 'failed') {
 *       toast.error('Error al generar CEA');
 *     }
 *   }
 * });
 */
export function useCeaFilesRealtime(options: {
  onUpdate?: (payload: RealtimePayload<Record<string, unknown>>) => void;
  onInsert?: (payload: RealtimePayload<Record<string, unknown>>) => void;
  onDelete?: (payload: RealtimePayload<Record<string, unknown>>) => void;
  enabled?: boolean;
}) {
  const { onUpdate, onInsert, onDelete, enabled = true } = options;

  const subscriptions: TableSubscription[] = [];

  if (onUpdate) {
    subscriptions.push({
      table: 'cea_files',
      event: 'UPDATE',
      callback: onUpdate,
    });
  }

  if (onInsert) {
    subscriptions.push({
      table: 'cea_files',
      event: 'INSERT',
      callback: onInsert,
    });
  }

  if (onDelete) {
    subscriptions.push({
      table: 'cea_files',
      event: 'DELETE',
      callback: onDelete,
    });
  }

  useRealtime(subscriptions, enabled);
}

// ============================================================================
// Hook especializado: useProcessingLogsRealtime
// ============================================================================

/**
 * Hook para escuchar logs de procesamiento en tiempo real
 *
 * @param onInsert - Callback cuando se agrega un nuevo log
 * @param filter - Filtro opcional (ej: "level=eq.error")
 * @param enabled - Si está habilitado (default: true)
 *
 * @example
 * useProcessingLogsRealtime({
 *   onInsert: (payload) => {
 *     const log = payload.new;
 *     if (log.level === 'error') {
 *       console.error('Error en procesamiento:', log.message);
 *     }
 *   },
 *   filter: 'level=eq.error'
 * });
 */
export function useProcessingLogsRealtime(options: {
  onInsert?: (payload: RealtimePayload<Record<string, unknown>>) => void;
  filter?: string;
  enabled?: boolean;
}) {
  const { onInsert, filter, enabled = true } = options;

  const subscriptions: TableSubscription[] = [];

  if (onInsert) {
    subscriptions.push({
      table: 'processing_logs',
      event: 'INSERT',
      filter,
      callback: onInsert,
    });
  }

  useRealtime(subscriptions, enabled);
}
