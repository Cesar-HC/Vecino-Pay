import { compose, esperarApi } from './entorno';

/**
 * BD recién sembrada y reloj en 22/09/2026 12:00. Solo toca el proyecto `vecinopay-e2e`.
 * `E2E_REUSAR=1` conserva el entorno ya levantado (para depurar un spec); el estado no se reinicia.
 */
export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_REUSAR !== '1') {
    compose(['down', '-v']);
    compose(['up', '-d', '--build']);
  }
  await esperarApi();
}
