/**
 * Data Processor con Danfo.js
 * ============================
 * Procesamiento de datos tipo pandas para generar archivos CEA
 *
 * Este archivo contiene la lógica core del sistema:
 * - Lee los 4 archivos Master Excel
 * - Procesa los datos usando Danfo.js (equivalente a pandas en JavaScript)
 * - Hace merge, groupby, pivot de datos
 * - Genera el DataFrame final del CEA
 *
 * Danfo.js proporciona una API similar a pandas de Python:
 * - DataFrames y Series
 * - groupby(), merge(), pivot()
 * - map(), apply(), filter()
 * - Operaciones vectorizadas
 */

import * as dfd from 'danfojs';
import * as XLSX from 'xlsx';
import type {
  AlumnosData,
  ServiciosData,
  FigurasData,
  TelefoniaData,
} from '../../_shared/types.ts';

// ============================================================================
// FUNCIÓN: processMasterAlumnos
// ============================================================================
/**
 * Lee y procesa el archivo Master de Alumnos
 * Extrae datos de alumnos por microrregión, género y nivel educativo
 *
 * @param arrayBuffer - Buffer del archivo Excel
 * @returns Promise<AlumnosData> con los datos procesados
 *
 * Ejemplo de datos de salida:
 * {
 *   microregion: ['AGUASCALIENTES', 'AGUASCALIENTES', ...],
 *   genero: ['M', 'H', ...],
 *   nivel: ['EDUCACIÓN INICIAL', 'NIVEL I', ...]
 * }
 */
export async function processMasterAlumnos(
  arrayBuffer: ArrayBuffer
): Promise<AlumnosData> {
  try {
    // 1. Leer el archivo Excel usando SheetJS (xlsx)
    console.log('📖 Leyendo Master de Alumnos...');
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // 2. Obtener la hoja "Master" (nombre específico según README)
    const sheetName = 'Master';
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error(`No se encontró la hoja "${sheetName}" en Master de Alumnos`);
    }

    // 3. Convertir la hoja a JSON (array de objetos)
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    console.log(`✅ Master de Alumnos leído: ${jsonData.length} registros`);

    // 4. Crear un DataFrame de Danfo.js desde los datos JSON
    // DataFrame es equivalente a pandas.DataFrame en Python
    const df = new dfd.DataFrame(jsonData);

    // 5. Validar que existan las columnas requeridas
    const requiredColumns = ['Microregion', 'Genero', 'Nivel'];
    const missingColumns = requiredColumns.filter(
      (col) => !df.columns.includes(col)
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `Columnas faltantes en Master de Alumnos: ${missingColumns.join(', ')}`
      );
    }

    // 6. Filtrar filas con valores nulos en columnas críticas
    // Similar a: df.dropna(subset=['Microregion', 'Genero', 'Nivel'])
    const dfFiltered = df.dropna({ axis: 0, subset: ['Microregion', 'Genero', 'Nivel'] });

    // 7. Normalizar valores (convertir a mayúsculas y eliminar espacios extra)
    // Similar a: df['Genero'] = df['Genero'].str.upper().str.strip()
    const generoNormalizado = dfFiltered.column('Genero').map((val: any) => {
      return String(val).toUpperCase().trim();
    });

    const microregionNormalizada = dfFiltered.column('Microregion').map((val: any) => {
      return String(val).toUpperCase().trim();
    });

    const nivelNormalizado = dfFiltered.column('Nivel').map((val: any) => {
      return String(val).toUpperCase().trim();
    });

    // 8. Retornar los datos procesados en formato estructurado
    return {
      microregion: microregionNormalizada.values,
      genero: generoNormalizado.values,
      nivel: nivelNormalizado.values,
    };
  } catch (error) {
    console.error('❌ Error procesando Master de Alumnos:', error);
    throw new Error(`Error procesando Master de Alumnos: ${error.message}`);
  }
}

// ============================================================================
// FUNCIÓN: categorizarNivel
// ============================================================================
/**
 * Categoriza el nivel educativo basándose en palabras clave
 * Reglas de negocio definidas en el README
 *
 * @param nivel - Texto del nivel educativo (ej. "NIVEL I", "2O. GRADO")
 * @returns Categoría normalizada ("Inicial", "Preescolar", "Primaria")
 *
 * Reglas:
 * - Contiene "inici" → Inicial
 * - Contiene "nivel" → Preescolar
 * - Contiene "grado" → Primaria
 * - Otro → Retorna nivel original
 */
export function categorizarNivel(nivel: string): string {
  const nivelLower = String(nivel).toLowerCase();

  // Si contiene "inici" → Inicial
  if (nivelLower.includes('inici')) {
    return 'Inicial';
  }

  // Si contiene "nivel" → Preescolar
  if (nivelLower.includes('nivel')) {
    return 'Preescolar';
  }

  // Si contiene "grado" → Primaria
  if (nivelLower.includes('grado')) {
    return 'Primaria';
  }

  // Por defecto, retornar el nivel original
  return nivel;
}

// ============================================================================
// FUNCIÓN: agruparAlumnosPorMicroregion
// ============================================================================
/**
 * Agrupa y cuenta alumnos por microrregión, género y nivel categorizado
 * Similar a: df.groupby(['microregion', 'genero', 'nivel']).size()
 *
 * @param alumnos - Datos de alumnos procesados
 * @returns DataFrame con conteo de alumnos agrupados
 *
 * Ejemplo de output:
 * | microregion       | genero | nivelCategorizado | cantidad |
 * |-------------------|--------|-------------------|----------|
 * | AGUASCALIENTES    | M      | Inicial           | 45       |
 * | AGUASCALIENTES    | H      | Inicial           | 52       |
 * | AGUASCALIENTES    | M      | Preescolar        | 120      |
 */
export function agruparAlumnosPorMicroregion(
  alumnos: AlumnosData
): dfd.DataFrame {
  try {
    console.log('📊 Agrupando alumnos por microrregión...');

    // 1. Crear DataFrame desde los datos de alumnos
    const df = new dfd.DataFrame({
      microregion: alumnos.microregion,
      genero: alumnos.genero,
      nivel: alumnos.nivel,
    });

    // 2. Agregar columna de nivel categorizado
    // Similar a: df['nivelCategorizado'] = df['nivel'].apply(categorizarNivel)
    const nivelCategorizado = df.column('nivel').map(categorizarNivel);
    df.addColumn('nivelCategorizado', nivelCategorizado, { inplace: true });

    // 3. Crear columna de conteo (todas las filas cuentan como 1)
    const ones = new Array(df.shape[0]).fill(1);
    df.addColumn('count', ones, { inplace: true });

    // 4. Agrupar por microrregión, género y nivel categorizado
    // Similar a: df.groupby(['microregion', 'genero', 'nivelCategorizado']).sum()
    const grouped = df.groupby(['microregion', 'genero', 'nivelCategorizado']).col(['count']).sum();

    // 5. Renombrar columna de conteo
    grouped.rename({ count_sum: 'cantidad' }, { inplace: true });

    console.log(`✅ Alumnos agrupados: ${grouped.shape[0]} grupos`);
    return grouped;
  } catch (error) {
    console.error('❌ Error agrupando alumnos:', error);
    throw new Error(`Error agrupando alumnos: ${error.message}`);
  }
}

// ============================================================================
// FUNCIÓN: processMasterServicios
// ============================================================================
/**
 * Lee y procesa el archivo Master de Servicios
 * Extrae datos de servicios por microrregión y modalidad
 *
 * @param arrayBuffer - Buffer del archivo Excel
 * @returns Promise<ServiciosData> con los datos procesados
 */
export async function processMasterServicios(
  arrayBuffer: ArrayBuffer
): Promise<ServiciosData> {
  try {
    console.log('📖 Leyendo Master de Servicios...');

    // 1. Leer el archivo Excel
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // 2. Obtener la hoja específica (nombre según README)
    const sheetName = 'MasterPRODET06 (2)';
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error(`No se encontró la hoja "${sheetName}" en Master de Servicios`);
    }

    // 3. Convertir a JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    console.log(`✅ Master de Servicios leído: ${jsonData.length} registros`);

    // 4. Crear DataFrame
    const df = new dfd.DataFrame(jsonData);

    // 5. Validar columnas requeridas
    const requiredColumns = ['nomMicroregion', 'nomModalidad'];
    const missingColumns = requiredColumns.filter(
      (col) => !df.columns.includes(col)
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `Columnas faltantes en Master de Servicios: ${missingColumns.join(', ')}`
      );
    }

    // 6. Normalizar valores
    const microregionNormalizada = df.column('nomMicroregion').map((val: any) => {
      return String(val).toUpperCase().trim();
    });

    const modalidadNormalizada = df.column('nomModalidad').map((val: any) => {
      return String(val).toUpperCase().trim();
    });

    // 7. Crear array temporal para agrupar
    const tempData = [];
    for (let i = 0; i < microregionNormalizada.values.length; i++) {
      tempData.push({
        microregion: microregionNormalizada.values[i],
        modalidad: modalidadNormalizada.values[i],
      });
    }

    // 8. Agrupar por microrregión y modalidad, contando servicios
    // Similar a: df.groupby(['microregion', 'modalidad']).size()
    const dfTemp = new dfd.DataFrame(tempData);
    const ones = new Array(dfTemp.shape[0]).fill(1);
    dfTemp.addColumn('count', ones, { inplace: true });

    const grouped = dfTemp.groupby(['microregion', 'modalidad']).col(['count']).sum();

    return {
      microregion: grouped.column('microregion').values,
      modalidad: grouped.column('modalidad').values,
      cantidad: grouped.column('count_sum').values,
    };
  } catch (error) {
    console.error('❌ Error procesando Master de Servicios:', error);
    throw new Error(`Error procesando Master de Servicios: ${error.message}`);
  }
}

// ============================================================================
// FUNCIÓN: categorizarModalidad
// ============================================================================
/**
 * Categoriza la modalidad de servicio basándose en palabras clave
 * Reglas de negocio definidas en el README
 *
 * @param modalidad - Texto de la modalidad (ej. "PREESCOLAR COMUNITARIO")
 * @returns Categoría normalizada ("Inicial", "CIC", "PreeMig", "Preescolar", "Prim", "Sec")
 *
 * Reglas:
 * - "inicial" → Inicial
 * - "centro infantil" o "cic" → CIC
 * - "preescolar" + "migrante" → PreeMig
 * - "preescolar" (sin migrante) → Preescolar
 * - "primaria" → Prim
 * - "secundaria" → Sec
 */
export function categorizarModalidad(modalidad: string): string {
  const modalidadLower = String(modalidad).toLowerCase();

  // "inicial" → Inicial
  if (modalidadLower.includes('inicial')) {
    return 'Inicial';
  }

  // "centro infantil" o "cic" → CIC
  if (modalidadLower.includes('centro infantil') || modalidadLower.includes('cic')) {
    return 'CIC';
  }

  // "preescolar" + "migrante" → PreeMig
  if (modalidadLower.includes('preescolar') && modalidadLower.includes('migrante')) {
    return 'PreeMig';
  }

  // "preescolar" (sin migrante) → Preescolar
  if (modalidadLower.includes('preescolar')) {
    return 'Preescolar';
  }

  // "primaria" → Prim
  if (modalidadLower.includes('primaria')) {
    return 'Prim';
  }

  // "secundaria" → Sec
  if (modalidadLower.includes('secundaria')) {
    return 'Sec';
  }

  // Por defecto, retornar modalidad original
  return modalidad;
}

// ============================================================================
// FUNCIÓN: processMasterFiguras
// ============================================================================
/**
 * Lee y procesa el archivo Master de Figuras Educativas
 * Extrae datos de figuras educativas (educadores, coordinadores)
 *
 * @param arrayBuffer - Buffer del archivo Excel
 * @returns Promise<FigurasData> con los datos procesados
 */
export async function processMasterFiguras(
  arrayBuffer: ArrayBuffer
): Promise<FigurasData> {
  try {
    console.log('📖 Leyendo Master de Figuras...');

    // 1. Leer el archivo Excel
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // 2. Obtener la hoja específica
    const sheetName = 'Master-Figuras-Educativas';
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error(`No se encontró la hoja "${sheetName}" en Master de Figuras`);
    }

    // 3. Convertir a JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    console.log(`✅ Master de Figuras leído: ${jsonData.length} registros`);

    // 4. Crear DataFrame
    const df = new dfd.DataFrame(jsonData);

    // 5. Validar columnas requeridas
    const requiredColumns = [
      'Microregion de servicio',
      'Figura',
      'apellidoPaterno',
      'apellidoMaterno',
      'nombre',
    ];
    const missingColumns = requiredColumns.filter(
      (col) => !df.columns.includes(col)
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `Columnas faltantes en Master de Figuras: ${missingColumns.join(', ')}`
      );
    }

    // 6. Construir nombre completo concatenando apellidos y nombre
    // Similar a: df['nombreCompleto'] = df['apellidoPaterno'] + ' ' + df['apellidoMaterno'] + ' ' + df['nombre']
    const nombresCompletos = [];
    const microregiones = [];
    const figuras = [];

    for (let i = 0; i < df.shape[0]; i++) {
      const row = df.iloc({ rows: [i] });
      const paterno = row.column('apellidoPaterno').values[0] || '';
      const materno = row.column('apellidoMaterno').values[0] || '';
      const nombre = row.column('nombre').values[0] || '';

      const nombreCompleto = `${paterno} ${materno} ${nombre}`.trim().toUpperCase();
      nombresCompletos.push(nombreCompleto);

      const microregion = String(row.column('Microregion de servicio').values[0]).toUpperCase().trim();
      microregiones.push(microregion);

      const figura = String(row.column('Figura').values[0]).toUpperCase().trim();
      figuras.push(figura);
    }

    return {
      microregion: microregiones,
      figura: figuras,
      nombreCompleto: nombresCompletos,
    };
  } catch (error) {
    console.error('❌ Error procesando Master de Figuras:', error);
    throw new Error(`Error procesando Master de Figuras: ${error.message}`);
  }
}

// ============================================================================
// FUNCIÓN: generarDataframeCEA
// ============================================================================
/**
 * Fusiona datos de alumnos, servicios y figuras para generar el CEA final
 * Esta es la función MÁS IMPORTANTE del sistema
 *
 * Realiza múltiples operaciones tipo pandas:
 * - merge() para combinar DataFrames
 * - groupby() para agrupar datos
 * - pivot() para transponer datos
 * - Cálculos de totales y faltantes
 *
 * @param alumnosAgrupados - DataFrame de alumnos agrupados
 * @param servicios - Datos de servicios
 * @param figuras - Datos de figuras
 * @returns DataFrame con estructura final del CEA
 *
 * Estructura del CEA generado:
 * | Microrregión | Educador | Coordinador | Inicial_M | Inicial_F | ... | Total | Metas | Faltantes |
 */
export function generarDataframeCEA(
  alumnosAgrupados: dfd.DataFrame,
  servicios: ServiciosData,
  figuras: FigurasData
): any {
  try {
    console.log('🔄 Generando DataFrame CEA...');

    // 1. Crear DataFrame de servicios
    const dfServicios = new dfd.DataFrame({
      microregion: servicios.microregion,
      modalidad: servicios.modalidad,
      metas: servicios.cantidad, // "Metas" son la cantidad de servicios programados
    });

    // 2. Categorizar modalidades (Inicial, CIC, Preescolar, etc.)
    const modalidadCategorizada = dfServicios.column('modalidad').map(categorizarModalidad);
    dfServicios.addColumn('modalidadCategorizada', modalidadCategorizada, { inplace: true });

    // 3. Crear DataFrame de figuras
    const dfFiguras = new dfd.DataFrame({
      microregion: figuras.microregion,
      figura: figuras.figura,
      nombreCompleto: figuras.nombreCompleto,
    });

    // 4. Filtrar figuras de Acompañamiento
    // Similar a: df[df['figura'].str.contains('acompañamiento', case=False)]
    const figurasAcompanamiento = [];
    for (let i = 0; i < dfFiguras.shape[0]; i++) {
      const figura = String(dfFiguras.column('figura').values[i]).toLowerCase();
      if (figura.includes('acompañamiento')) {
        figurasAcompanamiento.push({
          microregion: dfFiguras.column('microregion').values[i],
          nombreCompleto: dfFiguras.column('nombreCompleto').values[i],
        });
      }
    }

    // 5. Filtrar figuras de Seguimiento
    const figurasSeguimiento = [];
    for (let i = 0; i < dfFiguras.shape[0]; i++) {
      const figura = String(dfFiguras.column('figura').values[i]).toLowerCase();
      if (figura.includes('seguimiento')) {
        figurasSeguimiento.push({
          microregion: dfFiguras.column('microregion').values[i],
          nombreCompleto: dfFiguras.column('nombreCompleto').values[i],
        });
      }
    }

    // 6. Crear DataFrames de figuras filtradas
    const dfAcompanamiento = new dfd.DataFrame(figurasAcompanamiento);
    const dfSeguimiento = new dfd.DataFrame(figurasSeguimiento);

    // 7. Preparar datos para el CEA
    // Convertir DataFrames a arrays para manipulación más fácil
    const ceaData: any[] = [];
    const microregionesUnicas = new Set<string>();

    // Extraer todas las microrregiones únicas de alumnos
    const alumnosMicroregiones = alumnosAgrupados.column('microregion').values;
    alumnosMicroregiones.forEach((mr: string) => microregionesUnicas.add(mr));

    // 8. Construir registro CEA para cada microrregión
    microregionesUnicas.forEach((microregion) => {
      const registro: any = {
        Microregion: microregion,
        'Educador Comunitario de Acompañamiento': '',
        'Coordinador de Seguimiento': '',
      };

      // Asignar figuras de acompañamiento
      for (let i = 0; i < figurasAcompanamiento.length; i++) {
        if (figurasAcompanamiento[i].microregion === microregion) {
          registro['Educador Comunitario de Acompañamiento'] =
            figurasAcompanamiento[i].nombreCompleto;
          break;
        }
      }

      // Asignar figuras de seguimiento
      for (let i = 0; i < figurasSeguimiento.length; i++) {
        if (figurasSeguimiento[i].microregion === microregion) {
          registro['Coordinador de Seguimiento'] = figurasSeguimiento[i].nombreCompleto;
          break;
        }
      }

      // Inicializar columnas de modalidades por género
      const modalidades = ['Inicial', 'Preescolar', 'CIC', 'PreeMig', 'Prim', 'Sec'];
      const generos = ['M', 'F'];

      modalidades.forEach((modalidad) => {
        generos.forEach((genero) => {
          registro[`${modalidad}_${genero}`] = 0;
        });
      });

      // Llenar datos de alumnos
      for (let i = 0; i < alumnosAgrupados.shape[0]; i++) {
        const alumnoMr = alumnosAgrupados.column('microregion').values[i];
        if (alumnoMr === microregion) {
          const genero = alumnosAgrupados.column('genero').values[i];
          const nivel = alumnosAgrupados.column('nivelCategorizado').values[i];
          const cantidad = alumnosAgrupados.column('cantidad').values[i];

          // Convertir H -> M (masculino) y M -> F (femenino) según convención
          const generoKey = genero === 'H' ? 'M' : 'F';
          const key = `${nivel}_${generoKey}`;

          if (registro[key] !== undefined) {
            registro[key] += cantidad;
          }
        }
      }

      // Calcular totales por género
      let totalM = 0;
      let totalF = 0;

      modalidades.forEach((modalidad) => {
        totalM += registro[`${modalidad}_M`] || 0;
        totalF += registro[`${modalidad}_F`] || 0;
      });

      registro['Total_M'] = totalM;
      registro['Total_F'] = totalF;
      registro['Total_Gen'] = totalM + totalF;

      // Obtener metas de servicios para esta microrregión
      let metasTotal = 0;
      for (let i = 0; i < servicios.microregion.length; i++) {
        if (servicios.microregion[i] === microregion) {
          metasTotal += servicios.cantidad[i] || 0;
        }
      }

      registro['Metas'] = metasTotal;
      registro['Faltantes'] = metasTotal - registro['Total_Gen'];

      ceaData.push(registro);
    });

    // 9. Crear DataFrame final del CEA
    const dfCEA = new dfd.DataFrame(ceaData);

    console.log(`✅ DataFrame CEA generado: ${dfCEA.shape[0]} microrregiones`);

    // 10. Convertir DataFrame a formato JSON para excelWriter
    return dfCEA.values;
  } catch (error) {
    console.error('❌ Error generando DataFrame CEA:', error);
    throw new Error(`Error generando DataFrame CEA: ${error.message}`);
  }
}

console.log('📦 Data Processor con Danfo.js cargado');
