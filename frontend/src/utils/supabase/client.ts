/**
 * Cliente de Supabase
 * ==================
 * Este archivo configura y exporta el cliente de Supabase que se usa en toda la aplicación.
 * El cliente proporciona acceso a:
 * - Autenticación (auth)
 * - Base de datos (from())
 * - Storage (storage)
 * - Realtime (channel())
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';

// ============================================================================
// Validación de variables de entorno
// ============================================================================
// Asegurarse de que las variables de entorno estén configuradas
// Si faltan, lanzar error inmediatamente para evitar problemas en runtime
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    '❌ VITE_SUPABASE_URL no está configurado. ' +
    'Crea un archivo .env.local basado en .env.example'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    '❌ VITE_SUPABASE_ANON_KEY no está configurado. ' +
    'Crea un archivo .env.local basado en .env.example'
  );
}

// ============================================================================
// Crear cliente de Supabase
// ============================================================================
// createClient inicializa la conexión con Supabase
// El tipo genérico <Database> proporciona autocompletado TypeScript para tablas y columnas
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configuración de autenticación

    // Persistir sesión en localStorage (el usuario permanece logueado después de cerrar la pestaña)
    // Opciones: 'local' (persistente) | 'session' (solo durante sesión) | 'none' (memoria)
    persistSession: true,

    // Storage para sesión: localStorage (default)
    // Alternativas: sessionStorage, custom storage
    storage: window.localStorage,

    // Auto refresh token: cuando el token expira, renovarlo automáticamente
    autoRefreshToken: true,

    // Detectar cambios de sesión (ej: usuario abre la app en otra pestaña y hace logout)
    detectSessionInUrl: true,

    // Flow Type: 'pkce' es más seguro que 'implicit' para SPAs
    // PKCE (Proof Key for Code Exchange) previene ataques de intercepción
    flowType: 'pkce',
  },

  global: {
    // Headers globales para todas las peticiones
    headers: {
      // Identificar la app en los logs de Supabase
      'X-Client-Info': 'sistema-cea-conafe/1.0.0',
    },
  },

  // Configuración de Realtime (WebSocket)
  realtime: {
    // Parámetros de conexión WebSocket
    params: {
      // Heartbeat cada 30 segundos para mantener conexión viva
      heartbeatIntervalMs: 30000,
    },
  },
});

// ============================================================================
// Helpers para verificar estado de autenticación
// ============================================================================

/**
 * Obtiene la sesión actual del usuario
 * @returns Promise con la sesión o null si no hay usuario autenticado
 *
 * @example
 * const session = await getCurrentSession();
 * if (session) {
 *   console.log('Usuario:', session.user.email);
 * }
 */
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('❌ Error obteniendo sesión:', error.message);
    return null;
  }

  return data.session;
}

/**
 * Obtiene el usuario autenticado actual
 * @returns Promise con el usuario o null si no hay usuario autenticado
 *
 * @example
 * const user = await getCurrentUser();
 * if (user) {
 *   console.log('Email:', user.email);
 *   console.log('ID:', user.id);
 * }
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error('❌ Error obteniendo usuario:', error.message);
    return null;
  }

  return data.user;
}

/**
 * Verifica si hay un usuario autenticado actualmente
 * @returns Promise<boolean> - true si hay usuario autenticado
 *
 * @example
 * if (await isAuthenticated()) {
 *   console.log('Usuario autenticado');
 * } else {
 *   console.log('Usuario NO autenticado');
 * }
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return session !== null;
}

// ============================================================================
// Export del cliente como default
// ============================================================================
// Permite importar el cliente de dos formas:
// import { supabase } from './client'  <- Named export
// import supabase from './client'      <- Default export
export default supabase;
