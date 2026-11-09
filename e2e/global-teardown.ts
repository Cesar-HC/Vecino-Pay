import { compose } from './entorno';

/** Baja el entorno de pruebas y borra su volumen. `E2E_MANTENER=1` o `E2E_REUSAR=1` lo dejan arriba. */
export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_MANTENER === '1' || process.env.E2E_REUSAR === '1') return;
  compose(['down', '-v']);
}
