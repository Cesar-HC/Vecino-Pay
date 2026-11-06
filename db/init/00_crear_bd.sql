-- Crea la base de datos vacía de VecinoPay.
-- Las 11 tablas están en 01_esquema.sql y los juegos de prueba 1 y 2 en 02_semillas.sql.
IF DB_ID(N'VecinoPay') IS NULL
BEGIN
  CREATE DATABASE VecinoPay COLLATE Modern_Spanish_CI_AS;
END
GO

USE VecinoPay;
GO

PRINT 'Base de datos VecinoPay lista.';
GO
