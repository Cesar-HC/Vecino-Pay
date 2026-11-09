import { bd, detener, limpiarEstado } from './entorno';

/** Detiene API y web y borra la base de pruebas. `E2E_MANTENER=1` o `E2E_REUSAR=1` lo dejan todo arriba. */
export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_MANTENER === '1' || process.env.E2E_REUSAR === '1') return;
  detener('api');
  detener('web');
  bd('borrar-desechable');
  limpiarEstado();
}
