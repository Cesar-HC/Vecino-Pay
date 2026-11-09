import { compose } from './entorno';

/** Baja el entorno de pruebas y borra su volumen. `E2E_MANTENER=1` lo deja arriba para depurar. */
export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_MANTENER === '1') return;
  compose(['down', '-v']);
}
