-- ============================================================================
-- Migración: bucket `cea-templates` para alojar plantillas vacías del CEA
-- ============================================================================
-- process-cea (reescritura) descarga la plantilla `CEA 25-26 VACIO.xlsx` desde
-- aquí y la rellena con datos de la BD. Mantener el archivo en Storage permite
-- versionarlo sin tocar el código de la Edge Function.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cea-templates',
  'cea-templates',
  FALSE,  -- privado: las edge functions usan service_role
  10485760,  -- 10 MB; los VACIO suelen pesar ~150 KB
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Solo admins pueden gestionar plantillas (subir / reemplazar)
CREATE POLICY "admins_can_manage_cea_templates"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'cea-templates'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'cea-templates'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);
