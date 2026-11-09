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

/** Cambia el reloj de la demo: reinicia solo la API con otra RELOJ_FIJO. */
export async function fijarReloj(isoLima: string): Promise<void> {
  compose(['up', '-d', 'api'], { RELOJ_FIJO: isoLima });
  await esperarApi();
}
