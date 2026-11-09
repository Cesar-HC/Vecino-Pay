import { spawnSync } from 'node:child_process';
import {
  API_PORT,
  bd,
  detener,
  esperarApi,
  esperarWeb,
  lanzarApi,
  lanzarWeb,
  limpiarEstado,
  puertoOcupado,
  RAIZ,
  RELOJ_INICIAL,
  WEB_PORT,
} from './entorno';

/**
 * Base vecinopay_e2e recién sembrada, API y web propias y reloj en 22/09/2026 12:00.
 * `E2E_REUSAR=1` conserva el entorno ya levantado (para depurar un spec); el estado no se reinicia.
 * `E2E_SIN_BUILD=1` omite la compilación.
 */
export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_REUSAR !== '1') {
    // Restos de una corrida anterior que no cerró bien.
    detener('api');
    detener('web');
    for (const puerto of [API_PORT, WEB_PORT]) {
      if (await puertoOcupado(puerto)) {
        throw new Error(
          `El puerto ${puerto} está ocupado: cierra lo que lo usa o elige otro en E2E_*_PORT.`,
        );
      }
    }
    limpiarEstado();

    if (process.env.E2E_SIN_BUILD !== '1') {
      const r = spawnSync('npm', ['run', 'build'], {
        cwd: RAIZ,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });
      if (r.status !== 0) throw new Error('Falló la compilación (npm run build).');
    }

    try {
      bd('desechable');
      lanzarApi(RELOJ_INICIAL);
      lanzarWeb();
      await esperarApi();
      await esperarWeb();
    } catch (e) {
      // Playwright no ejecuta el teardown si el setup falla: se deja todo limpio antes de avisar.
      detener('api');
      detener('web');
      try {
        bd('borrar-desechable');
      } catch {
        // la base puede no haberse creado
      }
      throw e;
    }
    return;
  }
  await esperarApi();
  await esperarWeb();
}
