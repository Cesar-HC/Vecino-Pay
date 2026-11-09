-- VecinoPay: roles de PostgreSQL. Se ejecuta UNA vez como superusuario (postgres) con:
--   npm run db:roles
-- Idempotente. Las contraseñas llegan por el entorno del proceso (DB_OWNER_PASSWORD y APP_DB_PASSWORD)
-- y se leen con \getenv: nunca van en la línea de comandos.
\getenv owner_pw DB_OWNER_PASSWORD
\getenv app_pw APP_DB_PASSWORD
SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'owner_user') AS dueno_existe \gset
SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') AS app_existe \gset

\if :dueno_existe
  ALTER ROLE :"owner_user" WITH LOGIN CREATEDB NOSUPERUSER NOCREATEROLE PASSWORD :'owner_pw';
\else
  CREATE ROLE :"owner_user" WITH LOGIN CREATEDB NOSUPERUSER NOCREATEROLE PASSWORD :'owner_pw';
\endif

\if :app_existe
  ALTER ROLE :"app_user" WITH LOGIN NOCREATEDB NOSUPERUSER NOCREATEROLE PASSWORD :'app_pw';
\else
  CREATE ROLE :"app_user" WITH LOGIN NOCREATEDB NOSUPERUSER NOCREATEROLE PASSWORD :'app_pw';
\endif

-- 12 s es menor que el tiempo máximo de la transacción de Prisma: un bloqueo largo falla antes.
ALTER ROLE :"app_user" SET lock_timeout = '12s';
ALTER ROLE :"app_user" SET search_path = public;

-- Permite al dueño cerrar las conexiones de la API al recrear una base (DROP DATABASE ... WITH (FORCE)):
-- basta con pertenecer al rol de la API, así que el alcance se limita a sus sesiones.
REVOKE pg_signal_backend FROM :"owner_user";
GRANT :"app_user" TO :"owner_user";
