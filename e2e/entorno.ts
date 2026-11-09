// Entorno de las pruebas de navegador: base, API y web propias, sin Docker.
// Base vecinopay_e2e en el PostgreSQL local, API en 13000 y web en 18080. Nunca toca la base `vecinopay` de desarrollo.
import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import path from 'node:path';

export const RAIZ = path.resolve(__dirname, '..');
export const ESTADO = path.join(RAIZ, 'e2e', '.estado');

const valor = (nombre: string, defecto: number) => Number(process.env[nombre] ?? defecto);
export const API_PORT = valor('E2E_API_PORT', 13000);
export const WEB_PORT = valor('E2E_WEB_PORT', 18080);
export const BD_E2E = process.env.E2E_DB_NAME ?? 'vecinopay_e2e';

// La base y los puertos del desarrollo no se pueden usar aquí: la suite borra y recrea su base.
for (const p of [API_PORT, WEB_PORT]) {
  if ([3000, 5173, 8080].includes(p)) {
    throw new Error(`El puerto ${p} es el del desarrollo: elige otro en E2E_*_PORT.`);
  }
}
if (!/^vecinopay_(test|e2e)(_[a-z0-9]+)?$/.test(BD_E2E)) {
  throw new Error(
    `E2E_DB_NAME debe ser una base desechable (vecinopay_e2e...). Recibido: ${BD_E2E}`,
  );
}

export const RELOJ_INICIAL = '2026-09-22T12:00:00-05:00';
const JWT_E2E = 'secreto-solo-para-pruebas-de-navegador-0123456789';

/** Ejecuta scripts/db.mjs (la base se gestiona fuera de Playwright, que no carga módulos ESM de Node). */
export function bd(orden: string, nombre = BD_E2E): string {
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'db.mjs'), orden, nombre], {
    cwd: RAIZ,
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`db.mjs ${orden} falló: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout.trim();
}

const archivoPid = (nombre: string) => path.join(ESTADO, `${nombre}.pid`);

function lanzar(
  nombre: 'api' | 'web',
  comando: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): void {
  mkdirSync(ESTADO, { recursive: true });
  const salida = openSync(path.join(ESTADO, `${nombre}.log`), 'a');
  const hijo = spawn(comando, args, {
    cwd,
    env: { ...process.env, TZ: 'America/Lima', ...env },
    detached: true,
    stdio: ['ignore', salida, salida],
    windowsHide: true,
  });
  hijo.unref();
  closeSync(salida);
  writeFileSync(archivoPid(nombre), String(hijo.pid));
}

/** Detiene un proceso lanzado por esta suite (y sus hijos) si su PID sigue guardado. */
export function detener(nombre: 'api' | 'web'): void {
  const archivo = archivoPid(nombre);
  if (!existsSync(archivo)) return;
  const pid = Number(readFileSync(archivo, 'utf8'));
  if (pid) {
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else {
      try {
        process.kill(-pid);
      } catch {
        // ya terminó
      }
    }
  }
  rmSync(archivo, { force: true });
}

export function limpiarEstado(): void {
  rmSync(ESTADO, { recursive: true, force: true });
}

/** Lanza la API de pruebas con su propia base y el reloj indicado. */
export function lanzarApi(reloj: string): void {
  lanzar('api', process.execPath, [path.join(RAIZ, 'apps', 'api', 'dist', 'main.js')], RAIZ, {
    PORT: String(API_PORT),
    DATABASE_URL: bd('url-app'),
    JWT_SECRET: JWT_E2E,
    NODE_ENV: 'development',
    RELOJ_FIJO: reloj,
    CORS_ORIGENES: `http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT}`,
  });
}

/** Sirve el dist de la web con proxy hacia la API de pruebas. */
export function lanzarWeb(): void {
  lanzar(
    'web',
    process.execPath,
    [path.join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview'],
    path.join(RAIZ, 'apps', 'web'),
    {
      WEB_PORT: String(WEB_PORT),
      API_URL: `http://127.0.0.1:${API_PORT}`,
    },
  );
}

/** True si algo ya escucha en el puerto. */
export function puertoOcupado(puerto: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect({ port: puerto, host: '127.0.0.1' });
    s.once('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.once('error', () => resolve(false));
  });
}

/** Espera a que la API responda (Swagger es público). */
export async function esperarApi(maxSegundos = 90): Promise<void> {
  const limite = Date.now() + maxSegundos * 1000;
  let ultimo = 'sin respuesta';
  while (Date.now() < limite) {
    try {
      const r = await fetch(`http://127.0.0.1:${API_PORT}/api/docs`);
      if (r.ok) return;
      ultimo = `HTTP ${r.status}`;
    } catch (e) {
      ultimo = e instanceof Error ? e.message : String(e);
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(
    `La API de pruebas no respondió en ${maxSegundos} s (${ultimo}). Mira e2e/.estado/api.log.`,
  );
}

/** Espera a que la web responda y llegue a la API por el proxy. */
export async function esperarWeb(maxSegundos = 60): Promise<void> {
  const limite = Date.now() + maxSegundos * 1000;
  while (Date.now() < limite) {
    try {
      const r = await fetch(`http://127.0.0.1:${WEB_PORT}/api/docs`);
      if (r.ok) return;
    } catch {
      // aún levantando
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`La web de pruebas no respondió en ${maxSegundos} s. Mira e2e/.estado/web.log.`);
}

/**
 * Cambia el reloj de la demo: reinicia solo la API con otra RELOJ_FIJO. Se llama desde un worker,
 * que no comparte memoria con global-setup: por eso el PID está en un archivo. La web no se reinicia
 * (vite preview resuelve el destino del proxy en cada petición).
 */
export async function fijarReloj(isoLima: string): Promise<void> {
  detener('api');
  lanzarApi(isoLima);
  await esperarApi();
}
