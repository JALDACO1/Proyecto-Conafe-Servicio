# Blueprint del CEA 25-26 (VACIO)

Fuente: `archivos excel utiles/CEA 25-26 VACIO.xlsx` (4 hojas) + `Datos_a_recuperar.xlsx`.

## Hojas y dimensiones

| Hoja | Rows usadas | Cols usadas | Merges | Rol |
| --- | --- | --- | --- | --- |
| CONCENTRADO | 5–97 | A–BY (77) | 75 | Resumen por microrregión (Figuras, Servicios, Alumnos + total general) |
| Estadística de Servicios | 2–138 | A–DM (129) | 44 | Listado por CCT: Servicio Educativo, Educadores, Inicial, Básica (Pree/Prim/Sec), Infraestructura |
| Estadística Figuras y Atención | 3–258 | A–BP (68) | 6 | Listado de figuras ACTIVAS (EC/ECA/ECR) con expediente SIIINAFE |
| Bajas de Figuras | 3–57 | A–BS (71) | 2 | Listado de figuras dadas de baja |

## CONCENTRADO — 3 bloques apilados

### Bloque 1: Total X Figura (R5–R34)
- R5 (merge B5:U5): "Total X Figura", bg #FFDAC1ED bold
- R6/R7: Headers — B=Microrregión, C=ECA, D=Coord Seguimiento; pares M/F para Inicial, Preescolar, CIC, PreeMig, Prim, Sec; Q/R=Total x Gén M/F; S=Total Gen; T=Metas; U=Faltantes (=T−S)
- R8–R33: 26 filas de microrregión (hardcoded "01 Colima"…"26 Minatitlán - Villa de Álvarez")
- R34: `=SUM(...)` totales

### Bloque 2: Servicios (R36–R65)
- R36 "Servicios" (merge B36:T36)
- R37/R38 headers con pares Meta/Atendidos por modalidad; Q=Metas, R=Atendidos, S=Sin atender (red #FFFFA3A3), T=Comunidades
- R39–R64: 26 filas de microrregión
- R65: totales `=SUM(...)` + `=Q65-R65` para Sin atender

### Bloque 3: Estadística de Atención (Alumnos) (R67–R97)
- R67 "ESTADÍSTICA DE ATENCIÓN" (merge E67:BY67)
- R68–R70: 3 filas de headers merged
  - E–V: EDUCACIÓN INICIAL (rangos de edad + totales + adultos)
  - W–AH: PREESCOLAR (1°/2°/3° H/M/T + TH/TM/TG)
  - AI–BC: PRIMARIA (1°–6° H/M/T + TH/TM/TG)
  - BD–BO: SECUNDARIA (1°/2°/3° H/M/T + TH/TM/TG)
  - BP=Total H, BQ=Total M, BR=Total alumnos
  - BS=Padres, BT=Madres, BU=Total Padres/tutores, BV=Total Comunidad
  - BW=Total Niños y alumnos, BX=Total Adultos y Padres, BY=Total de Beneficiarios
- R71–R96: 26 filas de microrregión (mismas que Figuras/Servicios)
- R97 (merge B97:D97) = "Total General"

⚠️ En la plantilla, las celdas de alumnos de cada microrregión del CONCENTRADO hacen SUM de filas específicas de la hoja "Estadística de Servicios" (p.ej. R90 suma filas 86, 90, 93, 95, 97, 101). Al generar desde BD debemos **calcular en código** en vez de usar fórmulas posicionales — las filas cambian según cuántos CCT haya.

## Estadística de Servicios — 1 fila por CCT (empieza en R6)

### Encabezados (R2–R5)
- R2 (Y2:CX2): "ESTADÍSTICA DE ATENCIÓN"
- R3: secciones (Educadores, Educación Inicial, Educación Básica, Totales)
- R4: sub-secciones (SEGUIMIENTO, SERVICIO EDUCATIVO, Apoyo desayunos, Preescolar, Primaria, Secundaria, Totales, Infraestructura)
- R5: columnas detalladas (136 columnas hasta DM)

### Columnas clave
| Col | Campo | Origen |
| --- | --- | --- |
| B | Región CONAFE | Master Servicios |
| C | Microregión | Master Servicios |
| D | ECA Responsable | Master Figuras (filtrar idFigura=ECA) |
| E | Coordinador de Seguimiento | Master Figuras (idFigura=ECR) |
| F | Clave INEGI | **Manual/INEGI** |
| G | Código Postal | **Manual/SEPOMEX** |
| H | Identificador de Inmueble | **Manual** |
| I | Latitud | **Manual/georref** |
| J | Longitud | **Manual/georref** |
| K | % Analfabetismo | **INEGI externo** |
| L | Grado Marginación | Master Servicios (col AB) |
| M | Población total | Master Servicios (col AE) |
| N | Nombre municipio | Master Servicios |
| O | Nombre localidad | Master Servicios |
| P | COMUNIDAD | Cálculo/Manual |
| Q | Cantidad servicios | Conteo CCTs por localidad |
| R | EC Polivalente | **Manual** |
| S | Programas Polivalente | **Manual** |
| T–W | Inicial / Preescolar / Primaria / Secundaria (marca) | Master Servicios filtrando modalidad |
| X | Apoyo desayunos | **Manual** |
| Y | EC Meta | **Planeación CONAFE (manual)** |
| Z, AA | M, F instructores | Master Servicios cols R, S |
| AB | EC Asignados | Master Servicios col T |
| AC | Faltantes | Fórmula = Y − AB |
| AD–AU | Inicial: rangos edad niños/niñas, embarazadas, cuidadores, padres, madres | Master Alumnos (filtros por edad+género+CCT) |
| AV–BG | Preescolar: 1°–3° H/M/T + TH/TM/TG | Master Servicios N1/N2/N3 o Master Alumnos |
| BH–CB | Primaria: 1°–6° H/M/T + TH/TM/TG | Master Alumnos (6 grados) |
| CC–CN | Secundaria: 1°–3° H/M/T + TH/TM/TG | Master Servicios N1/N2/N3 |
| CO–CU | Totales alumnos, padres/tutores | Cálculo/Master Alumnos |
| CV–CX | Totales comunidad | Cálculo |
| CY–DM | **Infraestructura: tipo aula, baños, energía, agua, drenaje, internet, LEEN…** | **Manual (levantamiento en campo)** |

## Estadística Figuras y Atención — 1 fila por figura activa (R6+)

- R3 (AV3:BN3 merge): "Expediente Electrónico SIIINAFE"
- R4: secciones (Asignación y seguimiento, Datos figura, Registro, Complementaria, Carga Figura Aplicación)
- R5: 68 columnas detalladas
- B5: "No." (**consecutivo manual** o auto-generado)
- C–K: Región, Sede, Microrregión, ECA, Coord, Municipio, Servicio, Nivel, CCT
- L–AU: Datos personales y laborales (40 campos del Master Figuras)
- AV–BN: Flags 0/1 de expediente SIIINAFE (19 documentos)
- BO: Total documentación (=SUM(AV:BN))
- BP: **Observaciones (manual)**

## Bajas de Figuras — 1 fila por baja (R5+)

- R3: "BAJAS DE FIGURAS" (B:G) + "Expediente Electrónico SIIINAFE" (AX:BQ)
- R4: 70 columnas detalladas
- B: "No." (consecutivo)
- C: Fecha de baja (Master Figuras col AY)
- D: Motivo (Master Figuras col AX/AW)
- E–N: Ubicación y clasificación (Region, Sede, Microrregión, Educador, Coord, Municipio, Servicio, Nivel, CCT, Figura)
- O–AW: Datos personales y laborales
- AX–BQ: Flags 0/1 SIIINAFE (20 documentos)
- BR: Total documentación (=SUM(AX:BQ))
- BS: **Observaciones (manual — ej. "FALTA CREDENCIAL", "FALTA ESCRITO CONECTIVIDAD")**

## Campos MANUALES a persistir tras re-upload de CEA editado

### Por CCT (tabla `servicio_estadisticas` o nueva `ccts_manual_fields`):
1. `clave_inegi` (string)
2. `codigo_postal` (string)
3. `identificador_inmueble` (string)
4. `latitud` (numeric)
5. `longitud` (numeric)
6. `porcentaje_analfabetismo` (numeric)
7. `ec_polivalente` (boolean)
8. `programas_polivalente` (string)
9. `apoyo_desayunos_escolares` (string)
10. `ec_meta` (int)
11. **Infraestructura (CY–DM):**
    - `tipo_aula` (string)
    - `documento_probatorio` (string)
    - `tipo_aula_material` (string)
    - `banos_cantidad` (int)
    - `areas_deportivas` (boolean)
    - `comedores_capacidad` (int)
    - `cerco_perimetral` (boolean)
    - `energia_electrica` (boolean)
    - `servicio_agua` (boolean)
    - `drenaje` (boolean)
    - `senal_telefonica` (boolean)
    - `internet_comunidad` (boolean)
    - `internet_escuela` (boolean)
    - `proveedor_internet` (string)
    - `apoyo_leen_anios` (string)

### Por figura ACTIVA (tabla `figuras` o nueva `figuras_cea_manual`):
- `observaciones` (string)

### Por figura BAJA (tabla `figura_bajas`):
- `observaciones` (string) — probablemente ya existe

## Próximos pasos (implementación)

1. **Migración SQL** — agregar columnas manuales a tablas existentes, crear tabla `ccts_infraestructura` si se prefiere separar.
2. **Actualizar ingest-master** para no sobrescribir campos manuales al re-ingerir masters (ya usa upsert con `ignoreDuplicates`, pero conviene documentar qué campos NUNCA se tocan).
3. **Lógica de clausura de servicios** (#3): agregar columna `activo bool default true` a `ccts`; al ingerir Master Servicios, marcar como `activo=false` los CCTs que estaban activos y no aparecen en el nuevo master.
4. **Reescribir `process-cea/index.ts`** para consultar la BD (no Excel):
   - Leer `servicio_estadisticas` + `figuras` + `figura_bajas` + `alumnos` + `tutores` + manuales
   - Filtrar `alumnos.baja IS NULL`, `ccts.activo=true`
   - Agregar por microrregión para CONCENTRADO
   - Llenar las 4 hojas con ExcelJS respetando merges/estilos del VACIO
5. **Nueva edge function `upload-cea-editado`**:
   - Recibe XLSX editado
   - Lee los campos manuales (por CCT/figura/baja) usando mapeo fijo de celdas
   - UPSERT en BD
6. **UI**: módulo en frontend para subir CEA editado (similar a MasterUpload pero apunta a la nueva función).
