// Las pruebas de integración usan el usuario real de la API, para ejercer sus permisos.
import { resolve } from 'node:path';
import { cargarEnv } from '../../src/config/cargar-env';

// Se leen las mismas claves de .env que usan los scripts. Lo demás del archivo no aplica a las pruebas.
cargarEnv(resolve(__dirname, '../../../../.env'));
const bd = process.env.BD_PRUEBAS ?? 'vecinopay_test';
const servidor = `${process.env.PGHOST ?? '127.0.0.1'}:${process.env.PGPORT ?? '5432'}`;
const url = (usuario: string, clave: string) =>
  `postgresql://${encodeURIComponent(usuario)}:${encodeURIComponent(clave)}@${servidor}/${bd}?schema=public`;

process.env.DATABASE_URL = url(
  process.env.APP_DB_USER ?? 'vecinopay_app',
  process.env.APP_DB_PASSWORD ?? 'VecinoApp2026dev',
);
// El dueño de la base solo se usa para comprobar lo que la API no puede hacer.
process.env.URL_OWNER_PRUEBAS = url(
  process.env.DB_OWNER_USER ?? 'vecinopay_owner',
  process.env.DB_OWNER_PASSWORD ?? 'VecinoOwner2026dev',
);
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-de-integracion-0123456789';
process.env.NODE_ENV = 'test';
