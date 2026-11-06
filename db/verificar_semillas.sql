-- Verifica las semillas contra el informe. Solo vale para el estado al 22/09/2026 (antes de la demo).
-- Falla con THROW 50010 y lista todas las diferencias. No forma parte de db/init.
-- Uso: npm run db:verificar
USE VecinoPay;
GO
SET NOCOUNT ON;
SET XACT_ABORT OFF;

CREATE TABLE #chequeo (nombre NVARCHAR(100) NOT NULL, esperado DECIMAL(18,2) NOT NULL, obtenido DECIMAL(18,2) NULL);

DECLARE @tienda BIGINT = (SELECT id FROM dbo.tienda WHERE ruc = '10412587369');
DECLARE @luis BIGINT = (SELECT id FROM dbo.cliente WHERE tienda_id = @tienda AND dni = '45872316');
DECLARE @maria BIGINT = (SELECT id FROM dbo.cliente WHERE tienda_id = @tienda AND nombres = N'María' AND apellidos = N'Huamán');
DECLARE @cuotas BIGINT = (SELECT id FROM dbo.compra WHERE tienda_id = @tienda AND ticket = 'T-000284');

INSERT INTO #chequeo VALUES
  (N'filas usuario',        3, (SELECT COUNT(*) FROM dbo.usuario)),
  (N'filas tienda',         1, (SELECT COUNT(*) FROM dbo.tienda)),
  (N'filas producto',       9, (SELECT COUNT(*) FROM dbo.producto)),
  (N'filas cliente',        2, (SELECT COUNT(*) FROM dbo.cliente)),
  (N'filas compra',         7, (SELECT COUNT(*) FROM dbo.compra)),
  (N'filas compra_detalle', 19, (SELECT COUNT(*) FROM dbo.compra_detalle)),
  (N'filas cuota',          3, (SELECT COUNT(*) FROM dbo.cuota)),
  (N'filas listado_pago',   1, (SELECT COUNT(*) FROM dbo.listado_pago)),
  (N'filas listado_item',   5, (SELECT COUNT(*) FROM dbo.listado_item)),
  (N'filas pago',           0, (SELECT COUNT(*) FROM dbo.pago)),
  (N'filas auditoria',      10, (SELECT COUNT(*) FROM dbo.auditoria));

-- D01 y 6.3m. La suma de monto_lista solo vale en este estado: no define la regla de SU (ver escalaciones).
INSERT INTO #chequeo VALUES
  (N'capital por cobrar',   502.72, (SELECT SUM(monto_lista) FROM dbo.compra WHERE estado = 'PENDIENTE')),
  (N'SU Luis',              244.92, (SELECT SUM(monto_lista) FROM dbo.compra WHERE cliente_id = @luis AND estado = 'PENDIENTE')),
  (N'uso Luis',              49.00, (SELECT ROUND(SUM(c.monto_lista) * 100 / MAX(cl.limite_credito), 1) FROM dbo.compra c JOIN dbo.cliente cl ON cl.id = c.cliente_id WHERE c.cliente_id = @luis AND c.estado = 'PENDIENTE')),
  (N'disponible Luis',      255.08, (SELECT MAX(cl.limite_credito) - SUM(c.monto_lista) FROM dbo.compra c JOIN dbo.cliente cl ON cl.id = c.cliente_id WHERE c.cliente_id = @luis AND c.estado = 'PENDIENTE')),
  (N'SU María',             257.80, (SELECT SUM(monto_lista) FROM dbo.compra WHERE cliente_id = @maria AND estado = 'PENDIENTE')),
  (N'uso María',             43.00, (SELECT ROUND(SUM(c.monto_lista) * 100 / MAX(cl.limite_credito), 1) FROM dbo.compra c JOIN dbo.cliente cl ON cl.id = c.cliente_id WHERE c.cliente_id = @maria AND c.estado = 'PENDIENTE')),
  (N'disponible María',     342.20, (SELECT MAX(cl.limite_credito) - SUM(c.monto_lista) FROM dbo.compra c JOIN dbo.cliente cl ON cl.id = c.cliente_id WHERE c.cliente_id = @maria AND c.estado = 'PENDIENTE')),
  (N'cobro próximo',        228.42, (SELECT SUM(total) FROM dbo.listado_pago WHERE estado = 'EMITIDO')),
  (N'intereses del ciclo',    4.80, (SELECT SUM(total_interes) FROM dbo.listado_pago WHERE estado = 'EMITIDO')),
  (N'cartera en mora',        0.00, (SELECT COALESCE(SUM(total), 0) FROM dbo.listado_pago WHERE estado = 'VENCIDO')),
  (N'VAN acumulado',         20.01, (SELECT SUM(van) FROM dbo.compra WHERE modalidad = 'CUOTAS'));

-- Tablas 16, 19 y 20.
INSERT INTO #chequeo VALUES
  (N'listado capital',      223.62, (SELECT total_capital FROM dbo.listado_pago WHERE numero = 'EC-202609-00001')),
  (N'listado suma ítems',   228.42, (SELECT SUM(total) FROM dbo.listado_item)),
  (N'cuotas interés',        18.69, (SELECT SUM(interes) FROM dbo.cuota WHERE compra_id = @cuotas)),
  (N'cuotas amortización',  261.07, (SELECT SUM(amortizacion) FROM dbo.cuota WHERE compra_id = @cuotas)),
  (N'cuotas suma',          279.76, (SELECT SUM(monto) FROM dbo.cuota WHERE compra_id = @cuotas)),
  (N'cuota 3 saldo final',    0.00, (SELECT saldo_final FROM dbo.cuota WHERE compra_id = @cuotas AND numero = 3)),
  (N'intereses totales',     21.96, (SELECT SUM(q.monto) - MAX(c.monto_lista) FROM dbo.cuota q JOIN dbo.compra c ON c.id = q.compra_id WHERE c.id = @cuotas));

-- Coherencia del detalle y del ciclo.
INSERT INTO #chequeo VALUES
  (N'compras con lista distinta del detalle', 0, (SELECT COUNT(*) FROM dbo.compra c WHERE c.monto_lista <> (SELECT SUM(d.subtotal) FROM dbo.compra_detalle d WHERE d.compra_id = c.id))),
  (N'compras con contado distinto del detalle', 0, (SELECT COUNT(*) FROM dbo.compra c WHERE c.monto_contado <> (SELECT SUM(ROUND(d.cantidad * d.precio_contado, 2)) FROM dbo.compra_detalle d WHERE d.compra_id = c.id))),
  (N'T-000301 fecha de pago', 20261026, (SELECT CONVERT(INT, CONVERT(CHAR(8), fecha_pago, 112)) FROM dbo.compra WHERE ticket = 'T-000301')),
  (N'T-000301 en listados', 0, (SELECT COUNT(*) FROM dbo.listado_item i JOIN dbo.compra c ON c.id = i.compra_id WHERE c.ticket = 'T-000301')),
  (N'auditoría ALTA sin usuario', 1, (SELECT COUNT(*) FROM dbo.auditoria WHERE accion = 'ALTA' AND usuario_id IS NULL)),
  (N'auditoría ALTA de la tienda', 1, (SELECT COUNT(*) FROM dbo.auditoria WHERE accion = 'ALTA' AND tabla = 'tienda' AND registro_id = @tienda)),
  (N'auditoría RECHAZO sin registro', 1, (SELECT COUNT(*) FROM dbo.auditoria WHERE accion = 'RECHAZO' AND registro_id IS NULL)),
  (N'Luis activado', 1, (SELECT COUNT(*) FROM dbo.cliente WHERE id = @luis AND usuario_id IS NOT NULL AND codigo_activacion IS NULL)),
  (N'María sin activar', 1, (SELECT COUNT(*) FROM dbo.cliente WHERE id = @maria AND usuario_id IS NULL AND codigo_activacion = 'MDR-7K2Q')),
  (N'acentos: ñ guardada', 1, (SELECT COUNT(*) FROM dbo.tienda WHERE id = @tienda AND CHARINDEX(NCHAR(241), nombre_comercial COLLATE Latin1_General_BIN2) > 0)),
  (N'acentos: á guardada', 1, (SELECT COUNT(*) FROM dbo.cliente WHERE id = @maria AND CHARINDEX(NCHAR(225), apellidos COLLATE Latin1_General_BIN2) > 0)),
  (N'hora de corte fija', 2, (SELECT COUNT(*) FROM dbo.cliente WHERE hora_corte = '17:00:00')),
  (N'T-000284 registro', 202609151035, (SELECT CONVERT(BIGINT, FORMAT(fecha_hora, 'yyyyMMddHHmm')) FROM dbo.compra WHERE id = @cuotas)),
  (N'T-000284 corte', 20260920, (SELECT CONVERT(INT, CONVERT(CHAR(8), fecha_corte, 112)) FROM dbo.compra WHERE id = @cuotas)),
  (N'T-000284 pago', 20260926, (SELECT CONVERT(INT, CONVERT(CHAR(8), fecha_pago, 112)) FROM dbo.compra WHERE id = @cuotas)),
  (N'TEA de Luis', 45.00, (SELECT valor_tasa * 100 FROM dbo.cliente WHERE id = @luis AND tipo_tasa = 'EFECTIVA' AND plazo_tasa = 360 AND capitalizacion IS NULL)),
  (N'mora de Luis', 10.00, (SELECT valor_tasa_mora * 100 FROM dbo.cliente WHERE id = @luis AND tipo_tasa_mora = 'EFECTIVA')),
  (N'TNA de María', 42.00, (SELECT valor_tasa * 100 FROM dbo.cliente WHERE id = @maria AND tipo_tasa = 'NOMINAL' AND plazo_tasa = 360 AND capitalizacion = 30)),
  (N'mora de María', 12.00, (SELECT valor_tasa_mora * 100 FROM dbo.cliente WHERE id = @maria AND tipo_tasa_mora = 'EFECTIVA')),
  (N'COK de la tienda', 20.00, (SELECT cok_tea * 100 FROM dbo.tienda WHERE id = @tienda)),
  (N'giro de la tienda', 1, (SELECT COUNT(*) FROM dbo.tienda WHERE id = @tienda AND giro = N'Minimarket')),
  (N'teléfono de la tienda', 1, (SELECT COUNT(*) FROM dbo.tienda WHERE id = @tienda AND telefono IS NOT NULL)),
  (N'columna pago.numero_operacion', 30, COL_LENGTH('dbo.pago', 'numero_operacion'));

-- Hora por defecto de la auditoría: debe ser la de Lima (UTC-5).
BEGIN TRANSACTION;
  INSERT INTO dbo.auditoria (accion, tabla) VALUES ('LOGIN', 'usuario');
  DECLARE @desfase INT = (SELECT ABS(DATEDIFF(MINUTE, fecha_hora, DATEADD(HOUR, -5, SYSUTCDATETIME()))) FROM dbo.auditoria WHERE id = SCOPE_IDENTITY());
ROLLBACK TRANSACTION;
INSERT INTO #chequeo VALUES (N'auditoría con hora de Lima (minutos de desfase)', 0, CASE WHEN @desfase <= 1 THEN 0 ELSE @desfase END);

-- Pruebas negativas: cada operación debe ser rechazada. Se revierte todo.
BEGIN TRY
  BEGIN TRANSACTION;
  UPDATE dbo.auditoria SET detalle = N'alterado';
  ROLLBACK TRANSACTION;
  INSERT INTO #chequeo VALUES (N'negativa: UPDATE de auditoría', 0, 1);
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  IF ERROR_NUMBER() <> 50001 INSERT INTO #chequeo VALUES (N'negativa: UPDATE de auditoría, causa inesperada', 0, ERROR_NUMBER());
END CATCH;

BEGIN TRY
  BEGIN TRANSACTION;
  DELETE FROM dbo.auditoria;
  ROLLBACK TRANSACTION;
  INSERT INTO #chequeo VALUES (N'negativa: DELETE de auditoría', 0, 1);
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  IF ERROR_NUMBER() <> 50001 INSERT INTO #chequeo VALUES (N'negativa: DELETE de auditoría, causa inesperada', 0, ERROR_NUMBER());
END CATCH;

BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @otra BIGINT, @prod BIGINT;
  INSERT INTO dbo.tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, cok_tea)
  SELECT duenio_id, '20000000001', N'Otra', N'Otra', N'Otro', 0.2 FROM dbo.tienda WHERE id = @tienda;
  SET @otra = SCOPE_IDENTITY();
  INSERT INTO dbo.producto (tienda_id, codigo, nombre, unidad, precio_contado, precio_lista, permite_fin_mes, permite_cuotas)
  VALUES (@otra, 'X1', N'Ajeno', 'UND', 1.00, 1.00, 1, 0);
  SET @prod = SCOPE_IDENTITY();
  INSERT INTO dbo.compra_detalle (compra_id, producto_id, cantidad, precio_lista, precio_contado, subtotal)
  VALUES (@cuotas, @prod, 1, 1.00, 1.00, 1.00);
  ROLLBACK TRANSACTION;
  INSERT INTO #chequeo VALUES (N'negativa: detalle con producto de otra tienda', 0, 1);
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  IF ERROR_NUMBER() <> 50002 INSERT INTO #chequeo VALUES (N'negativa: detalle de otra tienda, causa inesperada', 0, ERROR_NUMBER());
END CATCH;

BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @otra2 BIGINT;
  INSERT INTO dbo.tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, cok_tea)
  SELECT duenio_id, '20000000002', N'Otra', N'Otra', N'Otro', 0.2 FROM dbo.tienda WHERE id = @tienda;
  SET @otra2 = SCOPE_IDENTITY();
  INSERT INTO dbo.compra (tienda_id, cliente_id, ticket, fecha_hora, modalidad, monto_lista, monto_contado, fecha_corte, fecha_pago)
  VALUES (@otra2, @luis, 'X-1', '2026-09-01T10:00:00', 'FIN_MES', 1.00, 1.00, '2026-09-20', '2026-09-26');
  ROLLBACK TRANSACTION;
  INSERT INTO #chequeo VALUES (N'negativa: compra con cliente de otra tienda', 0, 1);
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  IF ERROR_MESSAGE() NOT LIKE N'%FK_compra_cliente%' INSERT INTO #chequeo VALUES (N'negativa: compra de otra tienda, causa inesperada', 0, ERROR_NUMBER());
END CATCH;

BEGIN TRY
  BEGIN TRANSACTION;
  INSERT INTO dbo.cuota (compra_id, numero, fecha_vencimiento, saldo_inicial, interes, amortizacion, monto, saldo_final)
  VALUES (@cuotas, 9, '2027-06-26', 10.00, 1.00, 1.00, 3.00, 9.00);
  ROLLBACK TRANSACTION;
  INSERT INTO #chequeo VALUES (N'negativa: cuota descuadrada', 0, 1);
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  IF ERROR_MESSAGE() NOT LIKE N'%CK_cuota_monto%' INSERT INTO #chequeo VALUES (N'negativa: cuota descuadrada, causa inesperada', 0, ERROR_NUMBER());
END CATCH;

BEGIN TRY
  BEGIN TRANSACTION;
  INSERT INTO dbo.listado_pago (tienda_id, cliente_id, numero, fecha_corte, fecha_pago, total_capital, total_interes, total_mora, total)
  VALUES (@tienda, @luis, 'EC-DUPLICADO', '2026-09-20', '2026-09-26', 1.00, 0.00, 0.00, 1.00);
  ROLLBACK TRANSACTION;
  INSERT INTO #chequeo VALUES (N'negativa: segundo listado del mismo corte', 0, 1);
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  IF ERROR_MESSAGE() NOT LIKE N'%UQ_listado_cliente_corte%' INSERT INTO #chequeo VALUES (N'negativa: segundo listado, causa inesperada', 0, ERROR_NUMBER());
END CATCH;

BEGIN TRY
  BEGIN TRANSACTION;
  INSERT INTO dbo.listado_item (listado_id, cuota_id, orden, tipo, fecha, dias, capital, interes, mora, total)
  SELECT l.id, q.id, 99, 'CUOTA', q.fecha_vencimiento, 30, q.amortizacion, q.interes, 0.00, q.monto
  FROM dbo.listado_pago l
  CROSS JOIN dbo.cuota q
  WHERE l.numero = 'EC-202609-00001' AND q.compra_id = @cuotas AND q.numero = 1;
  ROLLBACK TRANSACTION;
  INSERT INTO #chequeo VALUES (N'negativa: ítem de otro cliente en el listado', 0, 1);
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  IF ERROR_NUMBER() <> 50003 INSERT INTO #chequeo VALUES (N'negativa: ítem de otro cliente, causa inesperada', 0, ERROR_NUMBER());
END CATCH;

DECLARE @fallos NVARCHAR(2000) = (
  SELECT LEFT(STRING_AGG(CONCAT(nombre, N': esperado ', esperado, N', obtenido ', COALESCE(CAST(obtenido AS NVARCHAR(30)), N'NULL')), N'; '), 1900)
  FROM #chequeo
  WHERE obtenido IS NULL OR obtenido <> esperado
);
DECLARE @total INT = (SELECT COUNT(*) FROM #chequeo);

IF @fallos IS NOT NULL
  THROW 50010, @fallos, 1;

PRINT CONCAT(N'Semillas verificadas: ', @total, N' chequeos y 7 pruebas negativas sin diferencias.');
GO
