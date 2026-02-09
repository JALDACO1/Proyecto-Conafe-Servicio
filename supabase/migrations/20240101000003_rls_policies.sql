-- ============================================================================
-- Migración: Políticas de Row Level Security (RLS)
-- Sistema de Gestión de Archivos Excel CEA - CONAFE
-- ============================================================================
-- Esta migración habilita y configura RLS en todas las tablas:
-- 1. Habilita RLS en todas las tablas públicas
-- 2. Define políticas de acceso por rol (admin/user)
-- 3. Asegura que usuarios solo accedan a datos autorizados
-- ============================================================================
-- RLS (Row Level Security) controla qué filas puede ver/modificar cada usuario
-- Las políticas se evalúan automáticamente en cada consulta SQL
-- Sin políticas que permitan acceso, los usuarios NO pueden ver NINGUNA fila
-- ============================================================================

-- ============================================================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================================
-- Por defecto, RLS está deshabilitado
-- Al habilitarlo, se bloquea TODO acceso hasta que se definan políticas explícitas
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cea_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS RLS PARA: public.profiles
-- ============================================================================
-- Reglas de acceso:
-- - Usuarios autenticados pueden ver su propio perfil
-- - Admins pueden ver todos los perfiles
-- - Solo admins pueden modificar perfiles (UPDATE)
-- - Nadie puede crear (INSERT) o eliminar (DELETE) perfiles manualmente
--   (los perfiles se crean automáticamente via trigger)
-- ============================================================================

-- Política: Usuario puede ver su propio perfil
-- Se usa en el frontend para mostrar nombre, email, rol del usuario logueado
DROP POLICY IF EXISTS "users_can_view_own_profile" ON public.profiles;

CREATE POLICY "users_can_view_own_profile"
ON public.profiles
FOR SELECT
TO authenticated  -- Solo usuarios autenticados (no anónimos)
USING (
  -- El usuario solo puede ver su propio perfil
  -- auth.uid() retorna el ID del usuario autenticado actual
  id = auth.uid()
);

-- Política: Admins pueden ver todos los perfiles
-- Útil para dashboards de administración
DROP POLICY IF EXISTS "admins_can_view_all_profiles" ON public.profiles;

CREATE POLICY "admins_can_view_all_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Verificar que el usuario actual es admin
  public.is_admin()
);

-- Política: Admins pueden actualizar perfiles (cambiar rol, nombre, etc.)
DROP POLICY IF EXISTS "admins_can_update_profiles" ON public.profiles;

CREATE POLICY "admins_can_update_profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
)
WITH CHECK (
  public.is_admin()
);

-- Política: Usuarios pueden actualizar su propio perfil (solo campos no sensibles)
-- Permite a usuarios cambiar su nombre, pero NO su rol
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;

CREATE POLICY "users_can_update_own_profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
)
WITH CHECK (
  -- Verificar que el usuario no esté intentando cambiar su rol
  id = auth.uid()
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())  -- Rol no cambió
);

-- ============================================================================
-- POLÍTICAS RLS PARA: public.master_uploads
-- ============================================================================
-- Reglas de acceso:
-- - Solo admins pueden ver, insertar, actualizar y eliminar archivos Master
-- - Usuarios regulares NO tienen acceso a esta tabla
-- ============================================================================

-- Política: Admins tienen acceso completo (SELECT, INSERT, UPDATE, DELETE)
-- Usamos una política "ALL" para simplificar
DROP POLICY IF EXISTS "admins_have_full_access_to_master_uploads" ON public.master_uploads;

CREATE POLICY "admins_have_full_access_to_master_uploads"
ON public.master_uploads
FOR ALL  -- Aplica a SELECT, INSERT, UPDATE, DELETE
TO authenticated
USING (
  public.is_admin()
)
WITH CHECK (
  public.is_admin()
);

-- Política adicional: Verificar que el archivo subido pertenece al admin que lo subió
-- Esta política asegura que uploaded_by coincida con el usuario actual al insertar
DROP POLICY IF EXISTS "master_uploads_must_be_owned_by_uploader" ON public.master_uploads;

CREATE POLICY "master_uploads_must_be_owned_by_uploader"
ON public.master_uploads
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  AND uploaded_by = auth.uid()  -- El campo uploaded_by debe ser el ID del usuario actual
);

-- ============================================================================
-- POLÍTICAS RLS PARA: public.cea_files
-- ============================================================================
-- Reglas de acceso:
-- - Admins pueden ver, insertar, actualizar y eliminar TODOS los archivos CEA
-- - Usuarios regulares pueden ver SOLO el último CEA (is_latest = true)
-- - Usuarios regulares NO pueden modificar archivos CEA
-- ============================================================================

-- Política: Admins tienen acceso completo a todos los archivos CEA
DROP POLICY IF EXISTS "admins_have_full_access_to_cea_files" ON public.cea_files;

CREATE POLICY "admins_have_full_access_to_cea_files"
ON public.cea_files
FOR ALL
TO authenticated
USING (
  public.is_admin()
)
WITH CHECK (
  public.is_admin()
);

-- Política: Usuarios pueden ver SOLO el último CEA completado
-- Esta es la consulta más frecuente: "Dame el último CEA disponible"
DROP POLICY IF EXISTS "users_can_view_latest_cea" ON public.cea_files;

CREATE POLICY "users_can_view_latest_cea"
ON public.cea_files
FOR SELECT
TO authenticated
USING (
  -- Solo CEAs que estén marcados como latest y completados
  is_latest = TRUE
  AND processing_status = 'completed'
);

-- Política: Verificar que processed_by coincide con el admin que procesó
DROP POLICY IF EXISTS "cea_files_must_be_processed_by_current_admin" ON public.cea_files;

CREATE POLICY "cea_files_must_be_processed_by_current_admin"
ON public.cea_files
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  AND processed_by = auth.uid()
);

-- ============================================================================
-- POLÍTICAS RLS PARA: public.processing_logs
-- ============================================================================
-- Reglas de acceso:
-- - Solo admins pueden ver logs de procesamiento
-- - Solo el sistema (via service_role_key) puede insertar logs
-- - Nadie puede modificar o eliminar logs (auditoría inmutable)
-- ============================================================================

-- Política: Admins pueden ver todos los logs
DROP POLICY IF EXISTS "admins_can_view_processing_logs" ON public.processing_logs;

CREATE POLICY "admins_can_view_processing_logs"
ON public.processing_logs
FOR SELECT
TO authenticated
USING (
  public.is_admin()
);

-- Política: Solo el sistema puede insertar logs
-- Los logs son insertados por Edge Functions usando service_role_key
-- NO permitimos inserciones desde el cliente
DROP POLICY IF EXISTS "only_service_role_can_insert_logs" ON public.processing_logs;

CREATE POLICY "only_service_role_can_insert_logs"
ON public.processing_logs
FOR INSERT
TO authenticated
WITH CHECK (
  -- Esta política siempre retorna FALSE para usuarios autenticados
  -- Solo service_role_key (que bypasea RLS) puede insertar
  FALSE
);

-- Nota: Los logs NO pueden ser actualizados ni eliminados
-- Si se necesita eliminar logs antiguos, debe hacerse manualmente por un superusuario

-- ============================================================================
-- TRIGGERS ADICIONALES PARA CONTROL DE VERSIONES
-- ============================================================================

-- ============================================================================
-- FUNCIÓN: update_cea_latest_flag
-- ============================================================================
-- Cuando se inserta o actualiza un CEA con is_latest = TRUE,
-- automáticamente pone is_latest = FALSE en todos los demás CEAs
-- Esto asegura que SOLO UN CEA tenga is_latest = TRUE a la vez
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_cea_latest_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si el nuevo CEA se está marcando como latest
  IF NEW.is_latest = TRUE THEN
    -- Poner is_latest = FALSE en todos los demás CEAs
    UPDATE public.cea_files
    SET is_latest = FALSE
    WHERE id != NEW.id  -- Excluir el CEA actual
    AND is_latest = TRUE;  -- Solo actualizar los que actualmente son latest
  END IF;

  RETURN NEW;
END;
$$;

-- Comentario de la función
COMMENT ON FUNCTION public.update_cea_latest_flag IS 'Asegura que solo un CEA tenga is_latest = TRUE';

-- ============================================================================
-- TRIGGER: ensure_single_latest_cea
-- ============================================================================
-- Se dispara ANTES de insertar o actualizar un CEA
-- Llama a update_cea_latest_flag() para mantener consistencia
-- ============================================================================
DROP TRIGGER IF EXISTS ensure_single_latest_cea ON public.cea_files;

CREATE TRIGGER ensure_single_latest_cea
  BEFORE INSERT OR UPDATE OF is_latest ON public.cea_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cea_latest_flag();

-- ============================================================================
-- FUNCIÓN: prevent_master_upload_deletion
-- ============================================================================
-- Previene la eliminación de archivos Master que ya fueron procesados
-- Solo permite eliminar Masters que no están asociados a un CEA completado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_master_upload_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar si el Master está asociado a un CEA completado
  IF EXISTS (
    SELECT 1
    FROM public.cea_files
    WHERE generated_from_batch = OLD.upload_batch_id
    AND processing_status = 'completed'
  ) THEN
    -- Si existe un CEA completado, NO permitir la eliminación
    RAISE EXCEPTION 'No se puede eliminar un Master asociado a un CEA completado';
  END IF;

  -- Si no hay CEA completado, permitir la eliminación
  RETURN OLD;
END;
$$;

-- Comentario de la función
COMMENT ON FUNCTION public.prevent_master_upload_deletion IS 'Previene eliminación de Masters ya procesados';

-- ============================================================================
-- TRIGGER: check_master_upload_deletion
-- ============================================================================
-- Se dispara ANTES de eliminar un Master
-- Llama a prevent_master_upload_deletion() para validar
-- ============================================================================
DROP TRIGGER IF EXISTS check_master_upload_deletion ON public.master_uploads;

CREATE TRIGGER check_master_upload_deletion
  BEFORE DELETE ON public.master_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_master_upload_deletion();

-- ============================================================================
-- FUNCIÓN: auto_increment_cea_version
-- ============================================================================
-- Calcula automáticamente el número de versión del CEA al insertarlo
-- Incrementa en 1 la versión del último CEA
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_increment_cea_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_version INTEGER;
BEGIN
  -- Obtener la versión del último CEA
  SELECT COALESCE(MAX(version), 0) INTO last_version
  FROM public.cea_files;

  -- Asignar versión incrementada al nuevo CEA
  NEW.version := last_version + 1;

  RETURN NEW;
END;
$$;

-- Comentario de la función
COMMENT ON FUNCTION public.auto_increment_cea_version IS 'Auto-incrementa la versión del CEA';

-- ============================================================================
-- TRIGGER: set_cea_version
-- ============================================================================
-- Se dispara ANTES de insertar un nuevo CEA
-- Llama a auto_increment_cea_version() para calcular versión
-- ============================================================================
DROP TRIGGER IF EXISTS set_cea_version ON public.cea_files;

CREATE TRIGGER set_cea_version
  BEFORE INSERT ON public.cea_files
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_increment_cea_version();

-- ============================================================================
-- PERMISOS FINALES
-- ============================================================================
-- Asegurar que usuarios autenticados puedan acceder a las tablas
-- Las políticas RLS controlarán QUÉ filas pueden ver/modificar
-- ============================================================================

-- Permitir SELECT a usuarios autenticados (RLS controla las filas)
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.master_uploads TO authenticated;
GRANT SELECT ON public.cea_files TO authenticated;
GRANT SELECT ON public.processing_logs TO authenticated;

-- Permitir INSERT, UPDATE, DELETE solo donde las políticas RLS lo permitan
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.master_uploads TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cea_files TO authenticated;
-- NO permitir INSERT, UPDATE, DELETE en processing_logs para usuarios normales
-- Solo service_role_key puede escribir logs

-- Permitir uso de secuencias (si hubiera)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- VERIFICACIÓN DE POLÍTICAS
-- ============================================================================
-- Para verificar que las políticas funcionan correctamente:
--
-- 1. Como usuario regular (role = 'user'):
--    - SELECT * FROM public.profiles WHERE id = auth.uid(); -- ✓ Debe funcionar
--    - SELECT * FROM public.master_uploads; -- ✗ Debe retornar 0 filas
--    - SELECT * FROM public.cea_files WHERE is_latest = TRUE; -- ✓ Debe retornar 1 fila
--
-- 2. Como admin (role = 'admin'):
--    - SELECT * FROM public.profiles; -- ✓ Debe retornar todos los perfiles
--    - SELECT * FROM public.master_uploads; -- ✓ Debe retornar todos los Masters
--    - SELECT * FROM public.cea_files; -- ✓ Debe retornar todos los CEAs
--
-- 3. Insertar Master como usuario regular:
--    - INSERT INTO public.master_uploads (...); -- ✗ Debe fallar
--
-- 4. Insertar Master como admin:
--    - INSERT INTO public.master_uploads (...); -- ✓ Debe funcionar
-- ============================================================================

-- ============================================================================
-- FIN DE LA MIGRACIÓN DE RLS
-- ============================================================================
