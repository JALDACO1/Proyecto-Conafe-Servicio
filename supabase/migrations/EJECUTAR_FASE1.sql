-- ============================================================================
-- EJECUTAR_FASE1.sql — Reestructuración CONAFE (Fase 1)
-- ============================================================================
-- Pegar completo en Supabase SQL Editor y ejecutar. Idempotente: puede
-- re-ejecutarse; las tablas ya existentes se dejan intactas.
-- ============================================================================

-- >>> MIGRATION 1: 20260417000000_relational_schema.sql <<<
-- ============================================================================
-- Migración: Esquema Relacional CONAFE
-- ============================================================================
-- Persiste los datos de los 3 Masters (Servicios, Figuras, Alumnos) en tablas
-- normalizadas según la hoja "Esquema relacional" de Datos_a_recuperar.xlsx.
--
-- Convención:
--   - PKs naturales (cveEstado, cct, numeroControl, IdAlumno) cuando existen.
--   - Todas las tablas transaccionales llevan ciclo_escolar + ingest_batch_id.
--   - updated_at se mantiene con el trigger genérico set_updated_at().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Función utilitaria: set_updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- GEOGRAFÍA (jerarquía territorial)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.estados (
  cve_estado       INTEGER PRIMARY KEY,
  nom_estado       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.zonas (
  cve_zona         INTEGER PRIMARY KEY,
  nom_zona         TEXT,
  cve_estado       INTEGER REFERENCES public.estados(cve_estado),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_zonas_estado ON public.zonas(cve_estado);

CREATE TABLE IF NOT EXISTS public.regiones (
  cve_region       INTEGER PRIMARY KEY,
  nom_region       TEXT,
  cve_zona         INTEGER REFERENCES public.zonas(cve_zona),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_regiones_zona ON public.regiones(cve_zona);

CREATE TABLE IF NOT EXISTS public.microrregiones (
  cve_microregion  INTEGER PRIMARY KEY,
  nom_microregion  TEXT,
  cve_region       INTEGER REFERENCES public.regiones(cve_region),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_microrregiones_region ON public.microrregiones(cve_region);

CREATE TABLE IF NOT EXISTS public.municipios (
  cve_municipio    INTEGER PRIMARY KEY,
  nom_municipio    TEXT,
  cve_estado       INTEGER REFERENCES public.estados(cve_estado),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_municipios_estado ON public.municipios(cve_estado);

CREATE TABLE IF NOT EXISTS public.localidades (
  cve_localidad    INTEGER PRIMARY KEY,
  nom_localidad    TEXT,
  cve_municipio    INTEGER REFERENCES public.municipios(cve_municipio),
  grado_marginacion TEXT,
  grado_rezago     TEXT,
  pobtot           INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_localidades_municipio ON public.localidades(cve_municipio);

-- ============================================================================
-- SERVICIO EDUCATIVO
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.modalidades (
  cve_modalidad    INTEGER PRIMARY KEY,
  nom_modalidad    TEXT,
  cve_programa     INTEGER,
  nom_programa     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Centro de trabajo: la PK natural es la clave CCT (string alfanumérico).
CREATE TABLE IF NOT EXISTS public.ccts (
  cct              TEXT PRIMARY KEY,
  nombre_cct       TEXT,
  cve_localidad    INTEGER REFERENCES public.localidades(cve_localidad),
  cve_microregion  INTEGER REFERENCES public.microrregiones(cve_microregion),
  cve_modalidad    INTEGER REFERENCES public.modalidades(cve_modalidad),
  status_or        TEXT,
  instalado        TEXT,
  status_sucecom   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ccts_localidad ON public.ccts(cve_localidad);
CREATE INDEX IF NOT EXISTS idx_ccts_microregion ON public.ccts(cve_microregion);
CREATE INDEX IF NOT EXISTS idx_ccts_modalidad ON public.ccts(cve_modalidad);

-- Estadísticas por CCT (uno a uno con ccts, versionado por ciclo_escolar).
CREATE TABLE IF NOT EXISTS public.servicio_estadisticas (
  cct                  TEXT NOT NULL REFERENCES public.ccts(cct) ON DELETE CASCADE,
  ciclo_escolar        TEXT NOT NULL,
  instructores_h       INTEGER,
  instructores_m       INTEGER,
  no_instructores_total INTEGER,
  n1_h_ciclo           INTEGER,
  n2_h_ciclo           INTEGER,
  n3_h_ciclo           INTEGER,
  n1_m_ciclo           INTEGER,
  n2_m_ciclo           INTEGER,
  n3_m_ciclo           INTEGER,
  alum_h               INTEGER,
  alum_m               INTEGER,
  tot_alum             INTEGER,
  ninos                INTEGER,
  ninas                INTEGER,
  madres               INTEGER,
  padres               INTEGER,
  embarazadas          INTEGER,
  cuidadores           INTEGER,
  ingest_batch_id      UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cct, ciclo_escolar)
);
CREATE INDEX IF NOT EXISTS idx_servicio_est_ciclo ON public.servicio_estadisticas(ciclo_escolar);
CREATE INDEX IF NOT EXISTS idx_servicio_est_batch ON public.servicio_estadisticas(ingest_batch_id);

-- ============================================================================
-- FIGURAS EDUCATIVAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bancos (
  cve_banco        INTEGER PRIMARY KEY,
  nom_banco        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sedes_formacion (
  cv_sede          INTEGER PRIMARY KEY,
  nombre_sede      TEXT,
  cve_zona_formacion    INTEGER,
  zona_formacion        TEXT,
  cve_region_formacion  INTEGER,
  region_formacion      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.figuras (
  numero_control   TEXT PRIMARY KEY,
  curp             TEXT UNIQUE,
  apellido_paterno TEXT,
  apellido_materno TEXT,
  nombre           TEXT,
  edad             INTEGER,
  genero           TEXT,
  fecha_nacimiento DATE,
  telefono         TEXT,
  correo           TEXT,
  id_figura        TEXT,
  figura           TEXT,
  generacion       INTEGER,
  fecha_ingreso    DATE,
  anios_servicio_conafe INTEGER,
  situacion_actual TEXT,
  descripcion_situacion TEXT,
  cct              TEXT REFERENCES public.ccts(cct),
  cve_banco        INTEGER REFERENCES public.bancos(cve_banco),
  numero_cuenta    TEXT,
  clabe            TEXT,
  -- Residencia
  cve_estado_res       INTEGER,
  estado_residencia    TEXT,
  cve_municipio_res    INTEGER,
  municipio_residencia TEXT,
  cve_localidad_res    INTEGER,
  localidad_residencia TEXT,
  -- Servicio social
  cve_estado_ss        INTEGER,
  estado_servicio_social    TEXT,
  cve_municipio_ss     INTEGER,
  municipio_servicio_social TEXT,
  cve_localidad_ss     INTEGER,
  localidad_servicio_social TEXT,
  -- Vestimenta
  talla_playera    TEXT,
  talla_pants      TEXT,
  numero_calzado   TEXT,
  -- Ciclo y sede
  fecha_inicio_servicio DATE,
  cv_sede          INTEGER REFERENCES public.sedes_formacion(cv_sede),
  ciclo_escolar    TEXT,
  ingest_batch_id  UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_figuras_cct ON public.figuras(cct);
CREATE INDEX IF NOT EXISTS idx_figuras_id_figura ON public.figuras(id_figura);
CREATE INDEX IF NOT EXISTS idx_figuras_banco ON public.figuras(cve_banco);
CREATE INDEX IF NOT EXISTS idx_figuras_sede ON public.figuras(cv_sede);
CREATE INDEX IF NOT EXISTS idx_figuras_ciclo ON public.figuras(ciclo_escolar);
CREATE INDEX IF NOT EXISTS idx_figuras_batch ON public.figuras(ingest_batch_id);

CREATE TABLE IF NOT EXISTS public.figura_bajas (
  numero_control   TEXT PRIMARY KEY REFERENCES public.figuras(numero_control) ON DELETE CASCADE,
  fecha_baja       DATE,
  causa_desercion  TEXT,
  causa_baja       TEXT,
  ciclo_escolar    TEXT,
  ingest_batch_id  UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_figura_bajas_ciclo ON public.figura_bajas(ciclo_escolar);

-- ============================================================================
-- ALUMNOS Y TUTORES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alumnos (
  id_alumno        BIGINT PRIMARY KEY,
  id_control       BIGINT UNIQUE,
  curp             TEXT UNIQUE,
  apellido_paterno TEXT,
  apellido_materno TEXT,
  nombre           TEXT,
  genero           TEXT,
  fecha_nacimiento DATE,
  edad_anios_inicio_ciclo  INTEGER,
  edad_meses_inicio_ciclo  INTEGER,
  nivel            TEXT,
  id_programa      INTEGER,
  programa         TEXT,
  situacion_alumno TEXT,
  estatus_alumno   TEXT,
  cct              TEXT REFERENCES public.ccts(cct),
  fecha_inscripcion DATE,
  talla_playera    TEXT,
  talla_pantalon   TEXT,
  calzado          TEXT,
  -- Baja
  baja             TEXT,
  id_baja          INTEGER,
  causa_baja       TEXT,
  motivo_baja      TEXT,
  fecha_baja       DATE,
  ciclo_escolar    TEXT,
  ingest_batch_id  UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alumnos_cct ON public.alumnos(cct);
CREATE INDEX IF NOT EXISTS idx_alumnos_programa ON public.alumnos(id_programa);
CREATE INDEX IF NOT EXISTS idx_alumnos_nivel ON public.alumnos(nivel);
CREATE INDEX IF NOT EXISTS idx_alumnos_ciclo ON public.alumnos(ciclo_escolar);
CREATE INDEX IF NOT EXISTS idx_alumnos_batch ON public.alumnos(ingest_batch_id);

-- Tutor (0, 1 o 2 por alumno)
CREATE TABLE IF NOT EXISTS public.tutores (
  id_alumno        BIGINT NOT NULL REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE,
  num_tutor        SMALLINT NOT NULL CHECK (num_tutor IN (1, 2)),
  curp             TEXT,
  parentezco       TEXT,
  genero           TEXT,
  nombre           TEXT,
  primer_apellido  TEXT,
  segundo_apellido TEXT,
  vive             TEXT,
  escolaridad      TEXT,
  lengua           TEXT,
  ciclo_escolar    TEXT,
  ingest_batch_id  UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_alumno, num_tutor)
);
CREATE INDEX IF NOT EXISTS idx_tutores_parentezco ON public.tutores(parentezco);
CREATE INDEX IF NOT EXISTS idx_tutores_genero ON public.tutores(genero);

-- Calificaciones por materia (5 periodos + promedio)
CREATE TABLE IF NOT EXISTS public.calificaciones (
  id_alumno        BIGINT NOT NULL REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE,
  ciclo_escolar    TEXT NOT NULL,
  espanol_1        NUMERIC, espanol_2 NUMERIC, espanol_3 NUMERIC, espanol_4 NUMERIC, espanol_5 NUMERIC, espanol_p NUMERIC,
  matematicas_1    NUMERIC, matematicas_2 NUMERIC, matematicas_3 NUMERIC, matematicas_4 NUMERIC, matematicas_5 NUMERIC, matematicas_p NUMERIC,
  cnaturales_1     NUMERIC, cnaturales_2 NUMERIC, cnaturales_3 NUMERIC, cnaturales_4 NUMERIC, cnaturales_5 NUMERIC, cnaturales_p NUMERIC,
  csociales_1      NUMERIC, csociales_2 NUMERIC, csociales_3 NUMERIC, csociales_4 NUMERIC, csociales_5 NUMERIC, csociales_p NUMERIC,
  formacion_1      NUMERIC, formacion_2 NUMERIC, formacion_3 NUMERIC, formacion_4 NUMERIC, formacion_5 NUMERIC, formacion_p NUMERIC,
  efisica_1        NUMERIC, efisica_2 NUMERIC, efisica_3 NUMERIC, efisica_4 NUMERIC, efisica_5 NUMERIC, efisica_p NUMERIC,
  eartes_1         NUMERIC, eartes_2 NUMERIC, eartes_3 NUMERIC, eartes_4 NUMERIC, eartes_5 NUMERIC, eartes_p NUMERIC,
  ciencias_1       NUMERIC, ciencias_2 NUMERIC, ciencias_3 NUMERIC, ciencias_4 NUMERIC, ciencias_5 NUMERIC, ciencias_p NUMERIC,
  tecnologia_1     NUMERIC, tecnologia_2 NUMERIC, tecnologia_3 NUMERIC, tecnologia_4 NUMERIC, tecnologia_5 NUMERIC, tecnologia_p NUMERIC,
  ingles_1         NUMERIC, ingles_2 NUMERIC, ingles_3 NUMERIC, ingles_4 NUMERIC, ingles_5 NUMERIC, ingles_p NUMERIC,
  aestatal_1       NUMERIC, aestatal_2 NUMERIC, aestatal_3 NUMERIC, aestatal_4 NUMERIC, aestatal_5 NUMERIC, aestatal_p NUMERIC,
  hisgeo_1         NUMERIC, hisgeo_2 NUMERIC, hisgeo_3 NUMERIC, hisgeo_4 NUMERIC, hisgeo_5 NUMERIC, hisgeo_p NUMERIC,
  promedio_general NUMERIC,
  ingest_batch_id  UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_alumno, ciclo_escolar)
);
CREATE INDEX IF NOT EXISTS idx_calificaciones_ciclo ON public.calificaciones(ciclo_escolar);

-- Evaluaciones lectoras (4 periodos: Ago, Nov, Mzo, Jun)
CREATE TABLE IF NOT EXISTS public.evaluaciones_lectoras (
  id_alumno        BIGINT NOT NULL REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE,
  ciclo_escolar    TEXT NOT NULL,
  palabras_leidas_ago   INTEGER,
  palabras_leidas_nov   INTEGER,
  palabras_leidas_mzo   INTEGER,
  palabras_leidas_jun   INTEGER,
  comprension_lectora_ago TEXT,
  comprension_lectora_nov TEXT,
  comprension_lectora_mzo TEXT,
  comprension_lectora_jun TEXT,
  fluidez_lectora_ago   NUMERIC,
  fluidez_lectora_nov   NUMERIC,
  fluidez_lectora_mzo   NUMERIC,
  fluidez_lectora_jun   NUMERIC,
  ingest_batch_id  UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_alumno, ciclo_escolar)
);
CREATE INDEX IF NOT EXISTS idx_eval_lectoras_ciclo ON public.evaluaciones_lectoras(ciclo_escolar);

-- ============================================================================
-- TRIGGERS updated_at
-- ============================================================================

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'estados','zonas','regiones','microrregiones','municipios','localidades',
    'modalidades','ccts','servicio_estadisticas',
    'bancos','sedes_formacion','figuras','figura_bajas',
    'alumnos','tutores','calificaciones','evaluaciones_lectoras'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$s;
       CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t
    );
  END LOOP;
END$$;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
COMMENT ON TABLE public.estados IS 'Estados (Master Servicios col A-B)';
COMMENT ON TABLE public.zonas IS 'Zonas (Master Servicios col C-D)';
COMMENT ON TABLE public.regiones IS 'Regiones (Master Servicios col E-F)';
COMMENT ON TABLE public.microrregiones IS 'Microrregiones (Master Servicios col G-H)';
COMMENT ON TABLE public.municipios IS 'Municipios (Master Servicios col I-J)';
COMMENT ON TABLE public.localidades IS 'Localidades con datos demográficos (Master Servicios)';
COMMENT ON TABLE public.modalidades IS 'Modalidades educativas (Inicial, Preescolar, Primaria, Secundaria, CIC)';
COMMENT ON TABLE public.ccts IS 'Centros de Trabajo — PK natural es la clave CCT alfanumérica';
COMMENT ON TABLE public.servicio_estadisticas IS 'Estadísticas por CCT y ciclo (Master Servicios col R-AV)';
COMMENT ON TABLE public.figuras IS 'Educadores comunitarios (Master Figuras)';
COMMENT ON TABLE public.figura_bajas IS 'Registro de bajas de figuras (0..1 por figura)';
COMMENT ON TABLE public.alumnos IS 'Alumnos inscritos (Master Alumnos)';
COMMENT ON TABLE public.tutores IS 'Tutores de cada alumno (1 o 2 por alumno)';
COMMENT ON TABLE public.calificaciones IS 'Calificaciones por materia y periodo';
COMMENT ON TABLE public.evaluaciones_lectoras IS 'Evaluaciones lectoras por periodo (Ago/Nov/Mzo/Jun)';


-- >>> MIGRATION 2: 20260417000001_manual_fields.sql <<<
-- ============================================================================
-- Migración: Tablas de campos manuales (no provienen de los Masters)
-- ============================================================================
-- Campos identificados en la hoja "Datos a recuperar" de Datos_a_recuperar.xlsx
-- marcados como "Cédula de Registro", "SIIINAFE", "INEGI", "Levantamiento en
-- campo" o "Manual". Se almacenan en tablas separadas para no mezclarlos con
-- los datos autoritativos provenientes de los Masters.
-- ============================================================================

-- Datos manuales por Figura (Cédula de Registro, asignación, captura manual)
CREATE TABLE IF NOT EXISTS public.figura_datos_manuales (
  numero_control        TEXT PRIMARY KEY REFERENCES public.figuras(numero_control) ON DELETE CASCADE,
  -- Asignación / seguimiento
  eca_responsable       TEXT,        -- Educador Comunitario de Acompañamiento asignado
  coordinador_seguimiento TEXT,      -- Coordinador de Seguimiento
  -- Datos personales (Cédula de Registro)
  estado_civil          TEXT,
  es_madre              BOOLEAN,
  colonia_localidad     TEXT,
  calle                 TEXT,
  no_ext                TEXT,
  no_int                TEXT,
  cp                    TEXT,
  es_de_la_comunidad    BOOLEAN,
  pernocta              BOOLEAN,
  cercano_comunidad     BOOLEAN,
  -- Académico
  nivel_academico       TEXT,
  especialidad          TEXT,
  institucion           TEXT,
  situacion_academica   TEXT,
  fecha_ingreso_cedula  DATE,
  -- Auditoría
  ciclo_escolar         TEXT,
  updated_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expediente SIIINAFE (18 campos de verificación documental)
CREATE TABLE IF NOT EXISTS public.figura_siiinafe (
  numero_control        TEXT PRIMARY KEY REFERENCES public.figuras(numero_control) ON DELETE CASCADE,
  ciclo_escolar         TEXT,
  -- 18 campos del expediente electrónico SIIINAFE.
  -- Se modelan como JSONB para admitir cambios en la lista sin alterar el esquema;
  -- el frontend define las llaves canónicas (acta_nacimiento, curp, comprobante_domicilio,
  -- identificacion_oficial, certificado_estudios, cartilla_militar, carta_no_antecedentes,
  -- fotografia, carta_compromiso, solicitud_ingreso, ...).
  documentos            JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_documentacion   INTEGER,
  observaciones         TEXT,
  updated_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Infraestructura del CCT (levantamiento en campo)
CREATE TABLE IF NOT EXISTS public.cct_infraestructura (
  cct                   TEXT NOT NULL REFERENCES public.ccts(cct) ON DELETE CASCADE,
  ciclo_escolar         TEXT NOT NULL,
  tipo_aula             TEXT,
  documento_probatorio  TEXT,
  tipo_material         TEXT,
  banos                 TEXT,
  areas_deportivas      TEXT,
  comedores             TEXT,
  cerco                 TEXT,
  energia_electrica     TEXT,
  agua                  TEXT,
  drenaje               TEXT,
  senal_telefonica      TEXT,
  internet_comunidad    TEXT,
  internet_escuela      TEXT,
  proveedor_internet    TEXT,
  apoyo_leen            TEXT,
  updated_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cct, ciclo_escolar)
);
CREATE INDEX IF NOT EXISTS idx_cct_infra_ciclo ON public.cct_infraestructura(ciclo_escolar);

-- Datos externos/manuales del CCT (INEGI, SEPOMEX, planeación, metas)
CREATE TABLE IF NOT EXISTS public.cct_datos_externos (
  cct                   TEXT NOT NULL REFERENCES public.ccts(cct) ON DELETE CASCADE,
  ciclo_escolar         TEXT NOT NULL,
  clave_inegi           TEXT,
  cp                    TEXT,
  latitud               NUMERIC,
  longitud              NUMERIC,
  porcentaje_analfabetismo NUMERIC,
  identificador_inmueble TEXT,
  ec_polivalente        BOOLEAN,
  programas_atendidos   TEXT,
  apoyo_desayunos_escolares TEXT,
  ec_meta               INTEGER,
  updated_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cct, ciclo_escolar)
);
CREATE INDEX IF NOT EXISTS idx_cct_datos_ext_ciclo ON public.cct_datos_externos(ciclo_escolar);

-- Triggers updated_at
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'figura_datos_manuales','figura_siiinafe',
    'cct_infraestructura','cct_datos_externos'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$s;
       CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t
    );
  END LOOP;
END$$;

COMMENT ON TABLE public.figura_datos_manuales IS 'Campos de Figura capturados manualmente (Cédula de Registro / asignación)';
COMMENT ON TABLE public.figura_siiinafe IS 'Expediente electrónico SIIINAFE por figura (18 documentos)';
COMMENT ON TABLE public.cct_infraestructura IS 'Infraestructura del CCT (levantamiento en campo)';
COMMENT ON TABLE public.cct_datos_externos IS 'Datos externos del CCT (INEGI, planeación, metas)';


-- >>> MIGRATION 3: 20260417000002_cea_uploads_and_status.sql <<<
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


-- >>> MIGRATION 4: 20260417000003_rls_new_tables.sql <<<
-- ============================================================================
-- Migración: RLS para tablas nuevas (relacionales, manuales, cea_uploads)
-- ============================================================================
-- Regla general:
--   - Los admins tienen acceso completo (ALL) vía public.is_admin().
--   - Los usuarios regulares pueden leer (SELECT) los catálogos y datos del
--     ciclo escolar que esté marcado como vigente — hoy solo SELECT para poder
--     construir vistas informativas. NO pueden escribir nada directamente.
--   - La escritura real la hacen las Edge Functions con service_role (bypass).
-- ============================================================================

-- Habilitar RLS
ALTER TABLE public.estados              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zonas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regiones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microrregiones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localidades          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modalidades          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicio_estadisticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bancos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sedes_formacion      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.figuras              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.figura_bajas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calificaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluaciones_lectoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.figura_datos_manuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.figura_siiinafe      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cct_infraestructura  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cct_datos_externos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cea_uploads          ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Acceso completo para admins en todas las tablas nuevas
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'estados','zonas','regiones','microrregiones','municipios','localidades',
    'modalidades','ccts','servicio_estadisticas',
    'bancos','sedes_formacion','figuras','figura_bajas',
    'alumnos','tutores','calificaciones','evaluaciones_lectoras',
    'figura_datos_manuales','figura_siiinafe',
    'cct_infraestructura','cct_datos_externos',
    'cea_uploads'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS admins_full_access ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY admins_full_access ON public.%I
         FOR ALL TO authenticated
         USING (public.is_admin())
         WITH CHECK (public.is_admin());',
      t
    );
  END LOOP;
END$$;

-- ----------------------------------------------------------------------------
-- Lectura para usuarios autenticados en catálogos geográficos y de servicio
-- (estos datos no son sensibles y se usarán para dropdowns y filtros).
-- Tablas con datos personales (figuras, alumnos, tutores, calificaciones,
-- evaluaciones lectoras, manuales) quedan restringidas solo a admin.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  catalog_tables TEXT[] := ARRAY[
    'estados','zonas','regiones','microrregiones','municipios','localidades',
    'modalidades','ccts','servicio_estadisticas',
    'bancos','sedes_formacion'
  ];
BEGIN
  FOREACH t IN ARRAY catalog_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_can_read ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY authenticated_can_read ON public.%I
         FOR SELECT TO authenticated USING (TRUE);',
      t
    );
  END LOOP;
END$$;

-- ----------------------------------------------------------------------------
-- GRANTs (las políticas siguen controlando qué filas se ven)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'estados','zonas','regiones','microrregiones','municipios','localidades',
    'modalidades','ccts','servicio_estadisticas',
    'bancos','sedes_formacion','figuras','figura_bajas',
    'alumnos','tutores','calificaciones','evaluaciones_lectoras',
    'figura_datos_manuales','figura_siiinafe',
    'cct_infraestructura','cct_datos_externos',
    'cea_uploads'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
  END LOOP;
END$$;

-- cea_uploads: la inserción inicial la hace el admin desde el frontend antes
-- de llamar a la Edge Function de procesado, así que se exige uploaded_by =
-- auth.uid() como en master_uploads.
DROP POLICY IF EXISTS cea_uploads_must_be_owned_by_uploader ON public.cea_uploads;
CREATE POLICY cea_uploads_must_be_owned_by_uploader
ON public.cea_uploads
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  AND uploaded_by = auth.uid()
);
