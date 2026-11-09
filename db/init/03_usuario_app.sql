-- Privilegios del rol de la API (vecinopay_app), distinto del dueño y de postgres. Se aplica en cada arranque y se puede repetir.
-- El rol se crea con "npm run db:roles". Variable de psql: app_user.
-- Sin DELETE ni TRUNCATE en ninguna tabla (baja lógica, 6.1.1). En auditoria solo lee e inserta (Tabla 33).
-- PostgreSQL no tiene DENY: basta con no conceder, y el rol no es dueño de las tablas (no puede hacer ALTER ni DROP).
GRANT USAGE ON SCHEMA public TO :"app_user";
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON usuario, tienda, producto, cliente, compra, cuota, listado_pago TO :"app_user";
GRANT SELECT, INSERT ON compra_detalle, listado_item, pago, auditoria TO :"app_user";
