#!/usr/bin/env node
/**
 * test-ingest-master.mjs
 * =======================
 * Sube los 3 xlsx de `archivos excel utiles/` al Storage del proyecto,
 * crea las filas correspondientes en master_uploads y llama a la Edge
 * Function ingest-master para cada uno. Imprime los ingest_stats.
 *
 * Uso:
 *   # con variables de entorno (recomendado):
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/test-ingest-master.mjs
 *
 *   # o con flags:
 *   node scripts/test-ingest-master.mjs --email admin@foo.com --password xxx
 *
 * Requisitos:
 *   - frontend/.env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
 *   - Usuario admin existente en el proyecto (role='admin' en public.profiles).
 *   - Las 4 migraciones de Fase 1 ya ejecutadas en Supabase.
 *   - La Edge Function ingest-master ya desplegada.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const envPath = join(projectRoot, 'frontend', '.env');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseEnv(path) {
  if (!existsSync(path)) {
    throw new Error(`No se encontró ${path}. Crea frontend/.env basado en .env.example`);
  }
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      args[k] = v ?? argv[++i];
    }
  }
  return args;
}

function log(...a) { console.log('[test]', ...a); }
function ok(...a)  { console.log('\x1b[32m[ok]\x1b[0m', ...a); }
function err(...a) { console.error('\x1b[31m[err]\x1b[0m', ...a); }

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const args = parseArgs(process.argv);
const env  = parseEnv(envPath);

const SUPABASE_URL      = env.VITE_SUPABASE_URL      ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL    = args.email    ?? process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = args.password ?? process.env.ADMIN_PASSWORD;
const CICLO_ESCOLAR  = args.ciclo    ?? process.env.CICLO_ESCOLAR ?? '2024-2025';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  err('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en frontend/.env');
  process.exit(1);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  err('Faltan credenciales de admin. Usa --email y --password, o define ADMIN_EMAIL/ADMIN_PASSWORD.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Masters a probar
// ---------------------------------------------------------------------------
const MASTERS_DIR = join(projectRoot, 'archivos excel utiles');
const MASTERS = [
  {
    type: 'servicios',
    file: join(MASTERS_DIR, 'Master de Servicios-1registro.xlsx'),
  },
  {
    type: 'figuras',
    file: join(MASTERS_DIR, 'Master_Figuras_22_10_2025_EJEMPLO-1registro.xlsx'),
  },
  {
    type: 'alumnos',
    file: join(MASTERS_DIR, 'Master_alumnos_19_11_2025_EJEMPLO-1registro.xlsx'),
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

log(`Iniciando sesión como ${ADMIN_EMAIL} …`);
const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
if (loginErr || !auth?.session) {
  err('Login falló:', loginErr?.message ?? 'sin sesión');
  process.exit(1);
}
const userId = auth.user.id;
const accessToken = auth.session.access_token;
ok(`Sesión abierta (userId=${userId})`);

// Verificar que el usuario es admin
const { data: profile, error: profileErr } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', userId)
  .single();
if (profileErr || profile?.role !== 'admin') {
  err(`El usuario no es admin (role=${profile?.role ?? 'N/A'}). Asigna role='admin' en public.profiles y reintenta.`);
  process.exit(1);
}
ok('Rol admin confirmado');

const batchId = crypto.randomUUID();
log(`upload_batch_id=${batchId}`);

// ---------------------------------------------------------------------------
// Subir archivos y crear filas master_uploads
// ---------------------------------------------------------------------------
const uploaded = [];
for (const m of MASTERS) {
  if (!existsSync(m.file)) {
    err(`No existe ${m.file}`);
    process.exit(1);
  }
  const buf = readFileSync(m.file);
  const baseName = m.file.split(/[\\/]/).pop();
  const storagePath = `${batchId}/${crypto.randomUUID()}_${baseName}`;

  log(`→ Subiendo ${m.type}: ${baseName} (${buf.length} bytes)`);
  const { error: upErr } = await supabase.storage
    .from('master-files')
    .upload(storagePath, buf, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    });
  if (upErr) {
    err(`Storage.upload falló para ${m.type}:`, upErr.message);
    process.exit(1);
  }

  const { data: inserted, error: insErr } = await supabase
    .from('master_uploads')
    .insert({
      uploaded_by: userId,
      file_name: baseName,
      file_path: storagePath,
      file_size: buf.length,
      file_type: m.type,
      status: 'uploaded',
      upload_batch_id: batchId,
    })
    .select()
    .single();
  if (insErr) {
    err(`Insert master_uploads falló:`, insErr.message);
    process.exit(1);
  }
  ok(`${m.type} registrado: masterId=${inserted.id}`);
  uploaded.push({ ...m, masterId: inserted.id });
}

// ---------------------------------------------------------------------------
// Llamar ingest-master por cada archivo
// ---------------------------------------------------------------------------
const fnUrl = `${SUPABASE_URL}/functions/v1/ingest-master`;

for (const m of uploaded) {
  log(`\n=== Ingiriendo ${m.type} (masterId=${m.masterId}) ===`);
  const t0 = Date.now();
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ masterId: m.masterId, cicloEscolar: CICLO_ESCOLAR }),
  });
  const body = await res.json().catch(() => null);
  const ms = Date.now() - t0;
  if (!res.ok || !body?.success) {
    err(`ingest-master falló (${res.status}) en ${ms}ms:`, JSON.stringify(body, null, 2));
    continue;
  }
  ok(`${m.type} ingerido en ${ms}ms:`);
  console.log(JSON.stringify(body.data, null, 2));
}

ok('\nTest completado.');
