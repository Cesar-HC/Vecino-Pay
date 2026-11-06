// Las pruebas de integración usan el usuario real de la API, para ejercer sus permisos.
import { resolve } from 'node:path';
import { cargarEnv } from '../../src/config/cargar-env';

// Compose lee .env: se usan las mismas claves. Lo demás del archivo no aplica a las pruebas.
cargarEnv(resolve(__dirname, '../../../../.env'));
const clave = process.env.APP_DB_PASSWORD ?? 'VecinoApp#2026';
const claveSa = process.env.MSSQL_SA_PASSWORD ?? 'VecinoPay#2026';
process.env.URL_SA_PRUEBAS = `sqlserver://127.0.0.1:14333;database=VecinoPay;user=sa;password=${claveSa};encrypt=true;trustServerCertificate=true`;
process.env.DATABASE_URL = `sqlserver://127.0.0.1:14333;database=VecinoPay;user=vecinopay_app;password=${clave};encrypt=true;trustServerCertificate=true`;
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-de-integracion-0123456789';
process.env.NODE_ENV = 'test';
