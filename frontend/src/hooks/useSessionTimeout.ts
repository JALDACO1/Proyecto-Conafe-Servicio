/**
 * Hook: useSessionTimeout
 * ========================
 * Maneja la expiración automática de sesión por inactividad.
 *
 * - Cierra sesión automáticamente después de un período de inactividad
 * - Muestra advertencia antes de cerrar sesión
 * - Detecta actividad del usuario (mouse, teclado, scroll, touch)
 * - Sincroniza actividad entre pestañas vía localStorage
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

// ============================================================================
// Configuración
// ============================================================================

/** Tiempo de inactividad antes de cerrar sesión (30 minutos) */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Tiempo antes del cierre para mostrar advertencia (2 minutos antes) */
const WARNING_BEFORE_MS = 2 * 60 * 1000;

/** Intervalo de verificación (cada 15 segundos) */
const CHECK_INTERVAL_MS = 15 * 1000;

/** Key de localStorage para sincronizar actividad entre pestañas */
const LAST_ACTIVITY_KEY = 'cea_last_activity';

// ============================================================================
// Hook
// ============================================================================

export interface SessionTimeoutState {
  /** Muestra si la advertencia de expiración está activa */
  showWarning: boolean;
  /** Minutos restantes antes del cierre */
  minutesRemaining: number;
  /** Extiende la sesión (resetea el timer) */
  extendSession: () => void;
}

export function useSessionTimeout(): SessionTimeoutState {
  const { isAuthenticated, logout } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [minutesRemaining, setMinutesRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Registrar actividad ----
  const recordActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    // Si se muestra la advertencia y el usuario interactúa, cerrarla
    setShowWarning(false);
  }, []);

  // ---- Extender sesión manualmente ----
  const extendSession = useCallback(() => {
    recordActivity();
    setShowWarning(false);
  }, [recordActivity]);

  // ---- Obtener última actividad ----
  const getLastActivity = useCallback((): number => {
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  }, []);

  // ---- Verificar timeout ----
  const checkTimeout = useCallback(async () => {
    if (!isAuthenticated) return;

    const lastActivity = getLastActivity();
    const elapsed = Date.now() - lastActivity;
    const remaining = IDLE_TIMEOUT_MS - elapsed;

    if (remaining <= 0) {
      // Tiempo agotado → cerrar sesión
      setShowWarning(false);
      try {
        await logout();
      } catch {
        // Si falla logout, forzar limpieza
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        window.location.href = '/login';
      }
    } else if (remaining <= WARNING_BEFORE_MS) {
      // Dentro del período de advertencia
      setShowWarning(true);
      setMinutesRemaining(Math.ceil(remaining / 60000));
    } else {
      setShowWarning(false);
    }
  }, [isAuthenticated, logout, getLastActivity]);

  // ---- Listeners de actividad ----
  useEffect(() => {
    if (!isAuthenticated) {
      setShowWarning(false);
      return;
    }

    // Verificar si la sesión expiró mientras la app estaba cerrada
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (stored) {
      const lastActivity = parseInt(stored, 10);
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        // Sesión expirada por inactividad mientras la app estaba cerrada
        logout().catch(() => {
          localStorage.removeItem(LAST_ACTIVITY_KEY);
          window.location.href = '/login';
        });
        return;
      }
    }

    // Registrar actividad inicial (solo si la sesión no ha expirado)
    recordActivity();

    // Eventos que indican actividad del usuario
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

    // Throttle: solo registrar cada 30 segundos para no saturar
    let lastRecorded = Date.now();
    const throttledRecord = () => {
      const now = Date.now();
      if (now - lastRecorded > 30000) {
        lastRecorded = now;
        recordActivity();
      }
    };

    for (const event of events) {
      window.addEventListener(event, throttledRecord, { passive: true });
    }

    // Sincronizar entre pestañas: si otra pestaña registra actividad
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY && e.newValue) {
        setShowWarning(false);
      }
    };
    window.addEventListener('storage', handleStorage);

    // Verificar timeout periódicamente
    intervalRef.current = setInterval(checkTimeout, CHECK_INTERVAL_MS);

    return () => {
      for (const event of events) {
        window.removeEventListener(event, throttledRecord);
      }
      window.removeEventListener('storage', handleStorage);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAuthenticated, recordActivity, checkTimeout, logout]);

  return { showWarning, minutesRemaining, extendSession };
}
