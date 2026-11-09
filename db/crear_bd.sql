-- VecinoPay: crea una base vacía. Lo ejecuta vecinopay_owner contra la base "postgres" con:
--   psql -v db_name=<nombre> -v app_user=<rol de la API> -f db/crear_bd.sql
-- La existencia previa la decide scripts/db.mjs (CREATE DATABASE no admite IF NOT EXISTS).
CREATE DATABASE :"db_name" TEMPLATE template0 ENCODING 'UTF8'
  LOCALE_PROVIDER icu ICU_LOCALE 'es-PE' LOCALE 'C';
REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";
