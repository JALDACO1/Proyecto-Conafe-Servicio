# Sistema CEA CONAFE - Documentacion Completa

## Tabla de Contenidos

1. [Descripcion General del Sistema](#1-descripcion-general-del-sistema)
2. [Requisitos Previos](#2-requisitos-previos)
3. [Instalacion Paso a Paso](#3-instalacion-paso-a-paso)
4. [Guia de Uso](#4-guia-de-uso)
5. [Descripcion de Funcionalidades](#5-descripcion-de-funcionalidades)
6. [Configuracion](#6-configuracion)
7. [Errores Comunes y Soluciones](#7-errores-comunes-y-soluciones)
8. [Preguntas Frecuentes (FAQ)](#8-preguntas-frecuentes-faq)

---

## 1. Descripcion General del Sistema

### Que es el Sistema CEA CONAFE?

El **Sistema CEA CONAFE** es una aplicacion web desarrollada para el **Consejo Nacional de Fomento Educativo (CONAFE)** de Mexico. Su proposito principal es automatizar el procesamiento de archivos Excel llamados **"Masters"** y generar a partir de ellos un reporte consolidado conocido como **archivo CEA** (Concentrado Estadistico Anual).

### Para que sirve?

En el trabajo diario de CONAFE, se manejan grandes volúmenes de datos educativos distribuidos en cuatro tipos de archivos Excel:

- **Master de Alumnos**: informacion de estudiantes por microrregion, genero y nivel educativo.
- **Master de Servicios**: datos de los servicios educativos por microrregion y modalidad.
- **Master de Figuras Educativas**: informacion de educadores y coordinadores.
- **Master de Telefonia**: datos de conectividad telefonica.

Antes de este sistema, consolidar estos datos requeria trabajo manual propenso a errores. El Sistema CEA automatiza todo este proceso: recibe los cuatro archivos Master, los valida, los cruza y genera un unico archivo CEA listo para su consulta y descarga.

### Quienes lo usan?

El sistema tiene dos tipos de usuarios:

| Rol | Que puede hacer |
|-----|----------------|
| **Administrador** | Subir archivos Master, validarlos, generar archivos CEA, ver historiales y gestionar el sistema completo. |
| **Usuario regular** | Consultar y descargar el archivo CEA mas reciente. |

---

## 2. Requisitos Previos

### Software necesario

Antes de instalar el sistema, asegurate de tener lo siguiente en tu computadora:

| Software | Version minima | Para que se necesita |
|----------|---------------|---------------------|
| **Node.js** | 18.0 o superior | Ejecutar el servidor de desarrollo del frontend |
| **npm** | 9.0 o superior | Instalar las dependencias del proyecto |
| **Git** | 2.0 o superior | Descargar el codigo fuente |
| **Supabase CLI** | 1.0 o superior | Administrar la base de datos y funciones del backend (solo desarrollo local) |
| **Navegador web** | Chrome, Firefox, Edge o Safari actualizados | Acceder a la aplicacion |

### Como verificar las versiones instaladas

Abre una terminal y ejecuta estos comandos:

```bash
node --version
# Debe mostrar v18.x.x o superior

npm --version
# Debe mostrar 9.x.x o superior

git --version
# Debe mostrar 2.x.x o superior
```

### Como instalar Node.js y npm

Si no tienes Node.js instalado:

1. Ve a [https://nodejs.org](https://nodejs.org)
2. Descarga la version **LTS** (recomendada)
3. Ejecuta el instalador y sigue las instrucciones
4. Reinicia tu terminal despues de la instalacion

### Cuenta de Supabase

El sistema utiliza **Supabase** como backend (base de datos, autenticacion y almacenamiento de archivos). Necesitaras:

1. Una cuenta gratuita en [https://supabase.com](https://supabase.com)
2. Un proyecto creado en Supabase
3. La **URL del proyecto** y la **Anon Key** (clave publica), que se obtienen desde el panel de configuracion de Supabase

---

## 3. Instalacion Paso a Paso

### Paso 1: Descargar el proyecto

```bash
git clone https://github.com/JALDACO1/Proyecto-Conafe-Servicio.git
cd Proyecto-Conafe-Servicio
```

### Paso 2: Instalar las dependencias del frontend

```bash
cd frontend
npm install
```

Este comando descargara todas las librerias necesarias. Puede tardar unos minutos dependiendo de tu conexion a internet.

### Paso 3: Configurar las variables de entorno

Copia el archivo de ejemplo y editalo con tus credenciales de Supabase:

```bash
cp .env.example .env.local
```

Abre el archivo `.env.local` con tu editor de texto favorito y completa los valores:

```env
# URL de tu proyecto de Supabase (obtenida del panel de Supabase)
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co

# Clave publica de tu proyecto (obtenida del panel de Supabase)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...tu-clave-aqui
```

> **Donde encuentro estos valores?**
> 1. Inicia sesion en [app.supabase.com](https://app.supabase.com)
> 2. Selecciona tu proyecto
> 3. Ve a **Settings** (Configuracion) > **API**
> 4. Copia la **Project URL** y la **anon public key**

### Paso 4: Configurar la base de datos

Desde el panel de Supabase, ve al **SQL Editor** y ejecuta las migraciones en orden:

1. `supabase/migrations/20240101000000_initial_schema.sql` - Crea las tablas principales
2. `supabase/migrations/20240101000001_storage_setup.sql` - Configura el almacenamiento de archivos
3. `supabase/migrations/20240101000002_auth_setup.sql` - Configura la autenticacion
4. `supabase/migrations/20240101000003_rls_policies.sql` - Configura las politicas de seguridad

Tambien puedes ejecutar directamente el archivo combinado:

```
supabase/migrations/EJECUTAR_EN_SUPABASE.sql
```

### Paso 5: Crear usuarios

Desde el panel de Supabase:

1. Ve a **Authentication** > **Users**
2. Haz clic en **Add User** > **Create New User**
3. Ingresa email y contrasena
4. Para hacer a un usuario administrador, ve a **Table Editor** > tabla `profiles` y cambia el campo `role` a `admin`

### Paso 6: Desplegar las Edge Functions

Si usas Supabase CLI para desarrollo local:

```bash
cd ..
supabase functions deploy validate-master
supabase functions deploy process-cea
```

### Paso 7: Iniciar la aplicacion

```bash
cd frontend
npm run dev
```

La aplicacion estara disponible en: **http://localhost:5173**

---

## 4. Guia de Uso

### 4.1 Iniciar sesion

1. Abre el navegador y ve a `http://localhost:5173` (o la URL donde este desplegado el sistema).
2. Ingresa tu **correo electronico** y **contrasena**.
3. Haz clic en **Iniciar sesion**.
4. Seras redirigido automaticamente:
   - Si eres **administrador** → Panel de administracion (`/admin`)
   - Si eres **usuario regular** → Panel de usuario (`/dashboard`)

### 4.2 Flujo del administrador: Subir archivos Master

Este es el flujo principal del sistema. Como administrador:

**Paso 1 - Subir los 4 archivos Master:**

1. En el panel de administracion, ve a la seccion de **Subir Masters**.
2. Veras cuatro zonas de carga, una para cada tipo de archivo:
   - Master de Alumnos
   - Master de Servicios
   - Master de Figuras Educativas
   - Master de Telefonia
3. Arrastra cada archivo a su zona correspondiente, o haz clic para seleccionarlo desde tu computadora.
4. Los archivos deben estar en formato **Excel (.xlsx o .xls)** y no exceder **50 MB** cada uno.

**Paso 2 - Validar los archivos:**

5. Una vez subidos, el sistema valida automaticamente la estructura de cada archivo.
6. Puedes ver el estado de validacion en el **Historial de Masters**:
   - **Subido** (gris): archivo recibido, pendiente de validacion.
   - **Validando** (amarillo): validacion en progreso.
   - **Validado** (verde): estructura correcta, listo para procesar.
   - **Error** (rojo): problemas encontrados. Revisa los detalles del error para corregir el archivo.

**Paso 3 - Generar el archivo CEA:**

7. Una vez que los 4 archivos del mismo lote esten en estado **Validado**, haz clic en **Procesar CEA**.
8. El sistema cruzara los datos de los 4 Masters y generara el archivo CEA consolidado.
9. Puedes seguir el progreso en el **Historial de CEA**.
10. Cuando termine, el archivo estara disponible para descarga.

### 4.3 Flujo del usuario regular: Descargar el CEA

1. Inicia sesion con tu cuenta de usuario.
2. En tu panel veras la informacion del **archivo CEA mas reciente**:
   - Nombre del archivo
   - Fecha de generacion
   - Tamano del archivo
   - Cantidad de registros
3. Haz clic en **Descargar** para obtener el archivo Excel.
4. El enlace de descarga es valido por **15 minutos**. Si expira, recarga la pagina para obtener uno nuevo.

### 4.4 Cerrar sesion

Haz clic en el boton de **Cerrar sesion** en la esquina superior del panel. La sesion tambien se cierra automaticamente despues de **1 hora de inactividad** (recibiras una advertencia 10 minutos antes).

---

## 5. Descripcion de Funcionalidades

### 5.1 Autenticacion y seguridad

El sistema cuenta con un mecanismo completo de autenticacion:

- **Inicio de sesion seguro**: las contrasenas se manejan a traves de Supabase Auth, nunca se almacenan directamente en la base de datos de la aplicacion.
- **Roles de usuario**: cada usuario tiene un rol (`admin` o `user`) que determina que puede hacer en el sistema.
- **Rutas protegidas**: si intentas acceder a una pagina sin los permisos correctos, seras redirigido al login.
- **Timeout de sesion**: despues de 50 minutos sin actividad aparece una advertencia. A los 60 minutos la sesion se cierra automaticamente.
- **Politicas de seguridad (RLS)**: la base de datos tiene reglas que aseguran que cada usuario solo pueda ver y modificar los datos que le corresponden.

### 5.2 Subida de archivos Master

- **Cuatro zonas de carga**: una para cada tipo de archivo Master (Alumnos, Servicios, Figuras, Telefonia).
- **Arrastrar y soltar**: puedes arrastrar los archivos directamente a la zona correspondiente.
- **Validacion de formato**: solo se aceptan archivos `.xlsx` y `.xls` de hasta 50 MB.
- **Agrupacion por lotes**: los 4 archivos subidos juntos se agrupan automaticamente en un lote (batch) para su procesamiento.
- **Historial completo**: puedes ver todos los archivos subidos previamente con su estado actual.

### 5.3 Validacion de archivos

Cuando se sube un archivo Master, el sistema verifica automaticamente:

- Que el archivo tenga las **hojas correctas** (nombres de las pestanas del Excel).
- Que contenga las **columnas requeridas** para su tipo.
- Que los **formatos de datos** sean correctos (numeros, textos, fechas).
- Que no haya **datos faltantes** en campos obligatorios.

Si se encuentran errores, el sistema muestra un detalle especifico de que fallo y en donde, para que puedas corregir el archivo y volver a subirlo.

### 5.4 Generacion del archivo CEA

Este es el corazon del sistema. El proceso de generacion:

1. **Descarga los 4 archivos Master** del lote seleccionado.
2. **Procesa el Master de Alumnos**: extrae datos de estudiantes por microrregion, genero y programa educativo.
3. **Procesa el Master de Servicios**: extrae datos de servicios educativos y los clasifica por modalidad (Inicial, Preescolar, Primaria, Secundaria, etc.).
4. **Procesa el Master de Figuras**: extrae informacion de educadores y coordinadores por microrregion.
5. **Genera el concentrado**: cruza todos los datos, los agrupa por microrregion y nivel educativo, y calcula totales.
6. **Crea el archivo Excel**: genera un archivo Excel formateado con todas las hojas necesarias.
7. **Lo almacena** para su descarga posterior.

### 5.5 Descarga de archivos CEA

- Los **administradores** pueden descargar cualquier version del CEA desde el historial.
- Los **usuarios regulares** solo pueden descargar la **version mas reciente**.
- Las URLs de descarga son **firmadas y temporales** (15 minutos), lo que garantiza la seguridad.

### 5.6 Actualizaciones en tiempo real

El sistema usa conexiones en tiempo real (WebSockets) para actualizar la interfaz sin necesidad de recargar la pagina. Esto significa que:

- Cuando un archivo termina de validarse, el estado cambia automaticamente en pantalla.
- Cuando un CEA termina de generarse, aparece inmediatamente en el historial.
- Multiples administradores pueden trabajar simultaneamente y ver los cambios de los demas.

---

## 6. Configuracion

### 6.1 Variables de entorno

Todas las opciones configurables se encuentran en el archivo `frontend/.env.local`. A continuacion se describe cada variable:

| Variable | Valor por defecto | Descripcion |
|----------|------------------|-------------|
| `VITE_SUPABASE_URL` | *(obligatorio)* | URL de tu proyecto de Supabase |
| `VITE_SUPABASE_ANON_KEY` | *(obligatorio)* | Clave publica (anon key) de tu proyecto de Supabase |
| `VITE_APP_NAME` | `Sistema CEA CONAFE` | Nombre de la aplicacion que se muestra en la interfaz |
| `VITE_MAX_FILE_SIZE_MB` | `50` | Tamano maximo permitido por archivo (en megabytes) |
| `VITE_ALLOWED_FILE_TYPES` | `.xlsx,.xls` | Extensiones de archivo permitidas para la subida |
| `VITE_MASTER_FILES_BUCKET` | `master-files` | Nombre del bucket de almacenamiento para archivos Master |
| `VITE_CEA_FILES_BUCKET` | `cea-files` | Nombre del bucket de almacenamiento para archivos CEA |
| `VITE_SIGNED_URL_EXPIRY_SECONDS` | `900` | Tiempo de vida de los enlaces de descarga (en segundos, 900 = 15 minutos) |
| `VITE_ENABLE_REALTIME` | `true` | Habilitar o deshabilitar las actualizaciones en tiempo real |

### 6.2 Configuracion de Supabase

La configuracion del backend de Supabase se encuentra en `supabase/config.toml`. Los valores principales son:

- **Puerto de la API**: 54321
- **Puerto de la base de datos**: 54322
- **Puerto del panel de administracion (Studio)**: 54323
- **Tamano maximo de archivos**: 50 MB
- **Duracion del token JWT**: 3600 segundos (1 hora)

### 6.3 Estructura de almacenamiento

El sistema utiliza dos **buckets** (contenedores) de almacenamiento:

| Bucket | Contenido | Tamano maximo | Acceso |
|--------|-----------|--------------|--------|
| `master-files` | Archivos Master subidos por administradores | 50 MB | Solo administradores |
| `cea-files` | Archivos CEA generados por el sistema | 100 MB | Administradores (todos) y usuarios (solo el mas reciente) |

---

## 7. Errores Comunes y Soluciones

### "Error al conectar con Supabase" o pantalla en blanco

**Causa**: Las variables de entorno no estan configuradas correctamente.

**Solucion**:
1. Verifica que exista el archivo `frontend/.env.local`
2. Asegurate de que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` tengan los valores correctos
3. Reinicia el servidor de desarrollo (`Ctrl+C` y luego `npm run dev`)

---

### "El archivo no se puede subir" o "Tipo de archivo no permitido"

**Causa**: El archivo no es un Excel valido o supera el tamano maximo.

**Solucion**:
1. Verifica que el archivo tenga extension `.xlsx` o `.xls`
2. Asegurate de que el archivo no pese mas de 50 MB
3. Si el archivo es `.csv`, conviertelo primero a `.xlsx` usando Excel o Google Sheets

---

### "Error de validacion" al subir un Master

**Causa**: El archivo Excel no tiene la estructura esperada.

**Solucion**:
1. Revisa el mensaje de error especifico que muestra el sistema
2. Verifica que las **hojas del archivo** tengan los nombres correctos
3. Verifica que las **columnas** necesarias esten presentes y bien escritas
4. Asegurate de que no haya filas vacias intercaladas en los datos

---

### "No puedo generar el CEA"

**Causa**: No todos los archivos Master del lote estan validados.

**Solucion**:
1. Ve al **Historial de Masters** y verifica que los 4 archivos del lote esten en estado **Validado** (verde)
2. Si alguno tiene error, corrigelo y vuelve a subirlo
3. Los 4 tipos deben estar presentes: Alumnos, Servicios, Figuras y Telefonia

---

### "La sesion ha expirado"

**Causa**: Han pasado mas de 60 minutos sin actividad.

**Solucion**:
1. Vuelve a iniciar sesion con tu correo y contrasena
2. Si ves la advertencia de "sesion por expirar", haz clic en **Extender sesion** para renovarla

---

### "No puedo descargar el archivo CEA"

**Causa**: El enlace de descarga expiro (duran 15 minutos).

**Solucion**:
1. Recarga la pagina del navegador
2. Haz clic nuevamente en el boton de **Descargar**
3. Se generara un nuevo enlace valido por 15 minutos mas

---

### "npm install falla con errores"

**Causa**: Version de Node.js incompatible o problemas de red.

**Solucion**:
1. Verifica que tengas Node.js 18 o superior: `node --version`
2. Elimina la carpeta de modulos e intentalo de nuevo:
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```
3. Si persiste, verifica tu conexion a internet

---

### "La pagina no carga despues de npm run dev"

**Causa**: El puerto 5173 esta ocupado o el servidor no inicio correctamente.

**Solucion**:
1. Verifica que no haya otro proceso en el puerto 5173
2. Revisa la terminal en busca de errores
3. Intenta con: `npm run dev -- --port 3000` para usar otro puerto

---

## 8. Preguntas Frecuentes (FAQ)

### Necesito instalar algo especial para usar el sistema?

Si eres **usuario final** (solo descargas el CEA), solo necesitas un **navegador web actualizado**. No necesitas instalar nada mas.

Si eres **desarrollador** o vas a instalar el sistema, necesitas Node.js, npm y Git (ver seccion de Requisitos Previos).

---

### Puedo usar el sistema desde mi celular?

Si. La interfaz esta disenada de forma **responsive**, lo que significa que se adapta a pantallas de diferentes tamanos. Puedes acceder desde cualquier dispositivo con un navegador web.

---

### Que pasa si subo un archivo Master equivocado?

El sistema **valida la estructura** del archivo antes de procesarlo. Si el archivo no tiene el formato esperado, se marcara con estado de **error** y podras ver los detalles del problema. Simplemente corrige el archivo y vuelve a subirlo.

---

### Puedo generar un CEA con solo 2 o 3 archivos Master?

No. El sistema requiere **exactamente 4 archivos Master** (Alumnos, Servicios, Figuras y Telefonia) para generar un CEA completo. Los cuatro deben estar validados antes de iniciar el procesamiento.

---

### Donde se guardan mis archivos?

Los archivos se almacenan de forma segura en **Supabase Storage**, un servicio de almacenamiento en la nube. Los archivos Master se guardan en un contenedor privado al que solo tienen acceso los administradores. Los archivos CEA generados estan disponibles para descarga segun el rol del usuario.

---

### Cuanto tiempo tardan en procesarse los archivos?

El tiempo de procesamiento depende del tamano de los archivos Master. En general:

- **Validacion de un Master**: unos pocos segundos.
- **Generacion de un CEA**: entre 30 segundos y 5 minutos, dependiendo del volumen de datos.

---

### El sistema puede procesar archivos CSV?

No directamente. El sistema solo acepta archivos en formato **Excel (.xlsx o .xls)**. Si tienes datos en CSV, conviertelos primero a Excel usando cualquier programa de hojas de calculo (Microsoft Excel, LibreOffice Calc o Google Sheets).

---

### Como se que version del CEA estoy descargando?

En el panel de usuario se muestra la informacion del archivo CEA mas reciente, incluyendo su **fecha de generacion** y **numero de version**. Si eres administrador, puedes ver el historial completo de todas las versiones generadas.

---

### Que navegadores son compatibles?

El sistema funciona en las versiones actualizadas de:

- Google Chrome
- Mozilla Firefox
- Microsoft Edge
- Safari (macOS / iOS)

Se recomienda usar **Google Chrome** para la mejor experiencia.

---

### Puedo usar el sistema sin conexion a internet?

No. El sistema requiere conexion a internet para comunicarse con el servidor de Supabase, donde se almacenan la base de datos y los archivos.

---

### Como contacto al soporte si tengo un problema?

Si encuentras un problema o tienes una pregunta que no esta cubierta en esta documentacion, puedes:

1. Reportar un problema en el repositorio del proyecto en GitHub.
2. Contactar al administrador del sistema dentro de tu organizacion.

---

## Tecnologias Utilizadas

Para referencia, el sistema esta construido con las siguientes tecnologias:

| Componente | Tecnologia |
|-----------|------------|
| Interfaz de usuario | React 19, TypeScript, Tailwind CSS |
| Componentes visuales | shadcn/ui, Lucide Icons |
| Gestion de estado | Zustand |
| Backend y base de datos | Supabase (PostgreSQL) |
| Autenticacion | Supabase Auth |
| Almacenamiento de archivos | Supabase Storage |
| Procesamiento de Excel | SheetJS (xlsx) |
| Funciones de servidor | Supabase Edge Functions (Deno) |
| Empaquetado | Vite |

---

*Documentacion generada para el Sistema CEA CONAFE. Para contribuir al proyecto o reportar problemas, visita el repositorio en GitHub.*
