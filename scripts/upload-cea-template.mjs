#!/usr/bin/env node
/**
 * upload-cea-template.mjs
 * ========================
 * Sube `archivos excel utiles/CEA 25-26 VACIO.xlsx` al bucket `cea-templates`
 * con el path canónico `CEA_25-26_VACIO.xlsx`. Es el template que la edge
 * function `process-cea` descarga y rellena con datos de la BD.
 *
 * Uso:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/upload-cea-template.mjs
 *   # o sobreescribiendo el archivo:
 *   node scripts/upload-cea-template.mjs --file "ruta/al/CEA.xlsx"
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const envPath = join(projectRoot, 'frontend', '.env');

function parseEnv(p) {
  if (!existsSync(p)) throw new Error(`No se encontró ${p}`);
  const out = {};
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}
function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const x = argv[i];
    if (x.startsWith('--')) { const [k, v] = x.slice(2).split('='); a[k] = v ?? argv[++i]; }
  }
  return a;
}
const log = (...a) => console.log('[tpl]', ...a);
const ok  = (...a) => console.log('\x1b[32m[ok]\x1b[0m', ...a);
const err = (...a) => console.error('\x1b[31m[err]\x1b[0m', ...a);

const args = parseArgs(process.argv);
const env  = parseEnv(envPath);
const URL  = env.VITE_SUPABASE_URL      ?? process.env.VITE_SUPABASE_URL;
const KEY  = env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const EMAIL = args.email    ?? process.env.ADMIN_EMAIL;
const PASS  = args.password ?? process.env.ADMIN_PASSWORD;
const FILE  = args.file ?? join(projectRoot, 'archivos excel utiles', 'CEA 25-26 VACIO.xlsx');
const BUCKET = 'cea-templates';
const TARGET_PATH = 'CEA_25-26_VACIO.xlsx';

if (!URL || !KEY) { err('Faltan VITE_SUPABASE_URL/ANON_KEY'); process.exit(1); }
if (!EMAIL || !PASS) { err('Faltan ADMIN_EMAIL/ADMIN_PASSWORD'); process.exit(1); }
if (!existsSync(FILE)) { err(`No existe ${FILE}`); process.exit(1); }

const supabase = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
log(`Login ${EMAIL}…`);
const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASS });
if (loginErr || !auth?.session) { err(`Login: ${loginErr?.message}`); process.exit(1); }
ok('Sesión abierta');

const buf = readFileSync(FILE);
log(`Subiendo ${FILE} (${buf.length} bytes) → ${BUCKET}/${TARGET_PATH}`);
const { error: upErr } = await supabase.storage
  .from(BUCKET)
  .upload(TARGET_PATH, buf, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    upsert: true,  // permite re-subir versiones del template
  });
if (upErr) { err(`upload: ${upErr.message}`); process.exit(1); }
ok(`Template subido a ${BUCKET}/${TARGET_PATH}`);
