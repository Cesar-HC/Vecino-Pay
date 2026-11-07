-- VecinoPay: semillas de los juegos de prueba 1 y 2 (informe, sección 6.4), estado al 22/09/2026.
-- Se cargan una sola vez: si la tienda ya existe, el lote termina sin cambiar nada.
-- Excepciones: dos lotes aparte al final, el alta de la tienda y las tiendas de demostración, también llegan a una BD ya cargada.
-- Volver a cargarlas (por ejemplo, para repetir la activación de C02) exige "docker compose down -v".
-- FICTICIO (demo): dato que no sale del informe, inventado para que la demo funcione.
-- Las tasas y los indicadores salen del motor financiero; test/semillas.test.ts los compara con él.
-- fecha_hora siempre es hora local de Lima.
USE VecinoPay;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF EXISTS (SELECT 1 FROM dbo.tienda WHERE ruc = '10412587369')
BEGIN
  PRINT 'Semillas ya cargadas: no se cambia nada.';
  RETURN;
END;

DECLARE @ted_luis   DECIMAL(18,15) = 0.001032653810255; -- EFECTIVA 0.45, p = 360
DECLARE @tedm_luis  DECIMAL(18,15) = 0.000264785548963; -- EFECTIVA 0.10, p = 360
DECLARE @ted_maria  DECIMAL(18,15) = 0.001147371952051; -- NOMINAL 0.42, p = 360, c = 30
DECLARE @tedm_maria DECIMAL(18,15) = 0.000314851458950; -- EFECTIVA 0.12, p = 360
DECLARE @tem_maria  DECIMAL(18,15) = 0.034999999999986; -- (1 + @ted_maria)^30 - 1
DECLARE @tcea_maria DECIMAL(16,10) = 0.5108647287;      -- Tabla 20: 51.09 %

DECLARE @admin BIGINT, @rosa BIGINT, @u_luis BIGINT, @tienda BIGINT, @luis BIGINT, @maria BIGINT, @listado BIGINT;

BEGIN TRANSACTION;

-- Usuarios. FICTICIO (demo): correos, nombres y contraseñas, con hash bcrypt de costo 10.
-- Contraseñas de demo en el README: Admin#2026, Tienda#2026 y Vecino#2026.
INSERT INTO dbo.usuario (perfil, username, password_hash, nombres)
VALUES ('ADMIN_SISTEMA', 'admin@vecinopay.test', '$2a$10$MrpKxFpfnVj6m9tvd66evul8wCOxgTczMMN3QGUeZuJFknvBT85Xi', N'Administrador VecinoPay');
SET @admin = SCOPE_IDENTITY();

INSERT INTO dbo.usuario (perfil, username, password_hash, nombres)
VALUES ('DUENO', 'rosa@vecinopay.test', '$2a$10$nioawKq0olyh6ZtYbxzYJ.TsTo/Fb78m3//L6me7ev7l1g4uG/woS', N'Rosa Mamani');
SET @rosa = SCOPE_IDENTITY();

INSERT INTO dbo.usuario (perfil, username, password_hash, nombres)
VALUES ('CLIENTE', '45872316', '$2a$10$w4th75Fz5Qci/qxqvQgx0.tQDKM8lXYZhGe6X13PMkeBMzZf1iazW', N'Luis Quispe');
SET @u_luis = SCOPE_IDENTITY();

-- Tienda. Del informe: nombre comercial y COK. El RUC es el ejemplo de la Tabla 7, y lo asocia a esta tienda
-- docs/prompt_desarrollo.md. FICTICIO (demo): razón social, giro, dirección y teléfono.
INSERT INTO dbo.tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, direccion, telefono, cok_tea)
VALUES (@rosa, '10412587369', N'Rosa Mamani', N'Minimarket Doña Rosa', N'Minimarket', N'Av. Los Vecinos 123, Lima', '014000111', 0.200000000);
SET @tienda = SCOPE_IDENTITY();

-- Clientes. Del informe: límites, tasas, días de corte y pago, y max_meses de María (6.4).
-- FICTICIO (demo): max_meses de Luis (valor por defecto de la Tabla 6), direcciones, DNI y celular de María.
-- FICTICIO (demo): asignar a Luis el DNI y el celular de ejemplo de la Tabla 7, y a María su código MDR-7K2Q.
-- FICTICIO (demo): que Luis ya haya activado su cuenta y María no, para poder demostrar C02.
INSERT INTO dbo.cliente (tienda_id, usuario_id, dni, nombres, apellidos, celular, direccion, moneda, limite_credito, max_meses,
                         dia_corte, dia_pago, tipo_tasa, valor_tasa, plazo_tasa, capitalizacion,
                         tipo_tasa_mora, valor_tasa_mora, ted, ted_mora, codigo_activacion)
VALUES (@tienda, @u_luis, '45872316', N'Luis', N'Quispe', '951284736', N'Jr. Las Flores 456, Lima', 'PEN', 500.00, 3,
        20, 26, 'EFECTIVA', 0.450000000, 360, NULL,
        'EFECTIVA', 0.100000000, @ted_luis, @tedm_luis, NULL);
SET @luis = SCOPE_IDENTITY();

INSERT INTO dbo.cliente (tienda_id, usuario_id, dni, nombres, apellidos, celular, direccion, moneda, limite_credito, max_meses,
                         dia_corte, dia_pago, tipo_tasa, valor_tasa, plazo_tasa, capitalizacion,
                         tipo_tasa_mora, valor_tasa_mora, ted, ted_mora, codigo_activacion)
VALUES (@tienda, NULL, '40000002', N'María', N'Huamán', '999000111', N'Jr. Los Olivos 789, Lima', 'PEN', 600.00, 3,
        20, 26, 'NOMINAL', 0.420000000, 360, 30,
        'EFECTIVA', 0.120000000, @ted_maria, @tedm_maria, 'MDR-7K2Q');
SET @maria = SCOPE_IDENTITY();

-- Productos. Del informe: el código P012 y sus precios (ejemplo de la Tabla 7), y que existen pollo, olla y hervidor.
-- FICTICIO (demo): que P012 sea la olla, las modalidades de cada producto y el resto del catálogo,
-- elegidos para cuadrar con los montos de las Tablas 16 y 18.
INSERT INTO dbo.producto (tienda_id, codigo, nombre, unidad, precio_contado, precio_lista, permite_fin_mes, permite_cuotas)
VALUES
  (@tienda, 'P001', N'Pollo entero',    'KG',    8.50,   9.00, 1, 0),
  (@tienda, 'P002', N'Arroz 5 kg',      'UND',  22.50,  23.05, 1, 0),
  (@tienda, 'P003', N'Aceite 1 L',      'UND',   9.50,  10.00, 1, 0),
  (@tienda, 'P004', N'Leche evaporada', 'UND',   3.00,   3.20, 1, 0),
  (@tienda, 'P005', N'Huevos plancha',  'UND',  16.00,  17.00, 1, 0),
  (@tienda, 'P006', N'Fideos',          'UND',   3.60,   3.90, 1, 0),
  (@tienda, 'P007', N'Azúcar 1 kg',     'UND',   4.80,   5.10, 1, 0),
  (@tienda, 'P012', N'Olla arrocera',   'UND', 179.90, 184.90, 1, 1),
  (@tienda, 'P013', N'Hervidor',        'UND',  69.90,  72.90, 1, 1);

-- Compras a fin de mes (Tablas 16 y 17). Montos del informe; monto_contado es FICTICIO (demo) en Luis.
-- El número T-000301 viene de docs/prompt_desarrollo.md; el informe solo da su fecha y su monto.
INSERT INTO dbo.compra (tienda_id, cliente_id, ticket, fecha_hora, modalidad, monto_lista, monto_contado, fecha_corte, fecha_pago)
VALUES
  (@tienda, @luis, 'T-000231', '2026-08-22T09:15:00', 'FIN_MES', 44.20, 42.48, '2026-09-20', '2026-09-26'),
  (@tienda, @luis, 'T-000245', '2026-08-29T18:40:00', 'FIN_MES', 32.80, 31.00, '2026-09-20', '2026-09-26'),
  (@tienda, @luis, 'T-000262', '2026-09-05T11:05:00', 'FIN_MES', 63.82, 61.01, '2026-09-20', '2026-09-26'),
  (@tienda, @luis, 'T-000278', '2026-09-12T19:30:00', 'FIN_MES', 30.50, 28.60, '2026-09-20', '2026-09-26'),
  (@tienda, @luis, 'T-000290', '2026-09-18T08:50:00', 'FIN_MES', 52.30, 50.03, '2026-09-20', '2026-09-26'),
  (@tienda, @luis, 'T-000301', '2026-09-20T17:45:00', 'FIN_MES', 21.30, 20.05, '2026-10-20', '2026-10-26');

-- Compra en cuotas (Tablas 18 a 20). FICTICIO (demo): el número de ticket T-000284.
INSERT INTO dbo.compra (tienda_id, cliente_id, ticket, fecha_hora, modalidad, monto_lista, monto_contado, fecha_corte, fecha_pago,
                        num_cuotas, dias_gracia, capital_capitalizado, tem, cuota_fija, tcea, van)
VALUES (@tienda, @maria, 'T-000284', '2026-09-15T10:35:00', 'CUOTAS', 257.80, 249.80, '2026-09-20', '2026-09-26',
        3, 11, 261.07, @tem_maria, 93.25, @tcea_maria, 20.01);

-- Detalle. Del informe: olla y hervidor, y un pollo de 2.350 kg. FICTICIO (demo): las demás líneas.
INSERT INTO dbo.compra_detalle (compra_id, producto_id, cantidad, precio_lista, precio_contado, subtotal)
SELECT c.id, p.id, v.cantidad, p.precio_lista, p.precio_contado, ROUND(v.cantidad * p.precio_lista, 2)
FROM (VALUES
  ('T-000231', 'P001', 2.350), ('T-000231', 'P002', 1.000),
  ('T-000245', 'P003', 2.000), ('T-000245', 'P004', 4.000),
  ('T-000262', 'P002', 1.000), ('T-000262', 'P001', 1.530), ('T-000262', 'P003', 1.000), ('T-000262', 'P005', 1.000),
  ('T-000278', 'P005', 1.000), ('T-000278', 'P004', 3.000), ('T-000278', 'P006', 1.000),
  ('T-000284', 'P012', 1.000), ('T-000284', 'P013', 1.000),
  ('T-000290', 'P002', 1.000), ('T-000290', 'P001', 2.250), ('T-000290', 'P006', 1.000), ('T-000290', 'P007', 1.000),
  ('T-000301', 'P001', 1.300), ('T-000301', 'P004', 3.000)
) AS v (ticket, codigo, cantidad)
JOIN dbo.compra c ON c.tienda_id = @tienda AND c.ticket = v.ticket
JOIN dbo.producto p ON p.tienda_id = @tienda AND p.codigo = v.codigo;

-- Cronograma de T-000284 (Tabla 19).
INSERT INTO dbo.cuota (compra_id, numero, fecha_vencimiento, saldo_inicial, interes, amortizacion, monto, saldo_final)
SELECT c.id, v.numero, v.vence, v.saldo_inicial, v.interes, v.amortizacion, v.monto, v.saldo_final
FROM (VALUES
  (1, CAST('2026-10-26' AS DATE), 261.07, 9.14, 84.11, 93.25, 176.96),
  (2, CAST('2026-11-26' AS DATE), 176.96, 6.40, 86.85, 93.25,  90.11),
  (3, CAST('2026-12-26' AS DATE),  90.11, 3.15, 90.11, 93.26,   0.00)
) AS v (numero, vence, saldo_inicial, interes, amortizacion, monto, saldo_final)
JOIN dbo.compra c ON c.tienda_id = @tienda AND c.ticket = 'T-000284';

-- Listado de Luis, emitido en el corte del 20/09/2026 (Tabla 16).
-- María no tiene listado: su primera cuota entra al corte del 20/10. T-000301 tampoco está listada.
INSERT INTO dbo.listado_pago (tienda_id, cliente_id, numero, fecha_corte, fecha_pago, total_capital, total_interes, total_mora, total)
VALUES (@tienda, @luis, 'EC-202609-00001', '2026-09-20', '2026-09-26', 223.62, 4.80, 0.00, 228.42);
SET @listado = SCOPE_IDENTITY();

INSERT INTO dbo.listado_item (listado_id, compra_id, orden, tipo, fecha, dias, capital, interes, mora, total)
SELECT @listado, c.id, v.orden, 'COMPRA', v.fecha, v.dias, v.capital, v.interes, 0.00, v.total
FROM (VALUES
  (1, 'T-000231', CAST('2026-08-22' AS DATE), 35, 44.20, 1.63, 45.83),
  (2, 'T-000245', CAST('2026-08-30' AS DATE), 27, 32.80, 0.93, 33.73),
  (3, 'T-000262', CAST('2026-09-05' AS DATE), 21, 63.82, 1.40, 65.22),
  (4, 'T-000278', CAST('2026-09-13' AS DATE), 13, 30.50, 0.41, 30.91),
  (5, 'T-000290', CAST('2026-09-18' AS DATE),  8, 52.30, 0.43, 52.73)
) AS v (orden, ticket, fecha, dias, capital, interes, total)
JOIN dbo.compra c ON c.tienda_id = @tienda AND c.ticket = v.ticket;

-- Auditoría. El corte se registra como ALTA con usuario NULL (Tabla 33).
-- FICTICIO (demo): que Rosa registre las compras, y la fecha del rechazo, anterior a T-000301
-- porque 6.4 lo plantea con S/ 276.38 disponibles.
INSERT INTO dbo.auditoria (usuario_id, tienda_id, fecha_hora, accion, tabla, registro_id, detalle)
SELECT @rosa, @tienda, c.fecha_hora, 'ALTA', 'compra', c.id,
       CONCAT(N'Compra ', c.ticket, N' de ', cl.nombres, N' ', cl.apellidos, N', ', c.modalidad, N', S/ ', c.monto_lista)
FROM dbo.compra c
JOIN dbo.cliente cl ON cl.id = c.cliente_id
WHERE c.tienda_id = @tienda;

INSERT INTO dbo.auditoria (usuario_id, tienda_id, fecha_hora, accion, tabla, registro_id, detalle)
VALUES (@rosa, @tienda, '2026-09-19T10:00:00', 'RECHAZO', 'compra', NULL,
        N'Compra de S/ 999.00 de Luis Quispe rechazada: supera el crédito disponible de S/ 276.38');

INSERT INTO dbo.auditoria (usuario_id, tienda_id, fecha_hora, accion, tabla, registro_id, detalle)
VALUES (NULL, @tienda, '2026-09-20T17:00:00', 'ALTA', 'listado_pago', @listado,
        N'Corte automático: listado EC-202609-00001');

COMMIT TRANSACTION;
PRINT 'Semillas de los juegos 1 y 2 cargadas.';
GO

-- Alta de la tienda para el gráfico de A02 (la Tabla 24 no tiene fecha de alta).
-- Lote aparte: el primero termina con RETURN si la tienda ya existe, así también llega a una BD ya cargada.
-- FICTICIO (demo): la fecha; solo debe ser anterior a T-000231.
IF EXISTS (SELECT 1 FROM dbo.tienda WHERE ruc = '10412587369')
   AND NOT EXISTS (SELECT 1 FROM dbo.auditoria a JOIN dbo.tienda t ON t.id = a.registro_id
                   WHERE a.tabla = 'tienda' AND a.accion = 'ALTA' AND t.ruc = '10412587369')
  INSERT INTO dbo.auditoria (usuario_id, tienda_id, fecha_hora, accion, tabla, registro_id, detalle)
  SELECT u.id, t.id, '2026-08-01T09:00:00', 'ALTA', 'tienda', t.id, N'Alta de la tienda Minimarket Doña Rosa'
  FROM dbo.tienda t
  JOIN dbo.usuario u ON u.username = 'admin@vecinopay.test'
  WHERE t.ruc = '10412587369';
GO

-- Tiendas de demostración para A02 a A05 (decisión de Adrián). Todo este lote es FICTICIO (demo).
-- No traen clientes ni compras: los juegos 1 y 2 siguen solo en Minimarket Doña Rosa y sus cifras no cambian.
-- Lote aparte para que también llegue a una BD ya cargada; una sola transacción, así que no queda a medias.
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF EXISTS (SELECT 1 FROM dbo.tienda WHERE ruc = '20999000001')
BEGIN
  PRINT 'Tiendas de demostración ya cargadas: no se cambia nada.';
  RETURN;
END;

BEGIN TRANSACTION;

DECLARE @clave VARCHAR(255) = '$2a$10$nioawKq0olyh6ZtYbxzYJ.TsTo/Fb78m3//L6me7ev7l1g4uG/woS'; -- Tienda#2026
DECLARE @id_admin BIGINT = (SELECT id FROM dbo.usuario WHERE username = 'admin@vecinopay.test');
DECLARE @id_dona BIGINT = (SELECT id FROM dbo.usuario WHERE username = 'rosa@vecinopay.test');
DECLARE @id_cliente BIGINT = (SELECT id FROM dbo.usuario WHERE username = '45872316');
DECLARE @dona_rosa BIGINT = (SELECT id FROM dbo.tienda WHERE ruc = '10412587369');
DECLARE @elena BIGINT, @carlos BIGINT, @ana BIGINT, @jorge BIGINT;
DECLARE @pelu BIGINT, @bodega BIGINT, @pan BIGINT, @polleria BIGINT, @libreria BIGINT;
DECLARE @pan01 BIGINT, @pan02 BIGINT;

INSERT INTO dbo.usuario (perfil, username, password_hash, nombres, estado)
VALUES ('DUENO', 'elena.demo@vecinopay.test', @clave, N'Elena Paredes', 'INACTIVO');
SET @elena = SCOPE_IDENTITY();
INSERT INTO dbo.usuario (perfil, username, password_hash, nombres)
VALUES ('DUENO', 'carlos.demo@vecinopay.test', @clave, N'Carlos Rojas');
SET @carlos = SCOPE_IDENTITY();
INSERT INTO dbo.usuario (perfil, username, password_hash, nombres)
VALUES ('DUENO', 'ana.demo@vecinopay.test', @clave, N'Ana Torres');
SET @ana = SCOPE_IDENTITY();
INSERT INTO dbo.usuario (perfil, username, password_hash, nombres)
VALUES ('DUENO', 'jorge.demo@vecinopay.test', @clave, N'Jorge Salas');
SET @jorge = SCOPE_IDENTITY();

-- Peluquería Estilo: A03 la muestra como BAJA; se guarda INACTIVO. Carlos tiene 2 tiendas, para probar el selector.
INSERT INTO dbo.tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, direccion, telefono, cok_tea, estado)
VALUES (@elena, '20999000001', N'Salón Estilo E.I.R.L.', N'Peluquería Estilo', N'Peluquería', N'Jr. Las Tijeras 210, Lima', '014000222', 0.200000000, 'INACTIVO');
SET @pelu = SCOPE_IDENTITY();
INSERT INTO dbo.tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, direccion, telefono, cok_tea)
VALUES (@carlos, '20999000002', N'Bodega El Vecino S.A.C.', N'Bodega El Vecino', N'Bodega', N'Av. Central 340, Lima', '014000333', 0.200000000);
SET @bodega = SCOPE_IDENTITY();
INSERT INTO dbo.tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, direccion, telefono, cok_tea)
VALUES (@ana, '20999000003', N'Panificadora San Martín S.A.C.', N'Panadería San Martín', N'Panadería', N'Jr. San Martín 55, Lima', '014000444', 0.200000000);
SET @pan = SCOPE_IDENTITY();
INSERT INTO dbo.tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, direccion, telefono, cok_tea)
VALUES (@carlos, '20999000004', N'El Buen Sabor E.I.R.L.', N'Pollería El Buen Sabor', N'Pollería', N'Av. Los Sauces 780, Lima', '014000555', 0.200000000);
SET @polleria = SCOPE_IDENTITY();
INSERT INTO dbo.tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, direccion, telefono, cok_tea)
VALUES (@jorge, '20999000005', N'Librería El Estudiante S.A.C.', N'Librería El Estudiante', N'Librería', N'Jr. Los Libros 12, Lima', '014000666', 0.200000000);
SET @libreria = SCOPE_IDENTITY();

-- Productos para que A05 muestre un cambio de precio y una baja. Fuera de Doña Rosa: su catálogo no cambia.
INSERT INTO dbo.producto (tienda_id, codigo, nombre, unidad, precio_contado, precio_lista, permite_fin_mes, permite_cuotas)
VALUES (@pan, 'PAN01', N'Pan francés', 'UND', 0.50, 0.60, 1, 0);
SET @pan01 = SCOPE_IDENTITY();
INSERT INTO dbo.producto (tienda_id, codigo, nombre, unidad, precio_contado, precio_lista, permite_fin_mes, permite_cuotas, estado)
VALUES (@pan, 'PAN02', N'Keke casero', 'UND', 12.00, 13.00, 1, 0, 'INACTIVO');
SET @pan02 = SCOPE_IDENTITY();
INSERT INTO dbo.producto (tienda_id, codigo, nombre, unidad, precio_contado, precio_lista, permite_fin_mes, permite_cuotas)
VALUES (@bodega, 'BOD01', N'Gaseosa 1.5 L', 'UND', 6.00, 6.50, 1, 0),
       (@polleria, 'POL01', N'Pollo a la brasa, 1/4', 'UND', 14.00, 15.00, 1, 0);

-- Auditoría: altas en meses distintos (agosto queda para Doña Rosa) y lo que A05 debe mostrar.
INSERT INTO dbo.auditoria (usuario_id, tienda_id, fecha_hora, accion, tabla, registro_id, detalle)
VALUES
  (@id_admin, NULL,       '2026-04-08T09:00:00', 'ALTA',   'usuario',  @elena,    N'Alta del usuario elena.demo@vecinopay.test.'),
  (@id_admin, @pelu,      '2026-04-08T09:00:00', 'ALTA',   'tienda',   @pelu,     N'Alta de la tienda Peluquería Estilo.'),
  (@id_admin, NULL,       '2026-05-12T10:15:00', 'ALTA',   'usuario',  @carlos,   N'Alta del usuario carlos.demo@vecinopay.test.'),
  (@id_admin, @bodega,    '2026-05-12T10:15:00', 'ALTA',   'tienda',   @bodega,   N'Alta de la tienda Bodega El Vecino.'),
  (@id_admin, NULL,       '2026-06-03T11:00:00', 'ALTA',   'usuario',  @ana,      N'Alta del usuario ana.demo@vecinopay.test.'),
  (@id_admin, @pan,       '2026-06-03T11:00:00', 'ALTA',   'tienda',   @pan,      N'Alta de la tienda Panadería San Martín.'),
  (@id_admin, @polleria,  '2026-07-15T16:20:00', 'ALTA',   'tienda',   @polleria, N'Alta de la tienda Pollería El Buen Sabor.'),
  (@id_admin, NULL,       '2026-09-03T09:40:00', 'ALTA',   'usuario',  @jorge,    N'Alta del usuario jorge.demo@vecinopay.test.'),
  (@id_admin, @libreria,  '2026-09-03T09:40:00', 'ALTA',   'tienda',   @libreria, N'Alta de la tienda Librería El Estudiante.'),
  (@elena,    @pelu,      '2026-09-10T18:00:00', 'LOGIN',  'usuario',  @elena,    N'Inicio de sesión como DUENO.'),
  (@ana,      @pan,       '2026-09-16T08:30:00', 'CAMBIO', 'producto', @pan01,    N'Cambio de precio del producto PAN01: lista de S/ 0.50 a S/ 0.60.'),
  (@ana,      @pan,       '2026-09-16T08:35:00', 'BAJA',   'producto', @pan02,    N'Baja del producto PAN02.'),
  (@id_admin, @pelu,      '2026-09-17T10:30:00', 'BAJA',   'usuario',  @elena,    N'Baja del usuario elena.demo@vecinopay.test: se quedó sin tiendas activas.'),
  (@id_admin, @pelu,      '2026-09-17T10:30:00', 'BAJA',   'tienda',   @pelu,     N'Baja de la tienda Peluquería Estilo.'),
  (@id_admin, NULL,       '2026-09-21T08:55:00', 'LOGIN',  'usuario',  @id_admin, N'Inicio de sesión como ADMIN_SISTEMA.'),
  (@id_dona,  @dona_rosa, '2026-09-21T09:05:00', 'LOGIN',  'usuario',  @id_dona,  N'Inicio de sesión como DUENO.'),
  (@id_cliente, @dona_rosa, '2026-09-21T19:10:00', 'LOGIN', 'usuario', @id_cliente, N'Inicio de sesión como CLIENTE.'),
  (@ana,      @pan,       '2026-09-22T08:00:00', 'LOGIN',  'usuario',  @ana,      N'Inicio de sesión como DUENO.'),
  (@carlos,   @bodega,    '2026-09-22T08:20:00', 'LOGIN',  'usuario',  @carlos,   N'Inicio de sesión como DUENO.'),
  (@id_dona,  @dona_rosa, '2026-09-22T09:00:00', 'LOGIN',  'usuario',  @id_dona,  N'Inicio de sesión como DUENO.'),
  (@jorge,    @libreria,  '2026-09-22T09:30:00', 'LOGIN',  'usuario',  @jorge,    N'Inicio de sesión como DUENO.');

COMMIT TRANSACTION;
PRINT 'Tiendas de demostración cargadas.';
GO
