-- ============================================================================
-- Migración Inicial: Esquema de Base de Datos
-- Sistema de Gestión de Archivos Excel CEA - CONAFE
-- ============================================================================
-- Esta migración crea todas las tablas principales del sistema:
-- 1. profiles - Perfiles de usuario con roles (admin/user)
-- 2. master_uploads - Archivos Master subidos por administradores
-- 3. cea_files - Archivos CEA generados por el sistema
-- 4. processing_logs - Logs de procesamiento y errores
-- ============================================================================

-- ============================================================================
-- TABLA: profiles
-- ============================================================================
-- Almacena información adicional de los usuarios autenticados
-- Se relaciona con auth.users (tabla de autenticación de Supabase)
-- Cada usuario tiene un rol: 'admin' (puede subir/procesar) o 'user' (solo descarga)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  -- ID del usuario (referencia a auth.users)
  -- CASCADE asegura que si se elimina el usuario de auth, también se elimina su perfil
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email del usuario (copiado de auth.users para acceso rápido)
  email TEXT UNIQUE NOT NULL,

  -- Nombre completo del usuario (opcional)
  full_name TEXT,

  -- Rol del usuario: 'admin' puede subir y procesar, 'user' solo puede descargar
  -- DEFAULT 'user' asegura que nuevos usuarios no tengan permisos de admin por defecto
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',

  -- Timestamps de creación y actualización
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentario de la tabla para documentación
COMMENT ON TABLE public.profiles IS 'Perfiles de usuario con roles y metadata adicional';
COMMENT ON COLUMN public.profiles.role IS 'Rol del usuario: admin (gestión completa) o user (solo descarga)';

-- ============================================================================
-- TABLA: master_uploads
-- ============================================================================
-- Almacena información de los archivos Master subidos por administradores
-- Se requieren exactamente 4 tipos de archivos Master para generar un CEA:
-- - alumnos: Master de Alumnos
-- - servicios: Master de Servicios
-- - figuras: Master de Figuras Educativas
-- - telefonia: Master de Telefonía
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.master_uploads (
  -- ID único del archivo Master
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Usuario que subió el archivo (debe ser admin)
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- ======== Metadata del archivo ========
  -- Nombre original del archivo (ej: "Master_Alumnos_22_10_2025.xlsx")
  file_name TEXT NOT NULL,

  -- Ruta del archivo en Supabase Storage
  -- Formato: "master-files/{batch_id}/{uuid}_{file_name}"
  file_path TEXT NOT NULL,

  -- Tamaño del archivo en bytes
  file_size BIGINT NOT NULL CHECK (file_size > 0),

  -- Tipo de archivo Master (determina qué procesamiento aplicar)
  -- - alumnos: Datos de alumnos por microrregión, género y nivel
  -- - servicios: Datos de servicios por microrregión y modalidad
  -- - figuras: Datos de figuras educativas (educadores, coordinadores)
  -- - telefonia: Datos de telefonía (actualmente no procesado)
  file_type TEXT NOT NULL CHECK (file_type IN ('alumnos', 'servicios', 'figuras', 'telefonia')),

  -- ======== Estado de procesamiento ========
  -- Estado del archivo:
  -- - uploaded: Recién subido, esperando validación
  -- - validating: Edge Function validate-master está procesando
  -- - validated: Estructura validada, listo para procesamiento de CEA
  -- - error: Error en validación, ver validation_errors
  status TEXT NOT NULL CHECK (status IN ('uploaded', 'validating', 'validated', 'error')) DEFAULT 'uploaded',

  -- Errores de validación en formato JSON (null si no hay errores)
  -- Ejemplo: {"errors": ["Columna 'Microregion' faltante", "Hoja 'Master' no encontrada"]}
  validation_errors JSONB,

  -- ======== Metadata para generación de CEA ========
  -- Número de registros encontrados en el archivo (después de validación)
  record_count INTEGER CHECK (record_count >= 0),

  -- ID de batch que agrupa los 4 archivos Master subidos juntos
  -- Todos los Masters de un mismo batch se procesan juntos para generar 1 CEA
  upload_batch_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentarios de la tabla
COMMENT ON TABLE public.master_uploads IS 'Archivos Master subidos por administradores para generar CEAs';
COMMENT ON COLUMN public.master_uploads.file_type IS 'Tipo de Master: alumnos, servicios, figuras o telefonia';
COMMENT ON COLUMN public.master_uploads.status IS 'Estado: uploaded, validating, validated o error';
COMMENT ON COLUMN public.master_uploads.upload_batch_id IS 'Agrupa los 4 Masters que se procesan juntos';

-- ============================================================================
-- TABLA: cea_files
-- ============================================================================
-- Almacena información de los archivos CEA generados por el sistema
-- Un archivo CEA se genera a partir de 4 archivos Master válidos
-- Solo el último archivo CEA (is_latest = true) es visible para usuarios regulares
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cea_files (
  -- ID único del archivo CEA
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ======== Metadata del archivo ========
  -- Nombre del archivo CEA generado
  -- Formato: "CEA_DD_MM_YYYY.xlsx" (ej: "CEA_22_10_2025.xlsx")
  file_name TEXT NOT NULL,

  -- Ruta del archivo en Supabase Storage
  -- Formato: "cea-files/{uuid}_{file_name}"
  file_path TEXT NOT NULL,

  -- Tamaño del archivo en bytes
  file_size BIGINT NOT NULL CHECK (file_size > 0),

  -- ======== Metadata de procesamiento ========
  -- ID del batch de Masters desde el cual se generó este CEA
  generated_from_batch UUID NOT NULL,

  -- Usuario admin que procesó los Masters para generar este CEA
  processed_by UUID NOT NULL REFERENCES public.profiles(id),

  -- Estado del procesamiento:
  -- - processing: Edge Function process-cea está generando el archivo
  -- - completed: CEA generado exitosamente, disponible para descarga
  -- - failed: Error en procesamiento, ver processing_errors
  processing_status TEXT NOT NULL CHECK (processing_status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',

  -- Errores de procesamiento en formato JSON (null si no hay errores)
  -- Ejemplo: {"errors": ["Error al hacer merge de DataFrames", "Memoria insuficiente"]}
  processing_errors JSONB,

  -- ======== Estadísticas ========
  -- Número total de registros/filas en el CEA generado
  total_records INTEGER CHECK (total_records >= 0),

  -- Tiempo que tomó el procesamiento en milisegundos
  processing_time_ms INTEGER CHECK (processing_time_ms >= 0),

  -- ======== Control de versiones ========
  -- Número de versión del CEA (incrementa con cada generación)
  version INTEGER NOT NULL DEFAULT 1,

  -- Indica si este es el CEA más reciente
  -- Solo UN archivo puede tener is_latest = true a la vez
  -- Usuarios regulares solo ven el CEA con is_latest = true
  is_latest BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamp de creación
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentarios de la tabla
COMMENT ON TABLE public.cea_files IS 'Archivos CEA generados a partir de los 4 Masters';
COMMENT ON COLUMN public.cea_files.is_latest IS 'Solo el último CEA tiene is_latest = true';
COMMENT ON COLUMN public.cea_files.processing_status IS 'Estado: processing, completed o failed';
COMMENT ON COLUMN public.cea_files.generated_from_batch IS 'Batch de Masters usado para generar este CEA';

-- ============================================================================
-- TABLA: processing_logs
-- ============================================================================
-- Almacena logs detallados del procesamiento de CEAs
-- Útil para debugging y auditoría de errores
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.processing_logs (
  -- ID único del log
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ID del archivo CEA al que pertenece este log (opcional)
  cea_file_id UUID REFERENCES public.cea_files(id) ON DELETE CASCADE,

  -- ID del batch de Masters (útil para logs de validación)
  upload_batch_id UUID,

  -- Nivel del log:
  -- - info: Información general (ej: "Iniciando procesamiento")
  -- - warning: Advertencias no críticas (ej: "Microrregión sin figuras asignadas")
  -- - error: Errores que impiden el procesamiento (ej: "Columna faltante")
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error')),

  -- Mensaje descriptivo del log
  message TEXT NOT NULL,

  -- Detalles adicionales en formato JSON
  -- Ejemplo: {"file": "Master_Alumnos.xlsx", "row": 523, "error": "Valor NULL en campo requerido"}
  details JSONB,

  -- Timestamp del log
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentarios de la tabla
COMMENT ON TABLE public.processing_logs IS 'Logs de procesamiento para debugging y auditoría';
COMMENT ON COLUMN public.processing_logs.level IS 'Nivel del log: info, warning o error';

-- ============================================================================
-- ÍNDICES
-- ============================================================================
-- Los índices mejoran el rendimiento de consultas frecuentes
-- ============================================================================

-- Índices para tabla profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Índices para tabla master_uploads
CREATE INDEX IF NOT EXISTS idx_master_uploads_batch ON public.master_uploads(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_master_uploads_type ON public.master_uploads(file_type);
CREATE INDEX IF NOT EXISTS idx_master_uploads_status ON public.master_uploads(status);
CREATE INDEX IF NOT EXISTS idx_master_uploads_created ON public.master_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_uploads_uploaded_by ON public.master_uploads(uploaded_by);

-- Índices para tabla cea_files
CREATE INDEX IF NOT EXISTS idx_cea_files_batch ON public.cea_files(generated_from_batch);
CREATE INDEX IF NOT EXISTS idx_cea_files_created ON public.cea_files(created_at DESC);
-- Índice parcial: solo indexa el CEA más reciente (is_latest = true)
-- Esto optimiza la consulta más frecuente: "dame el último CEA"
CREATE INDEX IF NOT EXISTS idx_cea_files_latest ON public.cea_files(is_latest)
  WHERE is_latest = TRUE;

-- Índices para tabla processing_logs
CREATE INDEX IF NOT EXISTS idx_processing_logs_cea ON public.processing_logs(cea_file_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_batch ON public.processing_logs(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_created ON public.processing_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processing_logs_level ON public.processing_logs(level);

-- ============================================================================
-- FIN DE LA MIGRACIÓN INICIAL
-- ============================================================================
