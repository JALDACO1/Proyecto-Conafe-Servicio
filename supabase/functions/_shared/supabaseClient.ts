/**
 * Cliente de Supabase para Edge Functions
 * ========================================
 * Este cliente es diferente del cliente frontend porque:
 * 1. Usa service_role_key (acceso completo, bypasea RLS)
 * 2. Puede leer/escribir en cualquier tabla sin restricciones
 * 3. Solo debe usarse en el backend (NUNCA exponer service_role_key al frontend)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Crea un cliente de Supabase con service_role_key
 * Este cliente tiene privilegios de administrador y bypasea RLS
 *
 * IMPORTANTE: Solo usar en Edge Functions (backend)
 * NUNCA exponer service_role_key al frontend
 *
 * @param req - Request de la Edge Function (para extraer auth header)
 * @returns Cliente de Supabase con privilegios de servicio
 *
 * @example
 * const supabase = getSupabaseServiceClient(req);
 * await supabase.from('master_uploads').insert({ ... });
 */
export function getSupabaseServiceClient(req?: Request) {
  // Obtener variables de entorno
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      '❌ Variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas'
    );
  }

  // Crear cliente con service_role_key (bypasea RLS)
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      // No persistir sesión en Edge Functions
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        // Incluir el auth header del request original si existe
        // Esto permite identificar qué usuario hizo la petición
        ...(req?.headers.get('Authorization') && {
          Authorization: req.headers.get('Authorization')!,
        }),
      },
    },
  });
}

/**
 * Crea un cliente de Supabase con el token del usuario autenticado
 * Este cliente respeta RLS y solo puede acceder a datos autorizados
 *
 * Útil cuando necesitas hacer operaciones como el usuario (no como servicio)
 *
 * @param req - Request de la Edge Function
 * @returns Cliente de Supabase con permisos del usuario
 *
 * @example
 * const supabase = getSupabaseUserClient(req);
 * const { data } = await supabase.from('profiles').select('*');
 */
export function getSupabaseUserClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '❌ Variables de entorno SUPABASE_URL o SUPABASE_ANON_KEY no configuradas'
    );
  }

  // Crear cliente con anon_key (respeta RLS)
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        // Pasar el Authorization header del usuario
        Authorization: req.headers.get('Authorization')!,
      },
    },
  });
}

/**
 * Obtiene el usuario autenticado desde el request
 *
 * @param req - Request de la Edge Function
 * @returns Usuario autenticado o null
 *
 * @example
 * const user = await getAuthenticatedUser(req);
 * if (!user) {
 *   return corsErrorResponse('No autenticado', 401);
 * }
 * console.log('Usuario:', user.email);
 */
export async function getAuthenticatedUser(req: Request) {
  const supabase = getSupabaseUserClient(req);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Verifica que el usuario autenticado sea administrador
 *
 * @param req - Request de la Edge Function
 * @returns true si el usuario es admin, false en caso contrario
 *
 * @example
 * if (!(await isUserAdmin(req))) {
 *   return corsErrorResponse('Acceso denegado. Solo admins', 403);
 * }
 */
export async function isUserAdmin(req: Request): Promise<boolean> {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return false;
    }

    // Obtener perfil del usuario
    const supabase = getSupabaseServiceClient(req);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return false;
    }

    return profile.role === 'admin';
  } catch (error) {
    console.error('❌ Error verificando admin:', error);
    return false;
  }
}
