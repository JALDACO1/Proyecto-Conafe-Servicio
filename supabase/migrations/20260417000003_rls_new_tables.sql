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
