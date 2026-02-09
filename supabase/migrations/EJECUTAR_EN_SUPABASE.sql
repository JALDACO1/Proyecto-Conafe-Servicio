-- ============================================================================
-- INSTRUCCIONES: Ejecutar este archivo en Supabase SQL Editor
-- ============================================================================
-- IMPORTANTE: Ejecuta cada migración UNA POR UNA, en el orden indicado
-- Después de cada migración, verifica que se ejecutó correctamente
-- ============================================================================

-- ============================================================================
-- MIGRACIÓN 1: Esquema Inicial
-- ============================================================================
-- Crear tablas principales: profiles, master_uploads, cea_files, processing_logs
-- ============================================================================

-- Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Tabla de archivos Master subidos
CREATE TABLE IF NOT EXISTS public.master_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('alumnos', 'servicios', 'figuras', 'telefonia')),

  status TEXT NOT NULL CHECK (status IN ('uploaded', 'validating', 'validated', 'error')) DEFAULT 'uploaded',
  validation_errors JSONB,

  record_count INTEGER,
  upload_batch_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para master_uploads
CREATE INDEX IF NOT EXISTS idx_master_uploads_batch ON public.master_uploads(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_master_uploads_type ON public.master_uploads(file_type);
CREATE INDEX IF NOT EXISTS idx_master_uploads_status ON public.master_uploads(status);
CREATE INDEX IF NOT EXISTS idx_master_uploads_uploaded_by ON public.master_uploads(uploaded_by);

-- Tabla de archivos CEA generados
CREATE TABLE IF NOT EXISTS public.cea_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,

  generated_from_batch UUID NOT NULL,
  processed_by UUID NOT NULL REFERENCES public.profiles(id),
  processing_status TEXT NOT NULL CHECK (processing_status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
  processing_errors JSONB,

  total_records INTEGER,
  processing_time_ms INTEGER,

  version INTEGER DEFAULT 1,
  is_latest BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para cea_files
CREATE INDEX IF NOT EXISTS idx_cea_files_latest ON public.cea_files(is_latest) WHERE is_latest = TRUE;
CREATE INDEX IF NOT EXISTS idx_cea_files_batch ON public.cea_files(generated_from_batch);
CREATE INDEX IF NOT EXISTS idx_cea_files_status ON public.cea_files(processing_status);

-- Tabla de logs de procesamiento
CREATE TABLE IF NOT EXISTS public.processing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cea_file_id UUID REFERENCES public.cea_files(id) ON DELETE CASCADE,
  upload_batch_id UUID,

  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para processing_logs
CREATE INDEX IF NOT EXISTS idx_processing_logs_cea_file ON public.processing_logs(cea_file_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_batch ON public.processing_logs(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_level ON public.processing_logs(level);

-- ============================================================================
-- MIGRACIÓN 2: Storage Setup
-- ============================================================================
-- Crear buckets y políticas de storage
-- ============================================================================

-- Crear bucket para archivos Master (privado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'master-files',
  'master-files',
  FALSE,
  52428800,  -- 50MB
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Crear bucket para archivos CEA (privado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cea-files',
  'cea-files',
  FALSE,
  104857600,  -- 100MB
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Políticas para master-files bucket
CREATE POLICY "admins_can_upload_master_files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'master-files'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "admins_can_select_master_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'master-files'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "admins_can_delete_master_files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'master-files'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Políticas para cea-files bucket
CREATE POLICY "admins_can_upload_cea_files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cea-files'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "admins_can_select_all_cea_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cea-files'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "users_can_download_latest_cea_file"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cea-files'
  AND EXISTS (
    SELECT 1 FROM public.cea_files
    WHERE cea_files.file_path = storage.objects.name
    AND cea_files.is_latest = TRUE
    AND cea_files.processing_status = 'completed'
  )
);

CREATE POLICY "admins_can_delete_cea_files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cea-files'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- MIGRACIÓN 3: Auth Setup
-- ============================================================================
-- Triggers y funciones de autenticación
-- ============================================================================

-- Función: Crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'user',
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Trigger: Ejecutar handle_new_user al crear usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Función: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers para actualizar updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_master_uploads_updated_at ON public.master_uploads;
CREATE TRIGGER update_master_uploads_updated_at
  BEFORE UPDATE ON public.master_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Función: Promover usuario a admin
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET role = 'admin'
  WHERE email = user_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario con email % no encontrado', user_email;
  END IF;

  RAISE NOTICE 'Usuario % promovido a admin', user_email;
END;
$$;

-- Función: Degradar admin a usuario
CREATE OR REPLACE FUNCTION public.demote_admin_to_user(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET role = 'user'
  WHERE email = user_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario con email % no encontrado', user_email;
  END IF;

  RAISE NOTICE 'Admin % degradado a usuario regular', user_email;
END;
$$;

-- Función: Obtener rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN user_role;
END;
$$;

-- Función: Verificar si usuario es admin
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

-- Permisos
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_user_to_admin(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.demote_admin_to_user(TEXT) FROM authenticated;

-- ============================================================================
-- MIGRACIÓN 4: RLS Policies
-- ============================================================================
-- Políticas de Row Level Security
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cea_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
DROP POLICY IF EXISTS "users_can_view_own_profile" ON public.profiles;
CREATE POLICY "users_can_view_own_profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "admins_can_view_all_profiles" ON public.profiles;
CREATE POLICY "admins_can_view_all_profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "admins_can_update_profiles" ON public.profiles;
CREATE POLICY "admins_can_update_profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;
CREATE POLICY "users_can_update_own_profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- Políticas para master_uploads
DROP POLICY IF EXISTS "admins_have_full_access_to_master_uploads" ON public.master_uploads;
CREATE POLICY "admins_have_full_access_to_master_uploads"
ON public.master_uploads FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "master_uploads_must_be_owned_by_uploader" ON public.master_uploads;
CREATE POLICY "master_uploads_must_be_owned_by_uploader"
ON public.master_uploads FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  AND uploaded_by = auth.uid()
);

-- Políticas para cea_files
DROP POLICY IF EXISTS "admins_have_full_access_to_cea_files" ON public.cea_files;
CREATE POLICY "admins_have_full_access_to_cea_files"
ON public.cea_files FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "users_can_view_latest_cea" ON public.cea_files;
CREATE POLICY "users_can_view_latest_cea"
ON public.cea_files FOR SELECT TO authenticated
USING (
  is_latest = TRUE
  AND processing_status = 'completed'
);

DROP POLICY IF EXISTS "cea_files_must_be_processed_by_current_admin" ON public.cea_files;
CREATE POLICY "cea_files_must_be_processed_by_current_admin"
ON public.cea_files FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  AND processed_by = auth.uid()
);

-- Políticas para processing_logs
DROP POLICY IF EXISTS "admins_can_view_processing_logs" ON public.processing_logs;
CREATE POLICY "admins_can_view_processing_logs"
ON public.processing_logs FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "only_service_role_can_insert_logs" ON public.processing_logs;
CREATE POLICY "only_service_role_can_insert_logs"
ON public.processing_logs FOR INSERT TO authenticated
WITH CHECK (FALSE);

-- Función: Mantener solo un CEA como latest
CREATE OR REPLACE FUNCTION public.update_cea_latest_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_latest = TRUE THEN
    UPDATE public.cea_files
    SET is_latest = FALSE
    WHERE id != NEW.id AND is_latest = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_single_latest_cea ON public.cea_files;
CREATE TRIGGER ensure_single_latest_cea
  BEFORE INSERT OR UPDATE OF is_latest ON public.cea_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cea_latest_flag();

-- Función: Prevenir eliminación de Masters procesados
CREATE OR REPLACE FUNCTION public.prevent_master_upload_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.cea_files
    WHERE generated_from_batch = OLD.upload_batch_id
    AND processing_status = 'completed'
  ) THEN
    RAISE EXCEPTION 'No se puede eliminar un Master asociado a un CEA completado';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS check_master_upload_deletion ON public.master_uploads;
CREATE TRIGGER check_master_upload_deletion
  BEFORE DELETE ON public.master_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_master_upload_deletion();

-- Función: Auto-incrementar versión de CEA
CREATE OR REPLACE FUNCTION public.auto_increment_cea_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version), 0) INTO last_version
  FROM public.cea_files;

  NEW.version := last_version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_cea_version ON public.cea_files;
CREATE TRIGGER set_cea_version
  BEFORE INSERT ON public.cea_files
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_increment_cea_version();

-- Permisos finales
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.master_uploads TO authenticated;
GRANT SELECT ON public.cea_files TO authenticated;
GRANT SELECT ON public.processing_logs TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.master_uploads TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cea_files TO authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- ¡MIGRACIONES COMPLETADAS!
-- ============================================================================
-- Verifica que todo se ejecutó correctamente:
-- 1. Ve a Table Editor → deberías ver 4 tablas
-- 2. Ve a Storage → deberías ver 2 buckets (master-files, cea-files)
-- ============================================================================
