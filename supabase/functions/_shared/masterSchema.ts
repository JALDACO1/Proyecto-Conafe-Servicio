/**
 * masterSchema.ts
 * ================
 * Mapa declarativo de columnas de los Masters → tablas/columnas de la DB.
 * Derivado de la hoja "Esquema relacional" de Datos_a_recuperar.xlsx.
 *
 * Se usa desde la Edge Function ingest-master. Solo se persiste lo que aparece
 * aquí; el resto de columnas del Excel se ignoran silenciosamente.
 */

export type MasterType = 'servicios' | 'figuras' | 'alumnos';

/** Hoja de Excel esperada por cada Master. */
export const MASTER_SHEETS: Record<MasterType, string> = {
  servicios: 'Editado',                 // Master de Servicios
  figuras:   'Master-Figuras-Educativas',
  alumnos:   'Master',
};

/** Columnas mínimas que debe traer cada Master para poder ingestar. */
export const MASTER_REQUIRED_COLUMNS: Record<MasterType, string[]> = {
  servicios: ['cveEstado', 'cveMicroregion', 'cveLocalidad', 'cct', 'cveModalidad'],
  figuras:   ['numeroControl', 'curp', 'apellidoPaterno', 'nombre', 'Clave de Centro de Trabajo'],
  alumnos:   ['IdAlumno', 'CURP', 'Nombre', 'IdCentro'],
};

// ---------------------------------------------------------------------------
// MASTER SERVICIOS
// ---------------------------------------------------------------------------

/**
 * Mapeo del Master Servicios. Cada entrada agrupa un conjunto de columnas
 * por tabla destino. La tabla puede aparecer varias veces (no sucede aquí).
 */
export const SERVICIOS_MAP = {
  estados: {
    pk: ['cve_estado'],
    columns: {
      cve_estado: { from: 'cveEstado', type: 'int' },
      nom_estado: { from: 'nomEstado', type: 'string' },
    },
  },
  zonas: {
    pk: ['cve_zona'],
    columns: {
      cve_zona:   { from: 'cveZona',   type: 'int' },
      nom_zona:   { from: 'nomZona',   type: 'string' },
      cve_estado: { from: 'cveEstado', type: 'int' },
    },
  },
  regiones: {
    pk: ['cve_region'],
    columns: {
      cve_region: { from: 'cveRegion', type: 'int' },
      nom_region: { from: 'nomRegion', type: 'string' },
      cve_zona:   { from: 'cveZona',   type: 'int' },
    },
  },
  microrregiones: {
    pk: ['cve_microregion'],
    columns: {
      cve_microregion: { from: 'cveMicroregion', type: 'int' },
      nom_microregion: { from: 'nomMicroregion', type: 'string' },
      cve_region:      { from: 'cveRegion',      type: 'int' },
    },
  },
  municipios: {
    pk: ['cve_municipio'],
    columns: {
      cve_municipio: { from: 'cveMunicipio', type: 'int' },
      nom_municipio: { from: 'nomMunicipio', type: 'string' },
      cve_estado:    { from: 'cveEstado',    type: 'int' },
    },
  },
  localidades: {
    pk: ['cve_localidad'],
    columns: {
      cve_localidad:     { from: 'cveLocalidad',     type: 'int' },
      nom_localidad:     { from: 'nomLocalidad',     type: 'string' },
      cve_municipio:     { from: 'cveMunicipio',     type: 'int' },
      grado_marginacion: { from: 'GradoMarginacion', type: 'string' },
      grado_rezago:      { from: 'GradoRezago',      type: 'string' },
      pobtot:            { from: 'POBTOT',           type: 'int' },
    },
  },
  modalidades: {
    pk: ['cve_modalidad'],
    columns: {
      cve_modalidad: { from: 'cveModalidad', type: 'int' },
      nom_modalidad: { from: 'nomModalidad', type: 'string' },
      nom_programa:  { from: 'nomPrograma',  type: 'string' },
    },
  },
  ccts: {
    pk: ['cct'],
    columns: {
      cct:             { from: 'cct',            type: 'string' },
      nombre_cct:      { from: 'NombreCCT',      type: 'string' },
      cve_localidad:   { from: 'cveLocalidad',   type: 'int' },
      cve_microregion: { from: 'cveMicroregion', type: 'int' },
      cve_modalidad:   { from: 'cveModalidad',   type: 'int' },
      status_or:       { from: 'statusOr',       type: 'string' },
      instalado:       { from: 'Instalado',      type: 'string' },
      status_sucecom:  { from: 'StatusSUCECOM',  type: 'string' },
    },
  },
  servicio_estadisticas: {
    pk: ['cct', 'ciclo_escolar'],
    columns: {
      cct:                   { from: 'cct',                 type: 'string' },
      // ciclo_escolar lo inyecta la función desde el request
      instructores_h:        { from: 'instructoresH',       type: 'int' },
      instructores_m:        { from: 'instructoresM',       type: 'int' },
      no_instructores_total: { from: 'noInstructoresTotal', type: 'int' },
      n1_h_ciclo:            { from: 'N1_H_CICLO',          type: 'int' },
      n2_h_ciclo:            { from: 'N2_H_CICLO',          type: 'int' },
      n3_h_ciclo:            { from: 'N3_H_CICLO',          type: 'int' },
      n1_m_ciclo:            { from: 'N1_M_CICLO',          type: 'int' },
      n2_m_ciclo:            { from: 'N2_M_CICLO',          type: 'int' },
      n3_m_ciclo:            { from: 'N3_M_CICLO',          type: 'int' },
      alum_h:                { from: 'ALUM_H',              type: 'int' },
      alum_m:                { from: 'ALUM_M',              type: 'int' },
      tot_alum:              { from: 'TOT_ALUM',            type: 'int' },
      ninos:                 { from: 'Niños',               type: 'int' },
      ninas:                 { from: 'Niñas',               type: 'int' },
      madres:                { from: 'Madres',              type: 'int' },
      padres:                { from: 'Padres',              type: 'int' },
      embarazadas:           { from: 'Embarazadas',         type: 'int' },
      cuidadores:            { from: 'Cuidadores',          type: 'int' },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// MASTER FIGURAS
// ---------------------------------------------------------------------------

export const FIGURAS_MAP = {
  // La jerarquía geográfica también se refuerza con Figuras (estados/zonas/regiones/microrregiones
  // aparecen en el Master Figuras en otras columnas) — solo los catálogos base.
  bancos: {
    pk: ['cve_banco'],
    columns: {
      cve_banco: { from: 'cveBanco', type: 'int' },
      nom_banco: { from: 'nomBanco', type: 'string' },
    },
  },
  sedes_formacion: {
    pk: ['cv_sede'],
    columns: {
      cv_sede:              { from: 'cvSede',             type: 'int' },
      nombre_sede:          { from: 'nombre de la sede',  type: 'string' },
      cve_zona_formacion:   { from: 'cveZonaFormacion',   type: 'int' },
      zona_formacion:       { from: 'Zona de Formacion',  type: 'string' },
      cve_region_formacion: { from: 'cveRegionFormacion', type: 'int' },
      region_formacion:     { from: 'Region de Formacion', type: 'string' },
    },
  },
  figuras: {
    pk: ['numero_control'],
    columns: {
      numero_control:        { from: 'numeroControl',               type: 'string' },
      curp:                  { from: 'curp',                        type: 'string' },
      apellido_paterno:      { from: 'apellidoPaterno',             type: 'string' },
      apellido_materno:      { from: 'apellidoMaterno',             type: 'string' },
      nombre:                { from: 'nombre',                      type: 'string' },
      edad:                  { from: 'edad',                        type: 'int' },
      genero:                { from: 'genero',                      type: 'string' },
      fecha_nacimiento:      { from: 'fechaNacimiento',             type: 'date' },
      telefono:              { from: 'telefono',                    type: 'string' },
      correo:                { from: 'correo',                      type: 'string' },
      id_figura:             { from: 'idFigura',                    type: 'string' },
      figura:                { from: 'Figura',                      type: 'string' },
      generacion:            { from: 'generacion',                  type: 'int' },
      fecha_ingreso:         { from: 'fechaIngreso',                type: 'date' },
      anios_servicio_conafe: { from: 'años de servicio en CONAFE',  type: 'int' },
      situacion_actual:      { from: 'situacionActual',             type: 'string' },
      descripcion_situacion: { from: 'Descripcion_Situacion_Actual', type: 'string' },
      cct:                   { from: 'Clave de Centro de Trabajo',  type: 'string' },
      cve_banco:             { from: 'cveBanco',                    type: 'int' },
      numero_cuenta:         { from: 'numeroCuenta',                type: 'string' },
      clabe:                 { from: 'clabe',                       type: 'string' },
      cve_estado_res:        { from: 'cveEstado',                   type: 'int' },
      estado_residencia:     { from: 'Estado de Residencia',        type: 'string' },
      cve_municipio_res:     { from: 'cveMunicipio',                type: 'int' },
      municipio_residencia:  { from: 'Municipio de Residencia',     type: 'string' },
      cve_localidad_res:     { from: 'cveLocalidad',                type: 'int' },
      localidad_residencia:  { from: 'Localidad de Residencia',     type: 'string' },
      cve_estado_ss:         { from: 'cveEstado_Servicio_Social',   type: 'int' },
      estado_servicio_social:    { from: 'Estado Servicio Social',       type: 'string' },
      cve_municipio_ss:      { from: 'cveMunicipio_Servicio_Social', type: 'int' },
      municipio_servicio_social: { from: 'Municipio Servicio Social',   type: 'string' },
      cve_localidad_ss:      { from: 'cveLocalidad_Servicio_Social', type: 'int' },
      localidad_servicio_social: { from: 'Localidad Servicio Social',   type: 'string' },
      talla_playera:         { from: 'tallaPlayera',    type: 'string' },
      talla_pants:           { from: 'tallaPants',      type: 'string' },
      numero_calzado:        { from: 'numeroCalzado',   type: 'string' },
      fecha_inicio_servicio: { from: 'Fecha Inicio del Servicio', type: 'date' },
      cv_sede:               { from: 'cvSede',          type: 'int' },
      // ciclo_escolar se inyecta desde el request
    },
  },
  figura_bajas: {
    pk: ['numero_control'],
    // Solo se inserta si al menos uno de los campos de baja tiene valor.
    onlyWhenAny: ['fecha_Baja', 'Causa_Desercion', 'Causa_Baja'],
    columns: {
      numero_control:  { from: 'numeroControl',   type: 'string' },
      fecha_baja:      { from: 'fecha_Baja',      type: 'date' },
      causa_desercion: { from: 'Causa_Desercion', type: 'string' },
      causa_baja:      { from: 'Causa_Baja',      type: 'string' },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// MASTER ALUMNOS
// ---------------------------------------------------------------------------

export const ALUMNOS_MAP = {
  alumnos: {
    pk: ['id_alumno'],
    columns: {
      id_alumno:                 { from: 'IdAlumno',              type: 'int' },
      id_control:                { from: 'IdControl',             type: 'int' },
      curp:                      { from: 'CURP',                  type: 'string' },
      apellido_paterno:          { from: 'ApellidoPaterno',       type: 'string' },
      apellido_materno:          { from: 'ApellidoMaterno',       type: 'string' },
      nombre:                    { from: 'Nombre',                type: 'string' },
      genero:                    { from: 'Genero',                type: 'string' },
      fecha_nacimiento:          { from: 'FechaNacimiento',       type: 'date' },
      edad_anios_inicio_ciclo:   { from: 'EdadAniosInicioCiclo',  type: 'int' },
      edad_meses_inicio_ciclo:   { from: 'EdadMesesInicioCiclo',  type: 'int' },
      nivel:                     { from: 'Nivel',                 type: 'string' },
      id_programa:               { from: 'IdPrograma',            type: 'int' },
      programa:                  { from: 'Programa',              type: 'string' },
      situacion_alumno:          { from: 'SituacionAlumno',       type: 'string' },
      estatus_alumno:            { from: 'EstatusAlumno',         type: 'string' },
      cct:                       { from: 'IdCentro',              type: 'string' },
      fecha_inscripcion:         { from: 'FechaInscripcion',      type: 'date' },
      talla_playera:             { from: 'TallaPlayera',          type: 'string' },
      talla_pantalon:            { from: 'TallaPantalon',         type: 'string' },
      calzado:                   { from: 'Calzado',               type: 'string' },
      baja:                      { from: 'Baja',                  type: 'string' },
      id_baja:                   { from: 'IdBaja',                type: 'int' },
      causa_baja:                { from: 'CausaBaja',             type: 'string' },
      motivo_baja:               { from: 'MotivoBaja',            type: 'string' },
      fecha_baja:                { from: 'FechaBaja',             type: 'date' },
    },
  },

  /**
   * Tutores: hasta 2 por alumno. La función se encarga de emitir 1 o 2 filas
   * a partir de las columnas Tutor1* y Tutor2*.
   */
  tutores: {
    pk: ['id_alumno', 'num_tutor'],
    fanOut: {
      idField: 'IdAlumno',
      tutors: [
        {
          num: 1,
          columns: {
            curp:             'Tutor1Curp',
            parentezco:       'Tutor1Parentezco',
            genero:           'Tutor1Genero',
            nombre:           'Tutor1Nombre',
            primer_apellido:  'Tutor1PrimerApellido',
            segundo_apellido: 'Turor1SegundoApellido', // ← typo presente en el Master
            vive:             'Tutor1Vive',
            escolaridad:      'Tutor1Escolaridad',
            lengua:           'Tutor1Lengua',
          },
        },
        {
          num: 2,
          columns: {
            curp:             'Tutor2Curp',
            parentezco:       'Tutor2Parentezco',
            genero:           'Tutor2Genero',
            nombre:           'Tutor2Nombre',
            primer_apellido:  'Tutor2PrimerApellido',
            segundo_apellido: 'Turor2SegundoApellido', // ← typo presente en el Master
            vive:             'Tutor2Vive',
            escolaridad:      'Tutor2Escolaridad',
            lengua:           'Tutor2Lengua',
          },
        },
      ],
    },
  },

  calificaciones: {
    pk: ['id_alumno', 'ciclo_escolar'],
    columns: {
      id_alumno:       { from: 'IdAlumno',         type: 'int' },
      espanol_1: { from: 'Español1', type: 'number' }, espanol_2: { from: 'Español2', type: 'number' },
      espanol_3: { from: 'Español3', type: 'number' }, espanol_4: { from: 'Español4', type: 'number' },
      espanol_5: { from: 'Español5', type: 'number' }, espanol_p: { from: 'EspañolP', type: 'number' },
      matematicas_1: { from: 'Matematicas1', type: 'number' }, matematicas_2: { from: 'Matematicas2', type: 'number' },
      matematicas_3: { from: 'Matematicas3', type: 'number' }, matematicas_4: { from: 'Matematicas4', type: 'number' },
      matematicas_5: { from: 'Matematicas5', type: 'number' }, matematicas_p: { from: 'MatematicasP', type: 'number' },
      cnaturales_1: { from: 'CNaturales1', type: 'number' }, cnaturales_2: { from: 'CNaturales2', type: 'number' },
      cnaturales_3: { from: 'CNaturales3', type: 'number' }, cnaturales_4: { from: 'CNaturales4', type: 'number' },
      cnaturales_5: { from: 'CNaturales5', type: 'number' }, cnaturales_p: { from: 'CNaturalesP', type: 'number' },
      csociales_1: { from: 'CSociales1', type: 'number' }, csociales_2: { from: 'CSociales2', type: 'number' },
      csociales_3: { from: 'CSociales3', type: 'number' }, csociales_4: { from: 'CSociales4', type: 'number' },
      csociales_5: { from: 'CSociales5', type: 'number' }, csociales_p: { from: 'CSocialesP', type: 'number' },
      formacion_1: { from: 'Formacion1', type: 'number' }, formacion_2: { from: 'Formacion2', type: 'number' },
      formacion_3: { from: 'Formacion3', type: 'number' }, formacion_4: { from: 'Formacion4', type: 'number' },
      formacion_5: { from: 'Formacion5', type: 'number' }, formacion_p: { from: 'FormacionP', type: 'number' },
      efisica_1: { from: 'EFisica1', type: 'number' }, efisica_2: { from: 'EFisica2', type: 'number' },
      efisica_3: { from: 'EFisica3', type: 'number' }, efisica_4: { from: 'EFisica4', type: 'number' },
      efisica_5: { from: 'EFisica5', type: 'number' }, efisica_p: { from: 'EFisicaP', type: 'number' },
      eartes_1: { from: 'EArtes1', type: 'number' }, eartes_2: { from: 'EArtes2', type: 'number' },
      eartes_3: { from: 'EArtes3', type: 'number' }, eartes_4: { from: 'EArtes4', type: 'number' },
      eartes_5: { from: 'EArtes5', type: 'number' }, eartes_p: { from: 'EArtesP', type: 'number' },
      ciencias_1: { from: 'Ciencias1', type: 'number' }, ciencias_2: { from: 'Ciencias2', type: 'number' },
      ciencias_3: { from: 'Ciencias3', type: 'number' }, ciencias_4: { from: 'Ciencias4', type: 'number' },
      ciencias_5: { from: 'Ciencias5', type: 'number' }, ciencias_p: { from: 'CienciasP', type: 'number' },
      tecnologia_1: { from: 'Tecnologia1', type: 'number' }, tecnologia_2: { from: 'Tecnologia2', type: 'number' },
      tecnologia_3: { from: 'Tecnologia3', type: 'number' }, tecnologia_4: { from: 'Tecnologia4', type: 'number' },
      tecnologia_5: { from: 'Tecnologia5', type: 'number' }, tecnologia_p: { from: 'TecnologiaP', type: 'number' },
      ingles_1: { from: 'Ingles1', type: 'number' }, ingles_2: { from: 'Ingles2', type: 'number' },
      ingles_3: { from: 'Ingles3', type: 'number' }, ingles_4: { from: 'Ingles4', type: 'number' },
      ingles_5: { from: 'Ingles5', type: 'number' }, ingles_p: { from: 'InglesP', type: 'number' },
      aestatal_1: { from: 'AEstatal1', type: 'number' }, aestatal_2: { from: 'AEstatal2', type: 'number' },
      aestatal_3: { from: 'AEstatal3', type: 'number' }, aestatal_4: { from: 'AEstatal4', type: 'number' },
      aestatal_5: { from: 'AEstatal5', type: 'number' }, aestatal_p: { from: 'AEstatalP', type: 'number' },
      hisgeo_1: { from: 'HisGeo1', type: 'number' }, hisgeo_2: { from: 'HisGeo2', type: 'number' },
      hisgeo_3: { from: 'HisGeo3', type: 'number' }, hisgeo_4: { from: 'HisGeo4', type: 'number' },
      hisgeo_5: { from: 'HisGeo5', type: 'number' }, hisgeo_p: { from: 'HisGeoP', type: 'number' },
      promedio_general: { from: 'PromedioGeneral', type: 'number' },
    },
  },

  evaluaciones_lectoras: {
    pk: ['id_alumno', 'ciclo_escolar'],
    columns: {
      id_alumno:                { from: 'IdAlumno',              type: 'int' },
      palabras_leidas_ago:      { from: 'PalabrasLeidasAgo',     type: 'int' },
      palabras_leidas_nov:      { from: 'PalabrasLeidasNov',     type: 'int' },
      palabras_leidas_mzo:      { from: 'PalabrasLeidasMzo',     type: 'int' },
      palabras_leidas_jun:      { from: 'PalabrasLeidasJun',     type: 'int' },
      comprension_lectora_ago:  { from: 'ComprensionLectoraAgo', type: 'string' },
      comprension_lectora_nov:  { from: 'ComprensionLectoraNov', type: 'string' },
      comprension_lectora_mzo:  { from: 'ComprensionLectoraMzo', type: 'string' },
      comprension_lectora_jun:  { from: 'ComprensionLectoraJun', type: 'string' },
      fluidez_lectora_ago:      { from: 'FluidezLectoraAgo',     type: 'number' },
      fluidez_lectora_nov:      { from: 'FluidezLectoraNov',     type: 'number' },
      fluidez_lectora_mzo:      { from: 'FluidezLectoraMzo',     type: 'number' },
      fluidez_lectora_jun:      { from: 'FluidezLectoraJun',     type: 'number' },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Coerción de valores de celda Excel → tipo de DB
// ---------------------------------------------------------------------------

export type DbFieldType = 'int' | 'number' | 'string' | 'date' | 'boolean';

/** Convierte un valor crudo de celda Excel al tipo destino. Devuelve null si vacío. */
export function coerce(value: unknown, type: DbFieldType): unknown {
  if (value === null || value === undefined || value === '') return null;

  switch (type) {
    case 'int': {
      const n = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    case 'number': {
      const n = typeof value === 'number' ? value : parseFloat(String(value).trim().replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }
    case 'string':
      return String(value).trim() || null;
    case 'boolean': {
      const s = String(value).trim().toLowerCase();
      if (['s', 'si', 'sí', 'true', '1', 'verdadero'].includes(s)) return true;
      if (['n', 'no', 'false', '0', 'falso'].includes(s)) return false;
      return null;
    }
    case 'date': {
      // xlsx cellDates:true ya entrega Date. Si viene number (serial Excel)
      // lo convertimos; si viene string ISO/dd-mm-yyyy, intentamos parsear.
      if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
      if (typeof value === 'number') {
        // serial Excel: días desde 1899-12-30
        const d = new Date(Math.round((value - 25569) * 86400 * 1000));
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      }
      const s = String(value).trim();
      if (!s) return null;
      // ISO yyyy-mm-dd
      const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
      // dd/mm/yyyy o dd-mm-yyyy
      const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/.exec(s);
      if (dmy) {
        let [, d, m, y] = dmy;
        if (y.length === 2) y = `20${y}`;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: aplicar un mapping de tabla a una fila del Excel
// ---------------------------------------------------------------------------

export interface ColumnSpec {
  from: string;
  type: DbFieldType;
}

export interface TableMap {
  pk: readonly string[];
  columns: Record<string, ColumnSpec>;
  onlyWhenAny?: readonly string[];
}

/**
 * Aplica un TableMap a una fila y devuelve el objeto listo para upsert.
 * Retorna null si la fila no tiene ningún valor significativo en las PK.
 */
export function mapRow(
  row: Record<string, unknown>,
  table: TableMap,
  extras: Record<string, unknown> = {},
): Record<string, unknown> | null {
  // Si hay condición "onlyWhenAny" y ninguna columna tiene valor, saltar.
  if (table.onlyWhenAny && !table.onlyWhenAny.some((c) => row[c] !== undefined && row[c] !== null && row[c] !== '')) {
    return null;
  }

  const out: Record<string, unknown> = {};
  for (const [dbCol, spec] of Object.entries(table.columns)) {
    out[dbCol] = coerce(row[spec.from], spec.type);
  }

  // Verificar que las PK tengan valor
  for (const k of table.pk) {
    if (out[k] === null || out[k] === undefined) {
      // la PK puede venir en extras (ej. ciclo_escolar)
      if (extras[k] === undefined || extras[k] === null) return null;
    }
  }

  return { ...out, ...extras };
}
