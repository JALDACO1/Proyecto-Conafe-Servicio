-- ============================================================================
-- Migración: columna `activo` en ccts (clausura de servicios) + `observaciones`
--            en figura_bajas, más índices de soporte.
-- ============================================================================
-- Motivo:
--   (1) Al re-ingerir el Master de Servicios puede haber CCTs que ya no aparecen
--       porque el servicio se clausuró. Se marcan con activo=false y no se
--       incluyen en el nuevo CEA, pero no se borran para preservar historial.
--   (2) La hoja "Bajas de Figuras" del CEA tiene una columna BS "Observaciones"
--       que captura el trabajador manualmente (ej. "FALTA CREDENCIAL CONAFE").
-- ============================================================================

-- (1) Clausura de servicios
ALTER TABLE public.ccts
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS fecha_clausura TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ciclo_ultima_vista TEXT;

CREATE INDEX IF NOT EXISTS idx_ccts_activo ON public.ccts(activo);

COMMENT ON COLUMN public.ccts.activo IS
  'false = el CCT no apareció en el último Master de Servicios (servicio clausurado). Se conserva el registro para historial pero se excluye del CEA.';
COMMENT ON COLUMN public.ccts.fecha_clausura IS
  'Momento en el que la ingesta detectó la ausencia del CCT por primera vez.';
COMMENT ON COLUMN public.ccts.ciclo_ultima_vista IS
  'Último ciclo_escolar en el que el CCT apareció en el Master de Servicios.';

-- (2) Observaciones manuales en figura_bajas (columna BS del CEA)
ALTER TABLE public.figura_bajas
  ADD COLUMN IF NOT EXISTS observaciones TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id);

COMMENT ON COLUMN public.figura_bajas.observaciones IS
  'Captura manual del trabajador al revisar la hoja "Bajas de Figuras" del CEA (columna BS).';
