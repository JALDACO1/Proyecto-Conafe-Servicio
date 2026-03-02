/**
 * Store de Autenticación con Zustand
 * =====================================
 * Maneja el estado global de autenticación del usuario
 *
 * Características:
 * - Login/Logout
 * - Persistencia de sesión (localStorage)
 * - Verificación de rol (admin/user)
 * - Inicialización automática al cargar la app
 *
 * Zustand es más simple que Redux:
 * - No necesita providers
 * - Menos boilerplate
 * - TypeScript-friendly
 * - Performance optimizado
 */

import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../types/database.types';
import {
  signIn,
  signOut,
  getCurrentUser,
  getUserProfile,
  onAuthStateChange,
} from '../utils/supabase/auth';
import { LAST_ACTIVITY_KEY } from '../hooks/useSessionTimeout';

// ============================================================================
// Tipos
// ============================================================================

/**
 * Estado de autenticación
 */
interface AuthState {
  // Estado actual
  user: User | null;                    // Usuario de Supabase Auth
  profile: Profile | null;          // Perfil del usuario (tabla profiles)
  isAuthenticated: boolean;             // ¿Usuario autenticado?
  isLoading: boolean;                   // ¿Cargando estado inicial?
  error: string | null;                 // Error de autenticación

  // Acciones
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  setError: (error: string | null) => void;

  // Helpers
  isAdmin: () => boolean;
  isUser: () => boolean;
}

// ============================================================================
// Store de Zustand
// ============================================================================

/**
 * Store global de autenticación
 *
 * Uso:
 * ```tsx
 * import { useAuthStore } from '@/store/authStore';
 *
 * function Component() {
 *   const { user, isAdmin, login, logout } = useAuthStore();
 *   // ...
 * }
 * ```
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  // ============================================================================
  // Estado inicial
  // ============================================================================
  user: null,
  profile: null,
  isAuthenticated: false,
  isLoading: true,        // true al inicio para verificar sesión existente
  error: null,

  // ============================================================================
  // Acción: login
  // ============================================================================
  /**
   * Inicia sesión con email y contraseña
   *
   * @param email - Email del usuario
   * @param password - Contraseña
   * @throws Error si las credenciales son inválidas
   *
   * @example
   * await login('admin@conafe.gob.mx', 'password123');
   */
  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });

      // 1. Iniciar sesión con Supabase Auth
      const result = await signIn({ email, password });

      if (!result.success || !result.profile) {
        throw new Error(result.error || 'Error al iniciar sesión');
      }

      // 2. Obtener el usuario actual
      const userResult = await getCurrentUser();

      if (!userResult.success || !userResult.data) {
        throw new Error('Error obteniendo datos de usuario');
      }

      // 3. Marcar actividad ahora para que el hook de sesión no expire inmediatamente
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

      // 4. Actualizar estado
      set({
        user: userResult.data,
        profile: result.profile,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      console.log('✅ Sesión iniciada:', result.profile.email, '- Rol:', result.profile.role);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

      set({
        user: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });

      console.error('❌ Error en login:', errorMessage);
      throw new Error(errorMessage);
    }
  },

  // ============================================================================
  // Acción: logout
  // ============================================================================
  /**
   * Cierra la sesión del usuario
   *
   * @example
   * await logout();
   */
  logout: async () => {
    try {
      set({ isLoading: true, error: null });

      // 1. Cerrar sesión en Supabase
      const { success } = await signOut();

      if (!success) {
        throw new Error('Error al cerrar sesión');
      }

      // 2. Limpiar timestamp de actividad y estado
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      set({
        user: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      console.log('✅ Sesión cerrada');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

      set({
        isLoading: false,
        error: errorMessage,
      });

      console.error('❌ Error en logout:', errorMessage);
      throw new Error(errorMessage);
    }
  },

  // ============================================================================
  // Acción: initialize
  // ============================================================================
  /**
   * Inicializa el estado de autenticación
   *
   * Se llama al cargar la app para:
   * 1. Verificar si hay una sesión activa en localStorage
   * 2. Restaurar el estado del usuario si existe
   * 3. Configurar listener para cambios de autenticación
   *
   * @example
   * useEffect(() => {
   *   authStore.initialize();
   * }, []);
   */
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      // 1. Obtener usuario actual (si hay sesión activa)
      const { success, data: user } = await getCurrentUser();

      if (success && user) {
        // 2. Obtener perfil del usuario
        const profile = await getUserProfile(user.id);

        if (profile) {
          set({
            user,
            profile,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          console.log('✅ Sesión restaurada:', user.email);
        } else {
          // Sin perfil, cerrar sesión
          await get().logout();
        }
      } else {
        // Sin sesión activa
        set({
          user: null,
          profile: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });

        console.log('ℹ️ No hay sesión activa');
      }

      // 3. Configurar listener para cambios de autenticación
      // Esto detecta login/logout en otras pestañas o cambios de token
      onAuthStateChange(async (event, session) => {
        console.log('🔄 Auth state cambió:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          // Usuario inició sesión
          const profile = await getUserProfile(session.user.id);

          if (profile) {
            set({
              user: session.user,
              profile,
              isAuthenticated: true,
              error: null,
            });
          }
        } else if (event === 'SIGNED_OUT') {
          // Usuario cerró sesión
          set({
            user: null,
            profile: null,
            isAuthenticated: false,
            error: null,
          });
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Token renovado (sesión extendida automáticamente)
          set({ user: session.user });
        }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

      set({
        user: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });

      console.error('❌ Error inicializando auth:', errorMessage);
    }
  },

  // ============================================================================
  // Acción: setError
  // ============================================================================
  /**
   * Establece un mensaje de error
   *
   * @param error - Mensaje de error o null para limpiar
   */
  setError: (error: string | null) => {
    set({ error });
  },

  // ============================================================================
  // Helper: isAdmin
  // ============================================================================
  /**
   * Verifica si el usuario actual es administrador
   *
   * @returns true si el usuario tiene rol 'admin'
   *
   * @example
   * const isAdmin = useAuthStore((state) => state.isAdmin());
   * if (isAdmin) {
   *   // Mostrar opciones de admin
   * }
   */
  isAdmin: () => {
    const { profile } = get();
    return profile?.role === 'admin';
  },

  // ============================================================================
  // Helper: isUser
  // ============================================================================
  /**
   * Verifica si el usuario actual es usuario regular
   *
   * @returns true si el usuario tiene rol 'user'
   */
  isUser: () => {
    const { profile } = get();
    return profile?.role === 'user';
  },
}));

// ============================================================================
// Selectores útiles
// ============================================================================

/**
 * Selector optimizado para obtener solo el rol del usuario
 * Evita re-renders innecesarios
 */
export const useUserRole = () => useAuthStore((state) => state.profile?.role);

/**
 * Selector optimizado para verificar si es admin
 */
export const useIsAdmin = () => useAuthStore((state) => state.isAdmin());

/**
 * Selector optimizado para obtener el email del usuario
 */
export const useUserEmail = () => useAuthStore((state) => state.user?.email);

console.log('📦 Auth Store con Zustand cargado');
