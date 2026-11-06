// Las pruebas de integración usan el usuario real de la API, para ejercer sus permisos.
const clave = process.env.APP_DB_PASSWORD ?? 'VecinoApp#2026';
process.env.DATABASE_URL = `sqlserver://127.0.0.1:14333;database=VecinoPay;user=vecinopay_app;password=${clave};encrypt=true;trustServerCertificate=true`;
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-de-integracion-0123456789';
process.env.NODE_ENV = 'test';
