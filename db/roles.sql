-- VecinoPay: roles de PostgreSQL. Se ejecuta UNA vez como superusuario (postgres) con:
--   npm run db:roles
-- Idempotente. Las contraseñas llegan por variables de psql (owner_pw, app_pw), nunca concatenadas a mano.
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

-- Permite al dueño cerrar las conexiones de la API al recrear una base (DROP DATABASE ... WITH (FORCE)).
-- pg_signal_backend no alcanza a los superusuarios.
GRANT pg_signal_backend TO :"owner_user";
