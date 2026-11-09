// Entorno de las pruebas de navegador: un proyecto Docker propio, con volumen y puertos propios.
// Nunca toca el proyecto `vecinopay` del desarrollo (docs/diseno/fase-6.md, sección 2).
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const PROYECTO = 'vecinopay-e2e';
export const RAIZ = path.resolve(__dirname, '..');

const puerto = (nombre: string, defecto: number) => Number(process.env[nombre] ?? defecto);
export const DB_PORT = puerto('E2E_DB_PORT', 11433);
export const API_PORT = puerto('E2E_API_PORT', 13000);
export const WEB_PORT = puerto('E2E_WEB_PORT', 18080);

// Los puertos del desarrollo (SQL Server, API y web) no se pueden usar aquí: la suite borra su volumen.
for (const p of [DB_PORT, API_PORT, WEB_PORT]) {
  if ([1433, 3000, 8080].includes(p)) {
    throw new Error(`El puerto ${p} es el del proyecto de desarrollo: elige otro en E2E_*_PORT.`);
  }
}

export const RELOJ_INICIAL = '2026-09-22T12:00:00-05:00';

/** Ejecuta `docker compose -p vecinopay-e2e ...` con los puertos de este entorno. */
export function compose(args: string[], env: Record<string, string> = {}): void {
  execFileSync('docker', ['compose', '-p', PROYECTO, ...args], {
    cwd: RAIZ,
    stdio: 'inherit',
    env: {
      ...process.env,
      DB_PORT: String(DB_PORT),
      API_PORT: String(API_PORT),
      WEB_PORT: String(WEB_PORT),
      RELOJ_FIJO: RELOJ_INICIAL,
      ...env,
    },
  });
}

/** Espera a que la API responda (Swagger es público). */
export async function esperarApi(maxSegundos = 90): Promise<void> {
  const limite = Date.now() + maxSegundos * 1000;
  let ultimo = 'sin respuesta';
  while (Date.now() < limite) {
    try {
      const r = await fetch(`http://localhost:${API_PORT}/api/docs`);
      if (r.ok) return;
      ultimo = `HTTP ${r.status}`;
    } catch (e) {
      ultimo = e instanceof Error ? e.message : String(e);
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error(`La API de pruebas no respondió en ${maxSegundos} s (${ultimo}).`);
}

/** Espera a que la web responda y llegue a la API por nginx. */
export async function esperarWeb(maxSegundos = 60): Promise<void> {
  const limite = Date.now() + maxSegundos * 1000;
  while (Date.now() < limite) {
    try {
      const r = await fetch(`http://localhost:${WEB_PORT}/api/docs`);
      if (r.ok) return;
    } catch {
      // aún levantando
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`La web de pruebas no respondió en ${maxSegundos} s.`);
}

/** Cambia el reloj de la demo: recrea solo la API con otra RELOJ_FIJO. */
export async function fijarReloj(isoLima: string): Promise<void> {
  compose(['up', '-d', 'api'], { RELOJ_FIJO: isoLima });
  await esperarApi();
  // nginx resuelve el nombre `api` una sola vez: si la API cambió de IP, se reinicia la web.
  compose(['restart', 'web']);
  await esperarWeb();
}
