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
