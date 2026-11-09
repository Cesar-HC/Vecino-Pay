// Utilidades de PostgreSQL local para los scripts de VecinoPay (sin dependencias).
// Ejecuta `psql` sin shell; las contraseñas viajan solo en el entorno del proceso hijo.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Lee `.env` de la raíz sin pisar variables ya definidas (mismo criterio que apps/api cargar-env). */
export function cargarEnv(archivo = join(RAIZ, '.env')) {
  if (!existsSync(archivo)) return;
  for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(linea);
    if (!m || linea.trimStart().startsWith('#')) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}
cargarEnv();

export const cfg = () => ({
  host: process.env.PGHOST || '127.0.0.1',
  puerto: process.env.PGPORT || '5432',
  bd: process.env.DB_NAME || 'vecinopay',
  dueno: process.env.DB_OWNER_USER || 'vecinopay_owner',
  claveDueno: process.env.DB_OWNER_PASSWORD || '',
  app: process.env.APP_DB_USER || 'vecinopay_app',
  claveApp: process.env.APP_DB_PASSWORD || '',
});

export function ubicarPsql() {
  const candidatos = [
    process.env.PSQL_BIN,
    'psql',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
  ].filter(Boolean);
  for (const c of candidatos) {
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return c;
  }
  throw new Error(
    'No se encontró psql. Define PSQL_BIN en .env (por ejemplo C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe).',
  );
}

/**
 * Ejecuta psql. `archivo` o `sql`; `vars` son variables de psql (-v nombre=valor).
 * `clave === undefined` deja que psql pregunte en la terminal (stdio heredado).
 */
export function psql({
  db = 'postgres',
  usuario,
  clave,
  archivo,
  sql,
  vars = {},
  silencioso = false,
  interactivo = false,
  avisos = false,
}) {
  const c = cfg();
  const args = [
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-h',
    c.host,
    '-p',
    c.puerto,
    '-U',
    usuario,
    '-d',
    db,
    '-q',
  ];
  if (silencioso) args.push('-t', '-A');
  for (const [k, v] of Object.entries(vars)) args.push('-v', `${k}=${v}`);
  if (archivo) args.push('-f', archivo);
  if (sql) args.push('-c', sql);
  const env = { ...process.env, PGCLIENTENCODING: 'UTF8' };
  if (clave !== undefined) env.PGPASSWORD = clave;
  const r = spawnSync(ubicarPsql(), args, {
    env,
    encoding: 'utf8',
    stdio: interactivo ? 'inherit' : 'pipe',
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`psql falló (${archivo ?? sql}):\n${(r.stderr || '').trim()}`);
  }
  return ((r.stdout || '') + (avisos ? r.stderr || '' : '')).trim();
}

const NOMBRE_BD_DESECHABLE = /^vecinopay_(test|e2e)(_[a-z0-9]+)?$/;
const PROHIBIDAS = new Set(['postgres', 'template0', 'template1']);

const comoDueno = () => ({ usuario: cfg().dueno, clave: cfg().claveDueno });

export const existeBd = (nombre) =>
  psql({
    ...comoDueno(),
    sql: `SELECT 1 FROM pg_database WHERE datname = '${nombre.replace(/'/g, "''")}'`,
    silencioso: true,
  }) === '1';

export function crearBd(nombre) {
  if (PROHIBIDAS.has(nombre)) throw new Error(`Nombre de base no permitido: ${nombre}`);
  psql({
    ...comoDueno(),
    archivo: join(RAIZ, 'db', 'crear_bd.sql'),
    vars: { db_name: nombre, app_user: cfg().app },
  });
}

/** Solo borra bases desechables de pruebas (vecinopay_test, vecinopay_e2e...). */
export function borrarBdDesechable(nombre) {
  if (!NOMBRE_BD_DESECHABLE.test(nombre) || PROHIBIDAS.has(nombre)) {
    throw new Error(
      `Solo se pueden borrar bases desechables (vecinopay_test o vecinopay_e2e). Recibido: ${nombre}`,
    );
  }
  psql({ ...comoDueno(), sql: `DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)` });
}

/** Borra la base de desarrollo: solo desde `db:recrear -- --confirmar`. */
export function borrarBdDesarrollo(nombre) {
  if (PROHIBIDAS.has(nombre) || !/^[a-z0-9_]+$/.test(nombre))
    throw new Error(`Nombre de base no permitido: ${nombre}`);
  psql({ ...comoDueno(), sql: `DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)` });
}

export function inicializar(nombre) {
  const c = cfg();
  for (const f of ['01_esquema.sql', '02_semillas.sql']) {
    psql({ ...comoDueno(), db: nombre, archivo: join(RAIZ, 'db', 'init', f) });
  }
  psql({
    ...comoDueno(),
    db: nombre,
    archivo: join(RAIZ, 'db', 'init', '03_usuario_app.sql'),
    vars: { app_user: c.app },
  });
}

export function verificar(nombre) {
  return psql({
    ...comoDueno(),
    db: nombre,
    archivo: join(RAIZ, 'db', 'verificar_semillas.sql'),
    avisos: true,
  });
}

const cod = (s) => encodeURIComponent(s);
export const urlApp = (nombre) => {
  const c = cfg();
  return `postgresql://${cod(c.app)}:${cod(c.claveApp)}@${c.host}:${c.puerto}/${nombre}?schema=public`;
};
export const urlDueno = (nombre) => {
  const c = cfg();
  return `postgresql://${cod(c.dueno)}:${cod(c.claveDueno)}@${c.host}:${c.puerto}/${nombre}?schema=public`;
};
