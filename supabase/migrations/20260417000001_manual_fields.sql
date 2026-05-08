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
