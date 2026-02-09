-- ============================================================================
-- Migración: Configuración de Storage
-- Sistema de Gestión de Archivos Excel CEA - CONAFE
-- ============================================================================
-- Esta migración configura Supabase Storage para almacenar archivos:
-- 1. Crea bucket "master-files" para archivos Master (privado, solo admins)
-- 2. Crea bucket "cea-files" para archivos CEA (privado, acceso controlado)
-- 3. Define políticas RLS para controlar acceso a los archivos
-- ============================================================================

-- ============================================================================
-- BUCKET: master-files
-- ============================================================================
-- Almacena los 4 archivos Master subidos por administradores
-- PUBLIC = FALSE: Los archivos NO son accesibles públicamente
-- Solo admins pueden subir, ver y descargar archivos de este bucket
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'master-files',
  'master-files',
  FALSE,  -- Privado: requiere autenticación y permisos
  52428800,  -- Límite de 50MB por archivo (50 * 1024 * 1024 bytes)
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  -- .xlsx
    'application/vnd.ms-excel'  -- .xls
  ]
)
ON CONFLICT (id) DO NOTHING;  -- Si ya existe, no hacer nada

-- ============================================================================
-- BUCKET: cea-files
-- ============================================================================
-- Almacena los archivos CEA generados por el sistema
-- PUBLIC = FALSE: Los archivos NO son accesibles públicamente
-- Admins pueden gestionar todos los archivos
-- Users regulares solo pueden ver y descargar el último CEA (is_latest = true)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cea-files',
  'cea-files',
  FALSE,  -- Privado: requiere autenticación y permisos
  104857600,  -- Límite de 100MB por archivo (100 * 1024 * 1024 bytes)
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'  -- .xlsx
  ]
)
ON CONFLICT (id) DO NOTHING;  -- Si ya existe, no hacer nada

-- ============================================================================
-- POLÍTICAS RLS PARA BUCKET: master-files
-- ============================================================================
-- Estas políticas controlan quién puede subir, ver y descargar archivos Master
-- Solo usuarios con rol 'admin' tienen acceso a este bucket
-- ============================================================================

-- Política: Admins pueden subir (INSERT) archivos Master
-- Esta política se evalúa cuando un usuario intenta subir un archivo
CREATE POLICY "admins_can_upload_master_files"
ON storage.objects
FOR INSERT
TO authenticated  -- Solo usuarios autenticados (no anónimos)
WITH CHECK (
  -- El archivo debe estar en el bucket 'master-files'
  bucket_id = 'master-files'
  AND
  -- El usuario debe tener rol 'admin' en la tabla profiles
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()  -- auth.uid() es el ID del usuario autenticado
    AND profiles.role = 'admin'
  )
);

-- Política: Admins pueden ver (SELECT) archivos Master
-- Esta política se evalúa cuando un usuario intenta listar o obtener metadata de archivos
CREATE POLICY "admins_can_select_master_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'master-files'
  AND
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Política: Admins pueden descargar archivos Master
-- NOTA: En Supabase, SELECT policy también controla la descarga
-- Esta política es redundante pero explícita para claridad
CREATE POLICY "admins_can_download_master_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'master-files'
  AND
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Política: Admins pueden eliminar (DELETE) archivos Master
-- Útil para eliminar archivos incorrectos o duplicados
CREATE POLICY "admins_can_delete_master_files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'master-files'
  AND
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- POLÍTICAS RLS PARA BUCKET: cea-files
-- ============================================================================
-- Estas políticas controlan quién puede ver y descargar archivos CEA
-- Admins: acceso total a todos los archivos CEA
-- Users: solo pueden ver y descargar el CEA más reciente (is_latest = true)
-- ============================================================================

-- Política: Admins pueden subir (INSERT) archivos CEA
-- En realidad, los archivos CEA son generados por Edge Functions usando service_role_key
-- Esta política es para casos especiales donde un admin sube manualmente
CREATE POLICY "admins_can_upload_cea_files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cea-files'
  AND
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Política: Admins pueden ver (SELECT) TODOS los archivos CEA
-- Esto permite a admins ver historial completo de CEAs generados
CREATE POLICY "admins_can_select_all_cea_files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cea-files'
  AND
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Política: Users regulares pueden ver y descargar SOLO el último CEA
-- Esta política verifica que el archivo CEA tenga is_latest = true en la tabla cea_files
CREATE POLICY "users_can_download_latest_cea_file"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'cea-files'
  AND
  -- Extraer el nombre del archivo desde el path (formato: "cea-files/{uuid}_{filename}")
  -- Luego verificar en cea_files que ese archivo tenga is_latest = true
  EXISTS (
    SELECT 1
    FROM public.cea_files
    WHERE cea_files.file_path = storage.objects.name  -- Comparar path completo
    AND cea_files.is_latest = TRUE  -- Solo el CEA más reciente
    AND cea_files.processing_status = 'completed'  -- Solo CEAs completados
  )
);

-- Política: Admins pueden eliminar (DELETE) archivos CEA
-- Útil para limpieza de archivos antiguos o erróneos
CREATE POLICY "admins_can_delete_cea_files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cea-files'
  AND
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- FUNCIONES HELPER PARA STORAGE
-- ============================================================================

-- Función: Generar URL firmada para descarga segura
-- Las URLs firmadas expiran después de un tiempo (ej: 15 minutos)
-- Esto previene que URLs compartidas sean válidas indefinidamente
COMMENT ON SCHEMA storage IS 'Supabase Storage ya provee signed URLs via client SDK';

-- ============================================================================
-- FIN DE LA MIGRACIÓN DE STORAGE
-- ============================================================================
