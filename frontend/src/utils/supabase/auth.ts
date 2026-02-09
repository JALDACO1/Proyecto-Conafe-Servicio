/**
 * Helpers de Autenticación
 * =========================
 * Funciones reutilizables para operaciones de autenticación con Supabase.
 * Incluye: login, logout, registro, verificación de rol, etc.
 */

import { supabase } from './client';
import type { Profile, UserRole } from '../../types/database.types';

// ============================================================================
// Tipos para las funciones de autenticación
// ============================================================================

/**
 * Credenciales para login
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Datos para registro de usuario
 */
export interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
}

/**
 * Resultado de operación de autenticación
 */
export interface AuthResult {
  success: boolean;
  error?: string;
  profile?: Profile;
}

// ============================================================================
// FUNCIÓN: signIn
// ============================================================================
/**
 * Autentica un usuario con email y contraseña
 *
 * @param credentials - Email y contraseña del usuario
 * @returns Promise<AuthResult> - Resultado de la autenticación con perfil del usuario
 *
 * @example
 * const result = await signIn({
 *   email: 'admin@conafe.gob.mx',
 *   password: 'password123'
 * });
 *
 * if (result.success) {
 *   console.log('Login exitoso!', result.profile);
 * } else {
 *   console.error('Error:', result.error);
 * }
 */
export async function signIn(credentials: LoginCredentials): Promise<AuthResult> {
  try {
    // 1. Intentar autenticar con Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      // Traducir errores comunes de Supabase a español
      let errorMessage = error.message;

      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Email o contraseña incorrectos';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Por favor confirma tu email antes de iniciar sesión';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    // 2. Si la autenticación fue exitosa, obtener el perfil del usuario
    if (data.user) {
      const profile = await getUserProfile(data.user.id);

      if (!profile) {
        return {
          success: false,
          error: 'No se pudo obtener el perfil del usuario',
        };
      }

      return {
        success: true,
        profile,
      };
    }

    return {
      success: false,
      error: 'Error desconocido al iniciar sesión',
    };
  } catch (error) {
    console.error('❌ Error en signIn:', error);
    return {
      success: false,
      error: 'Error inesperado al iniciar sesión',
    };
  }
}

// ============================================================================
// FUNCIÓN: signUp
// ============================================================================
/**
 * Registra un nuevo usuario en el sistema
 *
 * @param signUpData - Datos del nuevo usuario (email, contraseña, nombre)
 * @returns Promise<AuthResult> - Resultado del registro
 *
 * @example
 * const result = await signUp({
 *   email: 'nuevo@conafe.gob.mx',
 *   password: 'password123',
 *   fullName: 'Juan Pérez'
 * });
 */
export async function signUp(signUpData: SignUpData): Promise<AuthResult> {
  try {
    // 1. Registrar usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: signUpData.email,
      password: signUpData.password,
      options: {
        // Metadata adicional del usuario
        data: {
          full_name: signUpData.fullName || '',
        },
      },
    });

    if (error) {
      // Traducir errores comunes
      let errorMessage = error.message;

      if (error.message.includes('User already registered')) {
        errorMessage = 'Este email ya está registrado';
      } else if (error.message.includes('Password should be at least')) {
        errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    // 2. Obtener perfil del usuario recién creado
    // El trigger handle_new_user() creó automáticamente el perfil
    if (data.user) {
      // Esperar un momento para que el trigger termine de crear el perfil
      await new Promise((resolve) => setTimeout(resolve, 500));

      const profile = await getUserProfile(data.user.id);

      return {
        success: true,
        profile: profile || undefined,
      };
    }

    return {
      success: false,
      error: 'Error desconocido al registrar usuario',
    };
  } catch (error) {
    console.error('❌ Error en signUp:', error);
    return {
      success: false,
      error: 'Error inesperado al registrar usuario',
    };
  }
}

// ============================================================================
// FUNCIÓN: signOut
// ============================================================================
/**
 * Cierra la sesión del usuario actual
 *
 * @returns Promise<AuthResult> - Resultado del logout
 *
 * @example
 * const result = await signOut();
 * if (result.success) {
 *   console.log('Sesión cerrada');
 *   navigate('/login');
 * }
 */
export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ Error en signOut:', error);
    return {
      success: false,
      error: 'Error inesperado al cerrar sesión',
    };
  }
}

// ============================================================================
// FUNCIÓN: getUserProfile
// ============================================================================
/**
 * Obtiene el perfil de un usuario desde la tabla profiles
 *
 * @param userId - ID del usuario (UUID)
 * @returns Promise<Profile | null> - Perfil del usuario o null si no existe
 *
 * @example
 * const profile = await getUserProfile('uuid-del-usuario');
 * if (profile) {
 *   console.log('Rol:', profile.role);
 *   console.log('Email:', profile.email);
 * }
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single(); // .single() asegura que solo se retorne 1 fila

    if (error) {
      console.error('❌ Error obteniendo perfil:', error.message);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Error en getUserProfile:', error);
    return null;
  }
}

// ============================================================================
// FUNCIÓN: getCurrentUserProfile
// ============================================================================
/**
 * Obtiene el perfil del usuario autenticado actualmente
 *
 * @returns Promise<Profile | null> - Perfil del usuario actual o null si no está autenticado
 *
 * @example
 * const profile = await getCurrentUserProfile();
 * if (profile) {
 *   console.log('Usuario actual:', profile.full_name);
 *   console.log('Es admin?', profile.role === 'admin');
 * }
 */
export async function getCurrentUserProfile(): Promise<Profile | null> {
  try {
    // 1. Obtener usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    // 2. Obtener perfil del usuario
    return await getUserProfile(user.id);
  } catch (error) {
    console.error('❌ Error en getCurrentUserProfile:', error);
    return null;
  }
}

// ============================================================================
// FUNCIÓN: getUserRole
// ============================================================================
/**
 * Obtiene el rol del usuario autenticado actual
 *
 * @returns Promise<UserRole | null> - 'admin' | 'user' | null
 *
 * @example
 * const role = await getUserRole();
 * if (role === 'admin') {
 *   console.log('Usuario es administrador');
 * }
 */
export async function getUserRole(): Promise<UserRole | null> {
  const profile = await getCurrentUserProfile();
  return profile?.role || null;
}

// ============================================================================
// FUNCIÓN: isAdmin
// ============================================================================
/**
 * Verifica si el usuario actual es administrador
 *
 * @returns Promise<boolean> - true si el usuario es admin
 *
 * @example
 * if (await isAdmin()) {
 *   console.log('Acceso admin concedido');
 * } else {
 *   console.log('Acceso denegado');
 * }
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'admin';
}

// ============================================================================
// FUNCIÓN: isUser
// ============================================================================
/**
 * Verifica si el usuario actual es un usuario regular (no admin)
 *
 * @returns Promise<boolean> - true si el usuario es user regular
 */
export async function isUser(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'user';
}

// ============================================================================
// FUNCIÓN: resetPassword
// ============================================================================
/**
 * Envía un email para resetear la contraseña
 *
 * @param email - Email del usuario
 * @returns Promise<AuthResult> - Resultado de la operación
 *
 * @example
 * const result = await resetPassword('usuario@conafe.gob.mx');
 * if (result.success) {
 *   console.log('Email de recuperación enviado');
 * }
 */
export async function resetPassword(email: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ Error en resetPassword:', error);
    return {
      success: false,
      error: 'Error inesperado al enviar email de recuperación',
    };
  }
}

// ============================================================================
// FUNCIÓN: updatePassword
// ============================================================================
/**
 * Actualiza la contraseña del usuario autenticado
 *
 * @param newPassword - Nueva contraseña
 * @returns Promise<AuthResult> - Resultado de la operación
 *
 * @example
 * const result = await updatePassword('nuevaPassword123');
 * if (result.success) {
 *   console.log('Contraseña actualizada');
 * }
 */
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ Error en updatePassword:', error);
    return {
      success: false,
      error: 'Error inesperado al actualizar contraseña',
    };
  }
}

// ============================================================================
// FUNCIÓN: updateProfile
// ============================================================================
/**
 * Actualiza el perfil del usuario autenticado
 *
 * @param updates - Campos a actualizar
 * @returns Promise<AuthResult> - Resultado de la operación
 *
 * @example
 * const result = await updateProfile({
 *   full_name: 'Juan Pérez García'
 * });
 */
export async function updateProfile(
  updates: { full_name?: string }
): Promise<AuthResult> {
  try {
    // Obtener ID del usuario actual
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      };
    }

    // Actualizar perfil en la tabla profiles
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Obtener perfil actualizado
    const profile = await getUserProfile(user.id);

    return {
      success: true,
      profile: profile || undefined,
    };
  } catch (error) {
    console.error('❌ Error en updateProfile:', error);
    return {
      success: false,
      error: 'Error inesperado al actualizar perfil',
    };
  }
}

// ============================================================================
// FUNCIÓN: getCurrentUser
// ============================================================================
/**
 * Obtiene el usuario autenticado actual de Supabase Auth
 *
 * @returns Promise con el usuario de Supabase Auth
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { success: false, data: null, error: error?.message || 'No hay usuario autenticado' };
    }

    return { success: true, data: user, error: null };
  } catch (error) {
    console.error('❌ Error en getCurrentUser:', error);
    return { success: false, data: null, error: 'Error obteniendo usuario actual' };
  }
}

// ============================================================================
// FUNCIÓN: onAuthStateChange
// ============================================================================
/**
 * Escucha cambios en el estado de autenticación
 *
 * @param callback - Función que se ejecuta cuando cambia el estado de auth
 * @returns Función para desuscribirse del listener
 */
export function onAuthStateChange(
  callback: (event: string, session: any) => void
) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  // Retornar función de cleanup
  return () => {
    data.subscription.unsubscribe();
  };
}
