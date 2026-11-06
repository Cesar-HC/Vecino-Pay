-- Usuario de la API, distinto de sa. Se aplica en cada arranque y se puede repetir.
-- Sin DELETE en ninguna tabla (baja lógica, 6.1.1). En auditoria solo lee e inserta (Tabla 33):
-- el DENY de ALTER impide TRUNCATE y deshabilitar su trigger.
-- No se usa DENY CONTROL: en SQL Server también negaría SELECT e INSERT.
USE master;
GO
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'vecinopay_app')
  CREATE LOGIN vecinopay_app WITH PASSWORD = N'$(APP_DB_PASSWORD)', CHECK_POLICY = ON, DEFAULT_DATABASE = VecinoPay;
ELSE
  ALTER LOGIN vecinopay_app WITH PASSWORD = N'$(APP_DB_PASSWORD)';
GO
USE VecinoPay;
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'vecinopay_app')
  CREATE USER vecinopay_app FOR LOGIN vecinopay_app;
GO
GRANT SELECT, INSERT, UPDATE ON dbo.usuario TO vecinopay_app;
GRANT SELECT, INSERT, UPDATE ON dbo.tienda TO vecinopay_app;
GRANT SELECT, INSERT, UPDATE ON dbo.producto TO vecinopay_app;
GRANT SELECT, INSERT, UPDATE ON dbo.cliente TO vecinopay_app;
GRANT SELECT, INSERT, UPDATE ON dbo.compra TO vecinopay_app;
GRANT SELECT, INSERT, UPDATE ON dbo.cuota TO vecinopay_app;
GRANT SELECT, INSERT, UPDATE ON dbo.listado_pago TO vecinopay_app;
GRANT SELECT, INSERT ON dbo.compra_detalle TO vecinopay_app;
GRANT SELECT, INSERT ON dbo.listado_item TO vecinopay_app;
GRANT SELECT, INSERT ON dbo.pago TO vecinopay_app;
GRANT SELECT, INSERT ON dbo.auditoria TO vecinopay_app;
DENY UPDATE, DELETE, ALTER, TAKE OWNERSHIP ON dbo.auditoria TO vecinopay_app;
PRINT 'Usuario de la API aplicado.';
GO
