/**
 * fillTemplate.ts
 * ================
 * Llena la plantilla `CEA 25-26 VACIO.xlsx` con datos provenientes de la BD.
 *
 * Estrategia: cargamos el VACIO con ExcelJS (preserva merges/colores/anchos),
 * limpiamos los rangos de DATOS de cada hoja y los escribimos fila por fila.
 * Las fórmulas posicionales del VACIO no se reusan: aquí calculamos los
 * agregados en código y los persistimos como valores numéricos. El usuario que
 * abra el archivo verá totales correctos sin depender de que las filas estén
 * en posiciones fijas.
 *
 * El layout objetivo (extraído de scripts/cea-blueprint/) es:
 *   - CONCENTRADO  : 3 bloques (Figuras R8-R33, Servicios R39-R64, Alumnos R71-R96)
 *                    + totales R34/R65/R97. 26 microrregiones, índice 1..26.
 *   - Estadística de Servicios : 1 fila por CCT activo desde R6.
 *   - Estadística Figuras y Atención : 1 fila por figura activa desde R6.
 *   - Bajas de Figuras : 1 fila por baja desde R5.
 */

import ExcelJS from 'https://esm.sh/exceljs@4.4.0';
import type {
  CctRow,
  FiguraRow,
  FiguraBajaRow,
  AlumnosAggCct,
} from './queryDb.ts';

export interface FillInput {
  templateBuffer: ArrayBuffer;
  ciclo: string;
  ccts: CctRow[];                 // ordenados por microrregión
  figurasActivas: FiguraRow[];
  figurasBajas: FiguraBajaRow[];
  alumnosAggByCct: Map<string, AlumnosAggCct>;
}

export async function fillCeaTemplate(input: FillInput): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(input.templateBuffer);

  fillEstadisticaServicios(wb, input);
  fillEstadisticaFiguras(wb, input);
  fillBajasDeFiguras(wb, input);
  fillConcentrado(wb, input);

  const out = await wb.xlsx.writeBuffer();
  return new Uint8Array(out);
}

/**
 * Busca una hoja tolerando variaciones (espacios extra, acentos, mayúsculas).
 * La plantilla VACIO trae nombres como `"Estadística Figuras y Atención "`
 * con espacio al final, lo que rompía un getWorksheet exacto.
 */
function findSheet(wb: ExcelJS.Workbook, ...candidates: string[]): ExcelJS.Worksheet {
  const norm = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const wanted = candidates.map(norm);
  for (const ws of wb.worksheets) {
    if (wanted.includes(norm(ws.name))) return ws;
  }
  throw new Error(
    `Hoja no encontrada (buscando: ${candidates.join(' | ')}). Hojas disponibles: ${wb.worksheets.map((w) => `"${w.name}"`).join(', ')}`,
  );
}

// ===========================================================================
// Hoja 2: Estadística de Servicios — 1 fila por CCT activo desde fila 6
// ===========================================================================
//
// Columnas (mapping resumido del README):
//   B  Región CONAFE        (cct.region_nombre)
//   C  Microrregión         (cct.microrregion_nombre)
//   D  ECA Responsable      (manual; resolveremos con figura idFigura=ECA en mejora futura)
//   E  Coord Seguimiento    (idem ECR)
//   F  Clave INEGI          (cct.ext.clave_inegi)
//   G  CP                   (cct.ext.cp)
//   H  Identificador inmueble
//   I  Latitud / J Longitud
//   K  % Analfabetismo
//   L  Grado Marginación
//   M  POBTOT
//   N  Municipio / O Localidad
//   P  Comunidad
//   Q  Cantidad servicios   (conteo CCTs por localidad)
//   R  EC Polivalente
//   S  Programas Polivalente
//   T-W Marca de modalidad (Inicial/Pree/Prim/Sec) — derivado de modalidad
//   X  Apoyo desayunos
//   Y  EC Meta              Z M instructores  AA F instructores  AB EC asignados  AC Faltantes
//   AD..BG  Inicial+Preescolar (varía con datos del CCT y agregados)
//   BH..CB  Primaria
//   CC..CN  Secundaria
//   CO..CX  Totales / Comunidad
//   CY..DM  Infraestructura (manual)

function fillEstadisticaServicios(wb: ExcelJS.Workbook, input: FillInput) {
  const ws = findSheet(wb, 'Estadística de Servicios', 'Estadistica de Servicios');

  const FIRST_ROW = 6;

  // Limpiar filas viejas si la plantilla traía datos de ejemplo
  for (let r = FIRST_ROW; r <= ws.rowCount; r++) {
    ws.getRow(r).values = [];
  }

  // Conteo por localidad (cantidad de servicios, columna Q)
  const cctsPorLocalidad = new Map<number, number>();
  for (const c of input.ccts) {
    if (c.cve_localidad == null) continue;
    cctsPorLocalidad.set(c.cve_localidad, (cctsPorLocalidad.get(c.cve_localidad) ?? 0) + 1);
  }

  let row = FIRST_ROW;
  for (const c of input.ccts) {
    const r = ws.getRow(row);
    const m = (c.modalidad_nombre ?? '').toUpperCase();
    const isInicial    = m.includes('INICIAL');
    const isPreescolar = m.includes('PREESCOLAR');
    const isPrimaria   = m.includes('PRIMARIA');
    const isSecundaria = m.includes('SECUNDARIA');

    const agg = input.alumnosAggByCct.get(c.cct);

    r.getCell('A').value = c.cct;
    r.getCell('B').value = c.region_nombre;
    r.getCell('C').value = c.microrregion_nombre;
    // D ECA, E ECR — los resolvemos en el futuro con join a figuras por id_figura
    r.getCell('F').value = c.ext?.clave_inegi ?? null;
    r.getCell('G').value = c.ext?.cp ?? null;
    r.getCell('H').value = c.ext?.identificador_inmueble ?? null;
    r.getCell('I').value = c.ext?.latitud ?? null;
    r.getCell('J').value = c.ext?.longitud ?? null;
    r.getCell('K').value = c.ext?.porcentaje_analfabetismo ?? null;
    r.getCell('L').value = c.grado_marginacion;
    r.getCell('M').value = c.pobtot;
    r.getCell('N').value = c.municipio_nombre;
    r.getCell('O').value = c.localidad_nombre;
    r.getCell('P').value = c.localidad_nombre; // P=COMUNIDAD: por ahora replica localidad
    r.getCell('Q').value = c.cve_localidad ? cctsPorLocalidad.get(c.cve_localidad) ?? 1 : 1;
    r.getCell('R').value = c.ext?.ec_polivalente ?? null;
    r.getCell('S').value = c.ext?.programas_atendidos ?? null;
    r.getCell('T').value = isInicial    ? 1 : null;
    r.getCell('U').value = isPreescolar ? 1 : null;
    r.getCell('V').value = isPrimaria   ? 1 : null;
    r.getCell('W').value = isSecundaria ? 1 : null;
    r.getCell('X').value = c.ext?.apoyo_desayunos_escolares ?? null;
    r.getCell('Y').value = c.ext?.ec_meta ?? null;
    r.getCell('Z').value = c.estad?.instructores_h ?? 0;
    r.getCell('AA').value = c.estad?.instructores_m ?? 0;
    r.getCell('AB').value = c.estad?.no_instructores_total ?? 0;
    r.getCell('AC').value = (c.ext?.ec_meta ?? 0) - (c.estad?.no_instructores_total ?? 0);

    // Inicial (AD..AU) — niños/niñas por rango edad + embarazadas/cuidadores/padres/madres
    if (agg) {
      r.getCell('AD').value = agg.inicial_ninos_0_2;
      r.getCell('AE').value = agg.inicial_ninas_0_2;
      r.getCell('AF').value = agg.inicial_ninos_2_3;
      r.getCell('AG').value = agg.inicial_ninas_2_3;
      r.getCell('AH').value = agg.inicial_ninos_3_4;
      r.getCell('AI').value = agg.inicial_ninas_3_4;
      const totIniH = agg.inicial_ninos_0_2 + agg.inicial_ninos_2_3 + agg.inicial_ninos_3_4;
      const totIniM = agg.inicial_ninas_0_2 + agg.inicial_ninas_2_3 + agg.inicial_ninas_3_4;
      r.getCell('AJ').value = totIniH;
      r.getCell('AK').value = totIniM;
      r.getCell('AL').value = totIniH + totIniM;
      r.getCell('AM').value = c.estad?.embarazadas ?? 0;
      r.getCell('AN').value = c.estad?.cuidadores ?? 0;
      r.getCell('AS').value = c.estad?.padres ?? 0;
      r.getCell('AT').value = c.estad?.madres ?? 0;
      r.getCell('AU').value = (c.estad?.padres ?? 0) + (c.estad?.madres ?? 0);
    }

    // Preescolar (AV..BG): 1°/2°/3° H/M/T + TH/TM/TG
    if (agg) {
      const pre = [
        ['AV', agg.pre_1_h], ['AW', agg.pre_1_m], ['AX', agg.pre_1_h + agg.pre_1_m],
        ['AY', agg.pre_2_h], ['AZ', agg.pre_2_m], ['BA', agg.pre_2_h + agg.pre_2_m],
        ['BB', agg.pre_3_h], ['BC', agg.pre_3_m], ['BD', agg.pre_3_h + agg.pre_3_m],
      ] as const;
      for (const [col, v] of pre) r.getCell(col).value = v;
      const preTH = agg.pre_1_h + agg.pre_2_h + agg.pre_3_h;
      const preTM = agg.pre_1_m + agg.pre_2_m + agg.pre_3_m;
      r.getCell('BE').value = preTH;
      r.getCell('BF').value = preTM;
      r.getCell('BG').value = preTH + preTM;
    }

    // Primaria (BH..CB): 6 grados H/M/T + TH/TM/TG
    if (agg) {
      const grados = [
        ['BH', agg.pri_1_h], ['BI', agg.pri_1_m], ['BJ', agg.pri_1_h + agg.pri_1_m],
        ['BK', agg.pri_2_h], ['BL', agg.pri_2_m], ['BM', agg.pri_2_h + agg.pri_2_m],
        ['BN', agg.pri_3_h], ['BO', agg.pri_3_m], ['BP', agg.pri_3_h + agg.pri_3_m],
        ['BQ', agg.pri_4_h], ['BR', agg.pri_4_m], ['BS', agg.pri_4_h + agg.pri_4_m],
        ['BT', agg.pri_5_h], ['BU', agg.pri_5_m], ['BV', agg.pri_5_h + agg.pri_5_m],
        ['BW', agg.pri_6_h], ['BX', agg.pri_6_m], ['BY', agg.pri_6_h + agg.pri_6_m],
      ] as const;
      for (const [col, v] of grados) r.getCell(col).value = v;
      const priTH = agg.pri_1_h + agg.pri_2_h + agg.pri_3_h + agg.pri_4_h + agg.pri_5_h + agg.pri_6_h;
      const priTM = agg.pri_1_m + agg.pri_2_m + agg.pri_3_m + agg.pri_4_m + agg.pri_5_m + agg.pri_6_m;
      r.getCell('BZ').value = priTH;
      r.getCell('CA').value = priTM;
      r.getCell('CB').value = priTH + priTM;
    }

    // Secundaria (CC..CN): 1°/2°/3° H/M/T + TH/TM/TG
    if (agg) {
      const sec = [
        ['CC', agg.sec_1_h], ['CD', agg.sec_1_m], ['CE', agg.sec_1_h + agg.sec_1_m],
        ['CF', agg.sec_2_h], ['CG', agg.sec_2_m], ['CH', agg.sec_2_h + agg.sec_2_m],
        ['CI', agg.sec_3_h], ['CJ', agg.sec_3_m], ['CK', agg.sec_3_h + agg.sec_3_m],
      ] as const;
      for (const [col, v] of sec) r.getCell(col).value = v;
      const secTH = agg.sec_1_h + agg.sec_2_h + agg.sec_3_h;
      const secTM = agg.sec_1_m + agg.sec_2_m + agg.sec_3_m;
      r.getCell('CL').value = secTH;
      r.getCell('CM').value = secTM;
      r.getCell('CN').value = secTH + secTM;
    }

    // Infraestructura manual (CY..DM)
    if (c.infra) {
      r.getCell('CY').value = c.infra.tipo_aula;
      r.getCell('CZ').value = c.infra.documento_probatorio;
      r.getCell('DA').value = c.infra.tipo_material;
      r.getCell('DB').value = c.infra.banos;
      r.getCell('DC').value = c.infra.areas_deportivas;
      r.getCell('DD').value = c.infra.comedores;
      r.getCell('DE').value = c.infra.cerco;
      r.getCell('DF').value = c.infra.energia_electrica;
      r.getCell('DG').value = c.infra.agua;
      r.getCell('DH').value = c.infra.drenaje;
      r.getCell('DI').value = c.infra.senal_telefonica;
      r.getCell('DJ').value = c.infra.internet_comunidad;
      r.getCell('DK').value = c.infra.internet_escuela;
      r.getCell('DL').value = c.infra.proveedor_internet;
      r.getCell('DM').value = c.infra.apoyo_leen;
    }

    r.commit();
    row++;
  }
}

// ===========================================================================
// Hoja 3: Estadística Figuras y Atención — 1 fila por figura activa desde R6
// ===========================================================================

function fillEstadisticaFiguras(wb: ExcelJS.Workbook, input: FillInput) {
  const ws = findSheet(wb, 'Estadística Figuras y Atención', 'Estadistica Figuras y Atencion');

  const FIRST_ROW = 6;
  for (let r = FIRST_ROW; r <= ws.rowCount; r++) ws.getRow(r).values = [];

  let row = FIRST_ROW;
  let consec = 1;
  for (const f of input.figurasActivas) {
    const r = ws.getRow(row);
    r.getCell('B').value = consec++;
    r.getCell('C').value = f.microrregion_nombre;
    // D Sede, E Microrregión repetida — la plantilla repite ubicación; manejamos lo básico
    r.getCell('I').value = f.cct;
    r.getCell('J').value = f.modalidad_nombre;
    r.getCell('L').value = f.numero_control;
    r.getCell('M').value = f.curp;
    r.getCell('N').value = f.apellido_paterno;
    r.getCell('O').value = f.apellido_materno;
    r.getCell('P').value = f.nombre;
    r.getCell('Q').value = f.genero;
    r.getCell('R').value = f.fecha_nacimiento;
    r.getCell('S').value = f.edad;
    r.getCell('T').value = f.telefono;
    r.getCell('U').value = f.correo;
    r.getCell('V').value = f.figura;
    r.getCell('W').value = f.id_figura;
    r.getCell('X').value = f.fecha_ingreso;
    r.getCell('Y').value = f.anios_servicio_conafe;
    r.getCell('Z').value = f.situacion_actual;
    if (f.manuales) {
      r.getCell('AA').value = f.manuales.estado_civil;
      r.getCell('AB').value = f.manuales.es_madre;
      r.getCell('AC').value = f.manuales.colonia_localidad;
      r.getCell('AD').value = f.manuales.calle;
      r.getCell('AE').value = f.manuales.no_ext;
      r.getCell('AF').value = f.manuales.no_int;
      r.getCell('AG').value = f.manuales.cp;
      r.getCell('AH').value = f.manuales.es_de_la_comunidad;
      r.getCell('AI').value = f.manuales.pernocta;
      r.getCell('AJ').value = f.manuales.cercano_comunidad;
      r.getCell('AK').value = f.manuales.nivel_academico;
      r.getCell('AL').value = f.manuales.especialidad;
      r.getCell('AM').value = f.manuales.institucion;
      r.getCell('AN').value = f.manuales.situacion_academica;
    }
    // SIIINAFE flags (AV..BN) y total BO
    if (f.siiinafe) {
      const docs = f.siiinafe.documentos ?? {};
      const cols = ['AV','AW','AX','AY','AZ','BA','BB','BC','BD','BE','BF','BG','BH','BI','BJ','BK','BL','BM','BN'];
      const keys = Object.keys(docs);
      for (let i = 0; i < cols.length && i < keys.length; i++) {
        r.getCell(cols[i]).value = (docs as any)[keys[i]] ? 1 : 0;
      }
      r.getCell('BO').value = f.siiinafe.total_documentacion;
      r.getCell('BP').value = f.siiinafe.observaciones;
    }
    r.commit();
    row++;
  }
}

// ===========================================================================
// Hoja 4: Bajas de Figuras — 1 fila por baja desde R5
// ===========================================================================

function fillBajasDeFiguras(wb: ExcelJS.Workbook, input: FillInput) {
  const ws = findSheet(wb, 'Bajas de Figuras');

  const FIRST_ROW = 5;
  for (let r = FIRST_ROW; r <= ws.rowCount; r++) ws.getRow(r).values = [];

  let row = FIRST_ROW;
  let consec = 1;
  for (const f of input.figurasBajas) {
    const r = ws.getRow(row);
    r.getCell('B').value = consec++;
    r.getCell('C').value = f.fecha_baja;
    r.getCell('D').value = f.causa_baja ?? f.causa_desercion;
    r.getCell('E').value = f.microrregion_nombre;
    r.getCell('K').value = f.cct;
    r.getCell('L').value = f.modalidad_nombre;
    r.getCell('M').value = f.figura;
    r.getCell('N').value = f.numero_control;
    r.getCell('O').value = f.curp;
    r.getCell('P').value = f.apellido_paterno;
    r.getCell('Q').value = f.apellido_materno;
    r.getCell('R').value = f.nombre;
    r.getCell('S').value = f.genero;
    r.getCell('T').value = f.fecha_nacimiento;
    r.getCell('U').value = f.edad;
    r.getCell('V').value = f.telefono;
    r.getCell('W').value = f.correo;
    r.getCell('X').value = f.fecha_ingreso;
    r.getCell('Y').value = f.anios_servicio_conafe;
    r.getCell('Z').value = f.situacion_actual;
    if (f.siiinafe) {
      r.getCell('BR').value = f.siiinafe.total_documentacion;
    }
    r.getCell('BS').value = f.baja_observaciones;
    r.commit();
    row++;
  }
}

// ===========================================================================
// Hoja 1: CONCENTRADO — 26 microrregiones, 3 bloques apilados
// ===========================================================================

const MICROS_BASE = 26;
const FIG_FIRST = 8;     // R8..R33 (26 filas) + R34 totales
const SVC_FIRST = 39;    // R39..R64 + R65 totales
const ALU_FIRST = 71;    // R71..R96 + R97 Total General

function fillConcentrado(wb: ExcelJS.Workbook, input: FillInput) {
  const ws = findSheet(wb, 'CONCENTRADO');

  // Indexar CCTs por cve_microregion (1..26)
  const cctsByMicro = new Map<number, CctRow[]>();
  for (const c of input.ccts) {
    if (c.cve_microregion == null) continue;
    const list = cctsByMicro.get(c.cve_microregion) ?? [];
    list.push(c);
    cctsByMicro.set(c.cve_microregion, list);
  }
  const figByMicro = new Map<number, FiguraRow[]>();
  for (const f of input.figurasActivas) {
    const ccts = input.ccts.find((c) => c.cct === f.cct);
    const micro = ccts?.cve_microregion;
    if (micro == null) continue;
    const list = figByMicro.get(micro) ?? [];
    list.push(f);
    figByMicro.set(micro, list);
  }

  // ---------- Bloque 1: Total X Figura (R8..R33) ----------
  // E/F Inicial M/F  G/H Pree M/F  I/J CIC M/F  K/L PreeMig M/F  M/N Prim M/F  O/P Sec M/F
  // Q/R Total x Gén M/F  S Total Gen  T Metas  U Faltantes (=T-S)
  const figTotals = { M: 0, F: 0, total: 0, meta: 0 };
  for (let i = 1; i <= MICROS_BASE; i++) {
    const r = ws.getRow(FIG_FIRST + i - 1);
    const figuras = figByMicro.get(i) ?? [];
    const buckets = {
      Inicial:    { M: 0, F: 0 },
      Preescolar: { M: 0, F: 0 },
      CIC:        { M: 0, F: 0 },
      PreeMig:    { M: 0, F: 0 },
      Prim:       { M: 0, F: 0 },
      Sec:        { M: 0, F: 0 },
    };
    for (const f of figuras) {
      const bucket = mapFiguraToModalidad(f);
      if (!bucket) continue;
      const gen = (f.genero ?? '').toUpperCase();
      const isHombre = ['H','HOMBRE','MASCULINO'].includes(gen);
      const isMujer  = ['M','F','MUJER','FEMENINO'].includes(gen);
      if (isHombre) buckets[bucket].M++;
      if (isMujer)  buckets[bucket].F++;
    }
    r.getCell('E').value = buckets.Inicial.M;
    r.getCell('F').value = buckets.Inicial.F;
    r.getCell('G').value = buckets.Preescolar.M;
    r.getCell('H').value = buckets.Preescolar.F;
    r.getCell('I').value = buckets.CIC.M;
    r.getCell('J').value = buckets.CIC.F;
    r.getCell('K').value = buckets.PreeMig.M;
    r.getCell('L').value = buckets.PreeMig.F;
    r.getCell('M').value = buckets.Prim.M;
    r.getCell('N').value = buckets.Prim.F;
    r.getCell('O').value = buckets.Sec.M;
    r.getCell('P').value = buckets.Sec.F;
    const totM = buckets.Inicial.M + buckets.Preescolar.M + buckets.CIC.M + buckets.PreeMig.M + buckets.Prim.M + buckets.Sec.M;
    const totF = buckets.Inicial.F + buckets.Preescolar.F + buckets.CIC.F + buckets.PreeMig.F + buckets.Prim.F + buckets.Sec.F;
    r.getCell('Q').value = totM;
    r.getCell('R').value = totF;
    r.getCell('S').value = totM + totF;
    // T (Metas) y U (Faltantes) los conserva la plantilla (manuales)
    figTotals.M += totM; figTotals.F += totF; figTotals.total += totM + totF;
  }
  // Fila R34 = totales del bloque 1
  const rFig34 = ws.getRow(34);
  rFig34.getCell('Q').value = figTotals.M;
  rFig34.getCell('R').value = figTotals.F;
  rFig34.getCell('S').value = figTotals.total;

  // ---------- Bloque 2: Servicios (R39..R64) ----------
  // E/F Inicial M/A  G/H Pree M/A  I/J CIC  K/L PreeMig  M/N Prim  O/P Sec
  // Q Metas  R Atendidos  S Sin atender  T Comunidades
  const svcTotals = { atendidos: 0, comunidades: new Set<number>() };
  for (let i = 1; i <= MICROS_BASE; i++) {
    const r = ws.getRow(SVC_FIRST + i - 1);
    const ccts = cctsByMicro.get(i) ?? [];
    const buckets = { Inicial: 0, Preescolar: 0, CIC: 0, PreeMig: 0, Prim: 0, Sec: 0 };
    const localidadesSet = new Set<number>();
    for (const c of ccts) {
      const m = (c.modalidad_nombre ?? '').toUpperCase();
      if (m.includes('INICIAL')) buckets.Inicial++;
      else if (m.includes('PREESCOLAR') && m.includes('MIGRANTE')) buckets.PreeMig++;
      else if (m.includes('PREESCOLAR')) buckets.Preescolar++;
      else if (m.includes('CIC') || m.includes('CENTRO INFANTIL')) buckets.CIC++;
      else if (m.includes('PRIMARIA')) buckets.Prim++;
      else if (m.includes('SECUNDARIA')) buckets.Sec++;
      if (c.cve_localidad != null) localidadesSet.add(c.cve_localidad);
    }
    r.getCell('F').value = buckets.Inicial;
    r.getCell('H').value = buckets.Preescolar;
    r.getCell('J').value = buckets.CIC;
    r.getCell('L').value = buckets.PreeMig;
    r.getCell('N').value = buckets.Prim;
    r.getCell('P').value = buckets.Sec;
    const atendidos = buckets.Inicial + buckets.Preescolar + buckets.CIC + buckets.PreeMig + buckets.Prim + buckets.Sec;
    r.getCell('R').value = atendidos;
    r.getCell('T').value = localidadesSet.size;
    svcTotals.atendidos += atendidos;
    for (const l of localidadesSet) svcTotals.comunidades.add(l);
  }
  const rSvc65 = ws.getRow(65);
  rSvc65.getCell('R').value = svcTotals.atendidos;
  rSvc65.getCell('T').value = svcTotals.comunidades.size;

  // ---------- Bloque 3: Estadística de Atención (alumnos) (R71..R96) ----------
  const aluTotals = makeAluRowAcc();
  for (let i = 1; i <= MICROS_BASE; i++) {
    const r = ws.getRow(ALU_FIRST + i - 1);
    const ccts = cctsByMicro.get(i) ?? [];
    const acc = makeAluRowAcc();
    for (const c of ccts) {
      const a = input.alumnosAggByCct.get(c.cct);
      if (!a) continue;
      acc.ini_ninos_0_2 += a.inicial_ninos_0_2;
      acc.ini_ninas_0_2 += a.inicial_ninas_0_2;
      acc.ini_ninos_2_3 += a.inicial_ninos_2_3;
      acc.ini_ninas_2_3 += a.inicial_ninas_2_3;
      acc.ini_ninos_3_4 += a.inicial_ninos_3_4;
      acc.ini_ninas_3_4 += a.inicial_ninas_3_4;
      acc.embarazadas += c.estad?.embarazadas ?? 0;
      acc.cuidadores  += c.estad?.cuidadores ?? 0;
      acc.papas    += c.estad?.padres ?? 0;
      acc.mamas    += c.estad?.madres ?? 0;
      acc.pre_1_h += a.pre_1_h; acc.pre_1_m += a.pre_1_m;
      acc.pre_2_h += a.pre_2_h; acc.pre_2_m += a.pre_2_m;
      acc.pre_3_h += a.pre_3_h; acc.pre_3_m += a.pre_3_m;
      acc.pri_1_h += a.pri_1_h; acc.pri_1_m += a.pri_1_m;
      acc.pri_2_h += a.pri_2_h; acc.pri_2_m += a.pri_2_m;
      acc.pri_3_h += a.pri_3_h; acc.pri_3_m += a.pri_3_m;
      acc.pri_4_h += a.pri_4_h; acc.pri_4_m += a.pri_4_m;
      acc.pri_5_h += a.pri_5_h; acc.pri_5_m += a.pri_5_m;
      acc.pri_6_h += a.pri_6_h; acc.pri_6_m += a.pri_6_m;
      acc.sec_1_h += a.sec_1_h; acc.sec_1_m += a.sec_1_m;
      acc.sec_2_h += a.sec_2_h; acc.sec_2_m += a.sec_2_m;
      acc.sec_3_h += a.sec_3_h; acc.sec_3_m += a.sec_3_m;
    }
    writeAluRow(r, acc);
    addAluAcc(aluTotals, acc);
  }
  // R97 Total General
  const rAlu97 = ws.getRow(97);
  writeAluRow(rAlu97, aluTotals);
}

function mapFiguraToModalidad(f: FiguraRow): 'Inicial'|'Preescolar'|'CIC'|'PreeMig'|'Prim'|'Sec'|null {
  const m = (f.modalidad_nombre ?? '').toUpperCase();
  if (m.includes('INICIAL')) return 'Inicial';
  if (m.includes('PREESCOLAR') && m.includes('MIGRANTE')) return 'PreeMig';
  if (m.includes('PREESCOLAR')) return 'Preescolar';
  if (m.includes('CIC') || m.includes('CENTRO INFANTIL')) return 'CIC';
  if (m.includes('PRIMARIA')) return 'Prim';
  if (m.includes('SECUNDARIA')) return 'Sec';
  return null;
}

interface AluRowAcc {
  ini_ninos_0_2: number; ini_ninas_0_2: number;
  ini_ninos_2_3: number; ini_ninas_2_3: number;
  ini_ninos_3_4: number; ini_ninas_3_4: number;
  embarazadas: number; cuidadores: number; papas: number; mamas: number;
  pre_1_h: number; pre_1_m: number;
  pre_2_h: number; pre_2_m: number;
  pre_3_h: number; pre_3_m: number;
  pri_1_h: number; pri_1_m: number;
  pri_2_h: number; pri_2_m: number;
  pri_3_h: number; pri_3_m: number;
  pri_4_h: number; pri_4_m: number;
  pri_5_h: number; pri_5_m: number;
  pri_6_h: number; pri_6_m: number;
  sec_1_h: number; sec_1_m: number;
  sec_2_h: number; sec_2_m: number;
  sec_3_h: number; sec_3_m: number;
}
const makeAluRowAcc = (): AluRowAcc => ({
  ini_ninos_0_2: 0, ini_ninas_0_2: 0, ini_ninos_2_3: 0, ini_ninas_2_3: 0,
  ini_ninos_3_4: 0, ini_ninas_3_4: 0, embarazadas: 0, cuidadores: 0, papas: 0, mamas: 0,
  pre_1_h: 0, pre_1_m: 0, pre_2_h: 0, pre_2_m: 0, pre_3_h: 0, pre_3_m: 0,
  pri_1_h: 0, pri_1_m: 0, pri_2_h: 0, pri_2_m: 0, pri_3_h: 0, pri_3_m: 0,
  pri_4_h: 0, pri_4_m: 0, pri_5_h: 0, pri_5_m: 0, pri_6_h: 0, pri_6_m: 0,
  sec_1_h: 0, sec_1_m: 0, sec_2_h: 0, sec_2_m: 0, sec_3_h: 0, sec_3_m: 0,
});
function addAluAcc(dst: AluRowAcc, src: AluRowAcc) {
  for (const k of Object.keys(dst) as (keyof AluRowAcc)[]) dst[k] += src[k];
}

function writeAluRow(r: ExcelJS.Row, a: AluRowAcc) {
  // Inicial: E..V (20 cols)
  r.getCell('E').value = a.ini_ninos_0_2;
  r.getCell('F').value = a.ini_ninas_0_2;
  r.getCell('G').value = a.ini_ninos_2_3;
  r.getCell('H').value = a.ini_ninas_2_3;
  r.getCell('I').value = a.ini_ninos_2_3;  // 2-3 repeated col en plantilla
  r.getCell('J').value = a.ini_ninas_2_3;
  r.getCell('K').value = a.ini_ninos_3_4;
  r.getCell('L').value = a.ini_ninas_3_4;
  const totIniH = a.ini_ninos_0_2 + a.ini_ninos_2_3 + a.ini_ninos_3_4;
  const totIniM = a.ini_ninas_0_2 + a.ini_ninas_2_3 + a.ini_ninas_3_4;
  r.getCell('M').value = totIniH;
  r.getCell('N').value = totIniM;
  r.getCell('O').value = totIniH + totIniM;
  r.getCell('P').value = a.embarazadas;
  r.getCell('Q').value = a.cuidadores;
  // R Cuidadoras: la plantilla separa cuidadores/cuidadoras pero la BD no.
  r.getCell('S').value = a.papas;
  r.getCell('T').value = a.mamas;
  r.getCell('U').value = a.embarazadas + a.cuidadores + a.papas + a.mamas;
  r.getCell('V').value = totIniH + totIniM + a.embarazadas + a.cuidadores + a.papas + a.mamas;

  // Preescolar W..AH (12 cols: 1-3 H/M/T + TH/TM/TG)
  r.getCell('W').value = a.pre_1_h; r.getCell('X').value = a.pre_1_m; r.getCell('Y').value = a.pre_1_h + a.pre_1_m;
  r.getCell('Z').value = a.pre_2_h; r.getCell('AA').value = a.pre_2_m; r.getCell('AB').value = a.pre_2_h + a.pre_2_m;
  r.getCell('AC').value = a.pre_3_h; r.getCell('AD').value = a.pre_3_m; r.getCell('AE').value = a.pre_3_h + a.pre_3_m;
  const preTH = a.pre_1_h + a.pre_2_h + a.pre_3_h;
  const preTM = a.pre_1_m + a.pre_2_m + a.pre_3_m;
  r.getCell('AF').value = preTH; r.getCell('AG').value = preTM; r.getCell('AH').value = preTH + preTM;

  // Primaria AI..BC
  r.getCell('AI').value = a.pri_1_h; r.getCell('AJ').value = a.pri_1_m; r.getCell('AK').value = a.pri_1_h + a.pri_1_m;
  r.getCell('AL').value = a.pri_2_h; r.getCell('AM').value = a.pri_2_m; r.getCell('AN').value = a.pri_2_h + a.pri_2_m;
  r.getCell('AO').value = a.pri_3_h; r.getCell('AP').value = a.pri_3_m; r.getCell('AQ').value = a.pri_3_h + a.pri_3_m;
  r.getCell('AR').value = a.pri_4_h; r.getCell('AS').value = a.pri_4_m; r.getCell('AT').value = a.pri_4_h + a.pri_4_m;
  r.getCell('AU').value = a.pri_5_h; r.getCell('AV').value = a.pri_5_m; r.getCell('AW').value = a.pri_5_h + a.pri_5_m;
  r.getCell('AX').value = a.pri_6_h; r.getCell('AY').value = a.pri_6_m; r.getCell('AZ').value = a.pri_6_h + a.pri_6_m;
  const priTH = a.pri_1_h + a.pri_2_h + a.pri_3_h + a.pri_4_h + a.pri_5_h + a.pri_6_h;
  const priTM = a.pri_1_m + a.pri_2_m + a.pri_3_m + a.pri_4_m + a.pri_5_m + a.pri_6_m;
  r.getCell('BA').value = priTH; r.getCell('BB').value = priTM; r.getCell('BC').value = priTH + priTM;

  // Secundaria BD..BO
  r.getCell('BD').value = a.sec_1_h; r.getCell('BE').value = a.sec_1_m; r.getCell('BF').value = a.sec_1_h + a.sec_1_m;
  r.getCell('BG').value = a.sec_2_h; r.getCell('BH').value = a.sec_2_m; r.getCell('BI').value = a.sec_2_h + a.sec_2_m;
  r.getCell('BJ').value = a.sec_3_h; r.getCell('BK').value = a.sec_3_m; r.getCell('BL').value = a.sec_3_h + a.sec_3_m;
  const secTH = a.sec_1_h + a.sec_2_h + a.sec_3_h;
  const secTM = a.sec_1_m + a.sec_2_m + a.sec_3_m;
  r.getCell('BM').value = secTH; r.getCell('BN').value = secTM; r.getCell('BO').value = secTH + secTM;

  // Totales BP..BV
  const totH = totIniH + preTH + priTH + secTH;
  const totM = totIniM + preTM + priTM + secTM;
  r.getCell('BP').value = totH;
  r.getCell('BQ').value = totM;
  r.getCell('BR').value = totH + totM;
  r.getCell('BS').value = a.papas;
  r.getCell('BT').value = a.mamas;
  r.getCell('BU').value = a.papas + a.mamas;
  r.getCell('BV').value = totH + totM + a.papas + a.mamas + a.embarazadas + a.cuidadores;
  r.getCell('BW').value = totH + totM;
  r.getCell('BX').value = a.papas + a.mamas + a.embarazadas + a.cuidadores;
  r.getCell('BY').value = totH + totM + a.papas + a.mamas + a.embarazadas + a.cuidadores;
}
