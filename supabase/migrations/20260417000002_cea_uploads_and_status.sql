-- ============================================================================
-- Migración: cea_uploads + estado 'ingested' en master_uploads
-- ============================================================================
-- 1) Agrega 'ingested' a los estados válidos de master_uploads (además del
--    'validated' previo; el ingest-master nuevo marcará el Master como
--    'ingested' una vez que todas sus filas fueron persistidas en las tablas
--    relacionales).
-- 2) Añade ciclo_escolar e ingest_batch_id a master_uploads para trazabilidad.
-- 3) Crea la tabla cea_uploads: archivos CEA subidos para capturar los campos
--    que NO provienen de los masters (nuevo módulo "Subir CEA").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Añadir 'ingested' al CHECK de master_uploads.status
-- ----------------------------------------------------------------------------
ALTER TABLE public.master_uploads
  DROP CONSTRAINT IF EXISTS master_uploads_status_check;

ALTER TABLE public.master_uploads
  ADD CONSTRAINT master_uploads_status_check
  CHECK (status IN ('uploaded', 'validating', 'validated', 'ingesting', 'ingested', 'error'));

COMMENT ON COLUMN public.master_uploads.status IS
  'uploaded → validating → validated → ingesting → ingested (o error en cualquier paso)';

-- ----------------------------------------------------------------------------
-- 2) Trazabilidad del ingest en master_uploads
-- ----------------------------------------------------------------------------
ALTER TABLE public.master_uploads
  ADD COLUMN IF NOT EXISTS ciclo_escolar   TEXT,
  ADD COLUMN IF NOT EXISTS ingest_batch_id UUID,
  ADD COLUMN IF NOT EXISTS ingested_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ingest_stats    JSONB;

CREATE INDEX IF NOT EXISTS idx_master_uploads_ciclo
  ON public.master_uploads(ciclo_escolar);
CREATE INDEX IF NOT EXISTS idx_master_uploads_ingest_batch
  ON public.master_uploads(ingest_batch_id);

COMMENT ON COLUMN public.master_uploads.ingest_stats IS
  'Conteo por tabla destino: { "figuras": 120, "figura_bajas": 4, ... }';

-- ----------------------------------------------------------------------------
-- 3) Tabla cea_uploads: CEAs que el admin sube para persistir campos manuales
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cea_uploads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name         TEXT NOT NULL,
  file_path         TEXT NOT NULL,
  file_size         BIGINT NOT NULL CHECK (file_size > 0),
  ciclo_escolar     TEXT,
  status            TEXT NOT NULL
                      CHECK (status IN ('uploaded', 'processing', 'processed', 'error'))
                      DEFAULT 'uploaded',
  processing_errors JSONB,
  -- Conteo por tabla destino de campos manuales:
  -- { "figura_datos_manuales": 540, "figura_siiinafe": 540,
  --   "cct_infraestructura": 119, "cct_datos_externos": 119,
  --   "figuras_no_encontradas": 3, "ccts_no_encontrados": 1 }
  ingest_stats      JSONB,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cea_uploads_uploaded_by ON public.cea_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_cea_uploads_ciclo ON public.cea_uploads(ciclo_escolar);
CREATE INDEX IF NOT EXISTS idx_cea_uploads_status ON public.cea_uploads(status);
CREATE INDEX IF NOT EXISTS idx_cea_uploads_created ON public.cea_uploads(created_at DESC);

DROP TRIGGER IF EXISTS trg_cea_uploads_updated_at ON public.cea_uploads;
CREATE TRIGGER trg_cea_uploads_updated_at
  BEFORE UPDATE ON public.cea_uploads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.cea_uploads IS
  'Archivos CEA subidos para capturar los campos que no provienen de los Masters';

-- ----------------------------------------------------------------------------
-- 4) Permitir a processing_logs referenciar un cea_upload (opcional)
-- ----------------------------------------------------------------------------
ALTER TABLE public.processing_logs
  ADD COLUMN IF NOT EXISTS cea_upload_id UUID REFERENCES public.cea_uploads(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_processing_logs_cea_upload
  ON public.processing_logs(cea_upload_id);
