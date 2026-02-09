-- ============================================================================
-- Migración: Configuración de Autenticación
-- Sistema de Gestión de Archivos Excel CEA - CONAFE
-- ============================================================================
-- Esta migración configura triggers y funciones para gestionar autenticación:
-- 1. Trigger para auto-crear perfil cuando se registra un nuevo usuario
-- 2. Trigger para auto-actualizar updated_at en profiles
-- 3. Función para gestionar roles de usuario
-- ============================================================================

-- ============================================================================
-- FUNCIÓN: handle_new_user
-- ============================================================================
-- Se ejecuta automáticamente cuando un nuevo usuario se registra en auth.users
-- Crea un registro correspondiente en public.profiles con rol 'user' por defecto
-- Esto asegura que todo usuario tenga un perfil inmediatamente después de registro
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
-- SECURITY DEFINER permite que la función se ejecute con permisos de propietario
-- Esto es necesario porque el trigger se ejecuta en la tabla auth.users (fuera de public schema)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insertar un nuevo perfil en public.profiles usando los datos del nuevo usuario
  INSERT INTO public.profiles (id, email, role, full_name, created_at, updated_at)
  VALUES (
    NEW.id,  -- ID del usuario de auth.users
    NEW.email,  -- Email del usuario de auth.users
    'user',  -- Rol por defecto: 'user' (NO admin)
    -- Extraer nombre de metadata si existe, sino usar parte del email
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',  -- Intenta obtener full_name de metadata
      SPLIT_PART(NEW.email, '@', 1)  -- Si no existe, usa parte antes del @ del email
    ),
    NOW(),  -- created_at
    NOW()   -- updated_at
  );

  -- Retornar NEW es requerido por triggers AFTER INSERT
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Si hay algún error, registrarlo pero NO cancelar el registro del usuario
    -- Esto previene que errores en la creación del perfil impidan el registro
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Comentario de la función para documentación
COMMENT ON FUNCTION public.handle_new_user IS 'Crea automáticamente un perfil cuando un nuevo usuario se registra';

-- ============================================================================
-- TRIGGER: on_auth_user_created
-- ============================================================================
-- Se dispara DESPUÉS de que se inserta un nuevo usuario en auth.users
-- Llama a la función handle_new_user() para crear el perfil
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comentario del trigger
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Crea perfil automáticamente al registrar nuevo usuario';

-- ============================================================================
-- FUNCIÓN: update_updated_at_column
-- ============================================================================
-- Función genérica para actualizar automáticamente la columna updated_at
-- Se ejecuta en BEFORE UPDATE para asegurar que updated_at siempre refleje
-- la última modificación del registro
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Actualizar la columna updated_at al timestamp actual
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Comentario de la función
COMMENT ON FUNCTION public.update_updated_at_column IS 'Actualiza automáticamente la columna updated_at';

-- ============================================================================
-- TRIGGER: update_profiles_updated_at
-- ============================================================================
-- Se dispara ANTES de actualizar un registro en public.profiles
-- Actualiza automáticamente la columna updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- TRIGGER: update_master_uploads_updated_at
-- ============================================================================
-- Se dispara ANTES de actualizar un registro en public.master_uploads
-- Actualiza automáticamente la columna updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_master_uploads_updated_at ON public.master_uploads;

CREATE TRIGGER update_master_uploads_updated_at
  BEFORE UPDATE ON public.master_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- FUNCIÓN: promote_user_to_admin
-- ============================================================================
-- Función helper para promover un usuario a admin
-- Solo puede ser ejecutada por un superusuario de la base de datos
-- NO es accesible desde el cliente (no se expone como RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Actualizar el rol del usuario a 'admin'
  UPDATE public.profiles
  SET role = 'admin'
  WHERE email = user_email;

  -- Verificar que se actualizó al menos un registro
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario con email % no encontrado', user_email;
  END IF;

  -- Log de auditoría
  RAISE NOTICE 'Usuario % promovido a admin', user_email;
END;
$$;

-- Comentario de la función
COMMENT ON FUNCTION public.promote_user_to_admin IS 'Promueve un usuario a rol admin (solo para uso administrativo)';

-- ============================================================================
-- FUNCIÓN: demote_admin_to_user
-- ============================================================================
-- Función helper para degradar un admin a usuario regular
-- Solo puede ser ejecutada por un superusuario de la base de datos
-- ============================================================================
CREATE OR REPLACE FUNCTION public.demote_admin_to_user(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Actualizar el rol del usuario a 'user'
  UPDATE public.profiles
  SET role = 'user'
  WHERE email = user_email;

  -- Verificar que se actualizó al menos un registro
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario con email % no encontrado', user_email;
  END IF;

  -- Log de auditoría
  RAISE NOTICE 'Admin % degradado a usuario regular', user_email;
END;
$$;

-- Comentario de la función
COMMENT ON FUNCTION public.demote_admin_to_user IS 'Degrada un admin a usuario regular (solo para uso administrativo)';

-- ============================================================================
-- FUNCIÓN: get_user_role
-- ============================================================================
-- Función para obtener el rol del usuario autenticado actual
-- Útil en políticas RLS y en el frontend para verificar permisos
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE  -- STABLE indica que la función no modifica datos y retorna lo mismo para mismos parámetros
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Obtener el rol del usuario autenticado actual
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();  -- auth.uid() retorna el ID del usuario autenticado

  -- Si no se encuentra el usuario, retornar NULL
  RETURN user_role;
END;
$$;

-- Comentario de la función
COMMENT ON FUNCTION public.get_user_role IS 'Obtiene el rol del usuario autenticado actual';

-- ============================================================================
-- FUNCIÓN: is_admin
-- ============================================================================
-- Función helper para verificar si el usuario actual es admin
-- Retorna TRUE si el usuario tiene rol 'admin', FALSE en caso contrario
-- Muy útil en políticas RLS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Comentario de la función
COMMENT ON FUNCTION public.is_admin IS 'Verifica si el usuario actual es admin';

-- ============================================================================
-- PERMISOS
-- ============================================================================
-- Asegurar que usuarios autenticados puedan ejecutar funciones helper
-- ============================================================================

-- Permitir a usuarios autenticados ejecutar get_user_role()
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- Permitir a usuarios autenticados ejecutar is_admin()
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- NO permitir a usuarios ejecutar promote_user_to_admin() y demote_admin_to_user()
-- Estas funciones son solo para administradores de la base de datos
REVOKE EXECUTE ON FUNCTION public.promote_user_to_admin(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.demote_admin_to_user(TEXT) FROM authenticated;

-- ============================================================================
-- INSTRUCCIONES DE USO
-- ============================================================================
-- Para promover un usuario a admin manualmente:
-- SELECT public.promote_user_to_admin('admin@conafe.gob.mx');
--
-- Para degradar un admin a usuario:
-- SELECT public.demote_admin_to_user('usuario@conafe.gob.mx');
--
-- Para verificar si el usuario actual es admin:
-- SELECT public.is_admin();
--
-- Para obtener el rol del usuario actual:
-- SELECT public.get_user_role();
-- ============================================================================

-- ============================================================================
-- FIN DE LA MIGRACIÓN DE AUTENTICACIÓN
-- ============================================================================
