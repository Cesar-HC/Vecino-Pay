-- VecinoPay: semillas de los juegos de prueba 1 y 2 (informe, sección 6.4), estado al 22/09/2026.
-- Se cargan una sola vez: si la tienda ya existe, el lote termina sin cambiar nada.
-- Excepciones: dos lotes aparte al final, el alta de la tienda y las tiendas de demostración, también llegan a una BD ya cargada.
-- Volver a cargarlas (por ejemplo, para repetir la activación de C02) exige "npm run db:recrear -- --confirmar".
-- FICTICIO (demo): dato que no sale del informe, inventado para que la demo funcione.
-- Las tasas y los indicadores salen del motor financiero; test/semillas.test.ts los compara con él.
-- fecha_hora siempre es hora local de Lima.

DO $semilla$
DECLARE
  ted_luis   CONSTANT NUMERIC(18,15) := 0.001032653810255; -- EFECTIVA 0.45, p = 360
  tedm_luis  CONSTANT NUMERIC(18,15) := 0.000264785548963; -- EFECTIVA 0.10, p = 360
  ted_maria  CONSTANT NUMERIC(18,15) := 0.001147371952051; -- NOMINAL 0.42, p = 360, c = 30
  tedm_maria CONSTANT NUMERIC(18,15) := 0.000314851458950; -- EFECTIVA 0.12, p = 360
  tem_maria  CONSTANT NUMERIC(18,15) := 0.034999999999986; -- (1 + ted_maria)^30 - 1
  tcea_maria CONSTANT NUMERIC(16,10) := 0.5108647287;      -- Tabla 20: 51.09 %
  v_admin BIGINT; v_rosa BIGINT; v_u_luis BIGINT; v_tienda BIGINT; v_luis BIGINT; v_maria BIGINT; v_listado BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM tienda WHERE ruc = '10412587369') THEN
    RAISE NOTICE 'Semillas ya cargadas: no se cambia nada.';
    RETURN;
  END IF;

  -- Usuarios. FICTICIO (demo): correos, nombres y contraseñas, con hash bcrypt de costo 10.
  -- Contraseñas de demo en el README: Admin#2026, Tienda#2026 y Vecino#2026.
  INSERT INTO usuario (perfil, username, password_hash, nombres)
  VALUES ('ADMIN_SISTEMA', 'admin@vecinopay.test', '$2a$10$MrpKxFpfnVj6m9tvd66evul8wCOxgTczMMN3QGUeZuJFknvBT85Xi', 'Administrador VecinoPay')
  RETURNING id INTO v_admin;

  INSERT INTO usuario (perfil, username, password_hash, nombres)
  VALUES ('DUENO', 'rosa@vecinopay.test', '$2a$10$nioawKq0olyh6ZtYbxzYJ.TsTo/Fb78m3//L6me7ev7l1g4uG/woS', 'Rosa Mamani')
  RETURNING id INTO v_rosa;

  INSERT INTO usuario (perfil, username, password_hash, nombres)
  VALUES ('CLIENTE', '45872316', '$2a$10$w4th75Fz5Qci/qxqvQgx0.tQDKM8lXYZhGe6X13PMkeBMzZf1iazW', 'Luis Quispe')
  RETURNING id INTO v_u_luis;

  -- Tienda. Del informe: nombre comercial y COK. El RUC es el ejemplo de la Tabla 7, y lo asocia a esta tienda
  -- docs/prompt_desarrollo.md. FICTICIO (demo): razón social, giro, dirección y teléfono.
  INSERT INTO tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, direccion, telefono, cok_tea)
  VALUES (v_rosa, '10412587369', 'Rosa Mamani', 'Minimarket Doña Rosa', 'Minimarket', 'Av. Los Vecinos 123, Lima', '014000111', 0.200000000)
  RETURNING id INTO v_tienda;

  -- Clientes. Del informe: límites, tasas, días de corte y pago, y max_meses de María (6.4).
  -- FICTICIO (demo): max_meses de Luis (valor por defecto de la Tabla 6), direcciones, DNI y celular de María.
  -- FICTICIO (demo): asignar a Luis el DNI y el celular de ejemplo de la Tabla 7, y a María su código MDR-7K2Q.
  -- FICTICIO (demo): que Luis ya haya activado su cuenta y María no, para poder demostrar C02.
  INSERT INTO cliente (tienda_id, usuario_id, dni, nombres, apellidos, celular, direccion, moneda, limite_credito, max_meses,
                       dia_corte, dia_pago, tipo_tasa, valor_tasa, plazo_tasa, capitalizacion,
                       tipo_tasa_mora, valor_tasa_mora, ted, ted_mora, codigo_activacion)
  VALUES (v_tienda, v_u_luis, '45872316', 'Luis', 'Quispe', '951284736', 'Jr. Las Flores 456, Lima', 'PEN', 500.00, 3,
          20, 26, 'EFECTIVA', 0.450000000, 360, NULL,
          'EFECTIVA', 0.100000000, ted_luis, tedm_luis, NULL)
  RETURNING id INTO v_luis;

  INSERT INTO cliente (tienda_id, usuario_id, dni, nombres, apellidos, celular, direccion, moneda, limite_credito, max_meses,
                       dia_corte, dia_pago, tipo_tasa, valor_tasa, plazo_tasa, capitalizacion,
                       tipo_tasa_mora, valor_tasa_mora, ted, ted_mora, codigo_activacion)
  VALUES (v_tienda, NULL, '40000002', 'María', 'Huamán', '999000111', 'Jr. Los Olivos 789, Lima', 'PEN', 600.00, 3,
          20, 26, 'NOMINAL', 0.420000000, 360, 30,
          'EFECTIVA', 0.120000000, ted_maria, tedm_maria, 'MDR-7K2Q')
  RETURNING id INTO v_maria;

  -- Productos. Del informe: el código P012 y sus precios (ejemplo de la Tabla 7), y que existen pollo, olla y hervidor.
  -- FICTICIO (demo): que P012 sea la olla, las modalidades de cada producto y el resto del catálogo,
  -- elegidos para cuadrar con los montos de las Tablas 16 y 18.
  INSERT INTO producto (tienda_id, codigo, nombre, unidad, precio_contado, precio_lista, permite_fin_mes, permite_cuotas)
  VALUES
    (v_tienda, 'P001', 'Pollo entero',    'KG',    8.50,   9.00, TRUE, FALSE),
    (v_tienda, 'P002', 'Arroz 5 kg',      'UND',  22.50,  23.05, TRUE, FALSE),
    (v_tienda, 'P003', 'Aceite 1 L',      'UND',   9.50,  10.00, TRUE, FALSE),
    (v_tienda, 'P004', 'Leche evaporada', 'UND',   3.00,   3.20, TRUE, FALSE),
    (v_tienda, 'P005', 'Huevos plancha',  'UND',  16.00,  17.00, TRUE, FALSE),
    (v_tienda, 'P006', 'Fideos',          'UND',   3.60,   3.90, TRUE, FALSE),
    (v_tienda, 'P007', 'Azúcar 1 kg',     'UND',   4.80,   5.10, TRUE, FALSE),
    (v_tienda, 'P012', 'Olla arrocera',   'UND', 179.90, 184.90, TRUE, TRUE),
    (v_tienda, 'P013', 'Hervidor',        'UND',  69.90,  72.90, TRUE, TRUE);

  -- Compras a fin de mes (Tablas 16 y 17). Montos del informe; monto_contado es FICTICIO (demo) en Luis.
  -- El número T-000301 viene de docs/prompt_desarrollo.md; el informe solo da su fecha y su monto.
  INSERT INTO compra (tienda_id, cliente_id, ticket, fecha_hora, modalidad, monto_lista, monto_contado, fecha_corte, fecha_pago)
  VALUES
    (v_tienda, v_luis, 'T-000231', '2026-08-22T09:15:00', 'FIN_MES', 44.20, 42.48, '2026-09-20', '2026-09-26'),
    (v_tienda, v_luis, 'T-000245', '2026-08-29T18:40:00', 'FIN_MES', 32.80, 31.00, '2026-09-20', '2026-09-26'),
    (v_tienda, v_luis, 'T-000262', '2026-09-05T11:05:00', 'FIN_MES', 63.82, 61.01, '2026-09-20', '2026-09-26'),
    (v_tienda, v_luis, 'T-000278', '2026-09-12T19:30:00', 'FIN_MES', 30.50, 28.60, '2026-09-20', '2026-09-26'),
    (v_tienda, v_luis, 'T-000290', '2026-09-18T08:50:00', 'FIN_MES', 52.30, 50.03, '2026-09-20', '2026-09-26'),
    (v_tienda, v_luis, 'T-000301', '2026-09-20T17:45:00', 'FIN_MES', 21.30, 20.05, '2026-10-20', '2026-10-26');

  -- Compra en cuotas (Tablas 18 a 20). FICTICIO (demo): el número de ticket T-000284.
  INSERT INTO compra (tienda_id, cliente_id, ticket, fecha_hora, modalidad, monto_lista, monto_contado, fecha_corte, fecha_pago,
                      num_cuotas, dias_gracia, capital_capitalizado, tem, cuota_fija, tcea, van)
  VALUES (v_tienda, v_maria, 'T-000284', '2026-09-15T10:35:00', 'CUOTAS', 257.80, 249.80, '2026-09-20', '2026-09-26',
          3, 11, 261.07, tem_maria, 93.25, tcea_maria, 20.01);

  -- Detalle. Del informe: olla y hervidor, y un pollo de 2.350 kg. FICTICIO (demo): las demás líneas.
  INSERT INTO compra_detalle (compra_id, producto_id, cantidad, precio_lista, precio_contado, subtotal)
  SELECT c.id, p.id, v.cantidad, p.precio_lista, p.precio_contado, round(v.cantidad * p.precio_lista, 2)
  FROM (VALUES
    (1,  'T-000231', 'P001', 2.350), (2,  'T-000231', 'P002', 1.000),
    (3,  'T-000245', 'P003', 2.000), (4,  'T-000245', 'P004', 4.000),
    (5,  'T-000262', 'P002', 1.000), (6,  'T-000262', 'P001', 1.530), (7,  'T-000262', 'P003', 1.000), (8,  'T-000262', 'P005', 1.000),
    (9,  'T-000278', 'P005', 1.000), (10, 'T-000278', 'P004', 3.000), (11, 'T-000278', 'P006', 1.000),
    (12, 'T-000284', 'P012', 1.000), (13, 'T-000284', 'P013', 1.000),
    (14, 'T-000290', 'P002', 1.000), (15, 'T-000290', 'P001', 2.250), (16, 'T-000290', 'P006', 1.000), (17, 'T-000290', 'P007', 1.000),
    (18, 'T-000301', 'P001', 1.300), (19, 'T-000301', 'P004', 3.000)
  ) AS v (n, ticket, codigo, cantidad)
  JOIN compra c ON c.tienda_id = v_tienda AND c.ticket = v.ticket
  JOIN producto p ON p.tienda_id = v_tienda AND p.codigo = v.codigo
  ORDER BY v.n;

  -- Cronograma de T-000284 (Tabla 19).
  INSERT INTO cuota (compra_id, numero, fecha_vencimiento, saldo_inicial, interes, amortizacion, monto, saldo_final)
  SELECT c.id, v.numero, v.vence, v.saldo_inicial, v.interes, v.amortizacion, v.monto, v.saldo_final
  FROM (VALUES
    (1, CAST('2026-10-26' AS DATE), 261.07, 9.14, 84.11, 93.25, 176.96),
    (2, CAST('2026-11-26' AS DATE), 176.96, 6.40, 86.85, 93.25,  90.11),
    (3, CAST('2026-12-26' AS DATE),  90.11, 3.15, 90.11, 93.26,   0.00)
  ) AS v (numero, vence, saldo_inicial, interes, amortizacion, monto, saldo_final)
  JOIN compra c ON c.tienda_id = v_tienda AND c.ticket = 'T-000284'
  ORDER BY v.numero;

  -- Listado de Luis, emitido en el corte del 20/09/2026 (Tabla 16).
  -- María no tiene listado: su primera cuota entra al corte del 20/10. T-000301 tampoco está listada.
  INSERT INTO listado_pago (tienda_id, cliente_id, numero, fecha_corte, fecha_pago, total_capital, total_interes, total_mora, total)
  VALUES (v_tienda, v_luis, 'EC-202609-00001', '2026-09-20', '2026-09-26', 223.62, 4.80, 0.00, 228.42)
  RETURNING id INTO v_listado;

  INSERT INTO listado_item (listado_id, compra_id, orden, tipo, fecha, dias, capital, interes, mora, total)
  SELECT v_listado, c.id, v.orden, 'COMPRA', v.fecha, v.dias, v.capital, v.interes, 0.00, v.total
  FROM (VALUES
    (1, 'T-000231', CAST('2026-08-22' AS DATE), 35, 44.20, 1.63, 45.83),
    (2, 'T-000245', CAST('2026-08-30' AS DATE), 27, 32.80, 0.93, 33.73),
    (3, 'T-000262', CAST('2026-09-05' AS DATE), 21, 63.82, 1.40, 65.22),
    (4, 'T-000278', CAST('2026-09-13' AS DATE), 13, 30.50, 0.41, 30.91),
    (5, 'T-000290', CAST('2026-09-18' AS DATE),  8, 52.30, 0.43, 52.73)
  ) AS v (orden, ticket, fecha, dias, capital, interes, total)
  JOIN compra c ON c.tienda_id = v_tienda AND c.ticket = v.ticket
  ORDER BY v.orden;

  -- Auditoría. El corte se registra como ALTA con usuario NULL (Tabla 33).
  -- FICTICIO (demo): que Rosa registre las compras, y la fecha del rechazo, anterior a T-000301
  -- porque 6.4 lo plantea con S/ 276.38 disponibles.
  INSERT INTO auditoria (usuario_id, tienda_id, fecha_hora, accion, tabla, registro_id, detalle)
  SELECT v_rosa, v_tienda, c.fecha_hora, 'ALTA', 'compra', c.id,
         'Compra ' || c.ticket || ' de ' || cl.nombres || ' ' || cl.apellidos || ', ' || c.modalidad || ', S/ ' || c.monto_lista::text
  FROM compra c
  JOIN cliente cl ON cl.id = c.cliente_id
  WHERE c.tienda_id = v_tienda
  ORDER BY c.id;

  INSERT INTO auditoria (usuario_id, tienda_id, fecha_hora, accion, tabla, registro_id, detalle)
  VALUES (v_rosa, v_tienda, '2026-09-19T10:00:00', 'RECHAZO', 'compra', NULL,
          'Compra de S/ 999.00 de Luis Quispe rechazada: supera el crédito disponible de S/ 276.38');

  INSERT INTO auditoria (usuario_id, tienda_id, fecha_hora, accion, tabla, registro_id, detalle)
  VALUES (NULL, v_tienda, '2026-09-20T17:00:00', 'ALTA', 'listado_pago', v_listado,
          'Corte automático: listado EC-202609-00001');

  RAISE NOTICE 'Semillas de los juegos 1 y 2 cargadas.';
END
$semilla$;

-- Alta de la tienda para el gráfico de A02 (la Tabla 24 no tiene fecha de alta).
-- Lote aparte: el primero termina con RETURN si la tienda ya existe, así también llega a una BD ya cargada.
-- FICTICIO (demo): la fecha; solo debe ser anterior a T-000231.
INSERT INTO auditoria (usuario_id, tienda_id, fecha_hora, accion, tabla, registro_id, detalle)
SELECT u.id, t.id, '2026-08-01T09:00:00', 'ALTA', 'tienda', t.id, 'Alta de la tienda Minimarket Doña Rosa'
FROM tienda t
JOIN usuario u ON u.username = 'admin@vecinopay.test'
WHERE t.ruc = '10412587369'
  AND NOT EXISTS (SELECT 1 FROM auditoria a JOIN tienda t2 ON t2.id = a.registro_id
                  WHERE a.tabla = 'tienda' AND a.accion = 'ALTA' AND t2.ruc = '10412587369');

-- Tiendas de demostración para A02 a A05 (decisión de Adrián). Todo este lote es FICTICIO (demo).
-- No traen clientes ni compras: los juegos 1 y 2 siguen solo en Minimarket Doña Rosa y sus cifras no cambian.
-- Lote aparte para que también llegue a una BD ya cargada; una sola transacción, así que no queda a medias.
DO $semilla$
DECLARE
  v_clave VARCHAR(255) := '$2a$10$nioawKq0olyh6ZtYbxzYJ.TsTo/Fb78m3//L6me7ev7l1g4uG/woS'; -- Tienda#2026
  v_id_admin BIGINT := (SELECT id FROM usuario WHERE username = 'admin@vecinopay.test');
  v_id_dona BIGINT := (SELECT id FROM usuario WHERE username = 'rosa@vecinopay.test');
  v_id_cliente BIGINT := (SELECT id FROM usuario WHERE username = '45872316');
  v_dona_rosa BIGINT := (SELECT id FROM tienda WHERE ruc = '10412587369');
  v_elena BIGINT; v_carlos BIGINT; v_ana BIGINT; v_jorge BIGINT;
  v_pelu BIGINT; v_bodega BIGINT; v_pan BIGINT; v_polleria BIGINT; v_libreria BIGINT;
  v_pan01 BIGINT; v_pan02 BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM tienda WHERE ruc = '20999000001') THEN
    RAISE NOTICE 'Tiendas de demostración ya cargadas: no se cambia nada.';
    RETURN;
  END IF;

  INSERT INTO usuario (perfil, username, password_hash, nombres, estado)
  VALUES ('DUENO', 'elena.demo@vecinopay.test', v_clave, 'Elena Paredes', 'INACTIVO') RETURNING id INTO v_elena;
  INSERT INTO usuario (perfil, username, password_hash, nombres)
  VALUES ('DUENO', 'carlos.demo@vecinopay.test', v_clave, 'Carlos Rojas') RETURNING id INTO v_carlos;
  INSERT INTO usuario (perfil, username, password_hash, nombres)
  VALUES ('DUENO', 'ana.demo@vecinopay.test', v_clave, 'Ana Torres') RETURNING id INTO v_ana;
  INSERT INTO usuario (perfil, username, password_hash, nombres)
  VALUES ('DUENO', 'jorge.demo@vecinopay.test', v_clave, 'Jorge Salas') RETURNING id INTO v_jorge;

  -- Peluquería Estilo: A03 la muestra como BAJA; se guarda INACTIVO. Carlos tiene 2 tiendas, para probar el selector.
  INSERT INTO tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, direccion, telefono, cok_tea, estado)
  VALUES (v_elena, '20999000001', 'Salón Estilo E.I.R.L.', 'Peluquería Estilo', 'Peluquería', 'Jr. Las Tijeras 210, Lima', '014000222', 0.200000000, 'INACTIVO')
  RETURNING id INTO v_pelu;
  INSERT INTO tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, direccion, telefono, cok_tea)
  VALUES (v_carlos, '20999000002', 'Bodega El Vecino S.A.C.', 'Bodega El Vecino', 'Bodega', 'Av. Central 340, Lima', '014000333', 0.200000000)
  RETURNING id INTO v_bodega;
  INSERT INTO tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, direccion, telefono, cok_tea)
  VALUES (v_ana, '20999000003', 'Panificadora San Martín S.A.C.', 'Panadería San Martín', 'Panadería', 'Jr. San Martín 55, Lima', '014000444', 0.200000000)
  RETURNING id INTO v_pan;
  INSERT INTO tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, direccion, telefono, cok_tea)
  VALUES (v_carlos, '20999000004', 'El Buen Sabor E.I.R.L.', 'Pollería El Buen Sabor', 'Pollería', 'Av. Los Sauces 780, Lima', '014000555', 0.200000000)
  RETURNING id INTO v_polleria;
  INSERT INTO tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, direccion, telefono, cok_tea)
  VALUES (v_jorge, '20999000005', 'Librería El Estudiante S.A.C.', 'Librería El Estudiante', 'Librería', 'Jr. Los Libros 12, Lima', '014000666', 0.200000000)
  RETURNING id INTO v_libreria;

  -- Productos para que A05 muestre un cambio de precio y una baja. Fuera de Doña Rosa: su catálogo no cambia.
  INSERT INTO producto (tienda_id, codigo, nombre, unidad, precio_contado, precio_lista, permite_fin_mes, permite_cuotas)
  VALUES (v_pan, 'PAN01', 'Pan francés', 'UND', 0.50, 0.60, TRUE, FALSE) RETURNING id INTO v_pan01;
  INSERT INTO producto (tienda_id, codigo, nombre, unidad, precio_contado, precio_lista, permite_fin_mes, permite_cuotas, estado)
  VALUES (v_pan, 'PAN02', 'Keke casero', 'UND', 12.00, 13.00, TRUE, FALSE, 'INACTIVO') RETURNING id INTO v_pan02;
  INSERT INTO producto (tienda_id, codigo, nombre, unidad, precio_contado, precio_lista, permite_fin_mes, permite_cuotas)
  VALUES (v_bodega, 'BOD01', 'Gaseosa 1.5 L', 'UND', 6.00, 6.50, TRUE, FALSE),
         (v_polleria, 'POL01', 'Pollo a la brasa, 1/4', 'UND', 14.00, 15.00, TRUE, FALSE);

  -- Auditoría: altas en meses distintos (agosto queda para Doña Rosa) y lo que A05 debe mostrar.
  INSERT INTO auditoria (usuario_id, tienda_id, fecha_hora, accion, tabla, registro_id, detalle)
  VALUES
    (v_id_admin, NULL,         '2026-04-08T09:00:00', 'ALTA',   'usuario',  v_elena,    'Alta del usuario elena.demo@vecinopay.test.'),
    (v_id_admin, v_pelu,       '2026-04-08T09:00:00', 'ALTA',   'tienda',   v_pelu,     'Alta de la tienda Peluquería Estilo.'),
    (v_id_admin, NULL,         '2026-05-12T10:15:00', 'ALTA',   'usuario',  v_carlos,   'Alta del usuario carlos.demo@vecinopay.test.'),
    (v_id_admin, v_bodega,     '2026-05-12T10:15:00', 'ALTA',   'tienda',   v_bodega,   'Alta de la tienda Bodega El Vecino.'),
    (v_id_admin, NULL,         '2026-06-03T11:00:00', 'ALTA',   'usuario',  v_ana,      'Alta del usuario ana.demo@vecinopay.test.'),
    (v_id_admin, v_pan,        '2026-06-03T11:00:00', 'ALTA',   'tienda',   v_pan,      'Alta de la tienda Panadería San Martín.'),
    (v_id_admin, v_polleria,   '2026-07-15T16:20:00', 'ALTA',   'tienda',   v_polleria, 'Alta de la tienda Pollería El Buen Sabor.'),
    (v_id_admin, NULL,         '2026-09-03T09:40:00', 'ALTA',   'usuario',  v_jorge,    'Alta del usuario jorge.demo@vecinopay.test.'),
    (v_id_admin, v_libreria,   '2026-09-03T09:40:00', 'ALTA',   'tienda',   v_libreria, 'Alta de la tienda Librería El Estudiante.'),
    (v_elena,    v_pelu,       '2026-09-10T18:00:00', 'LOGIN',  'usuario',  v_elena,    'Inicio de sesión como DUENO.'),
    (v_ana,      v_pan,        '2026-09-16T08:30:00', 'CAMBIO', 'producto', v_pan01,    'Cambio de precio del producto PAN01: lista de S/ 0.50 a S/ 0.60.'),
    (v_ana,      v_pan,        '2026-09-16T08:35:00', 'BAJA',   'producto', v_pan02,    'Baja del producto PAN02.'),
    (v_id_admin, v_pelu,       '2026-09-17T10:30:00', 'BAJA',   'usuario',  v_elena,    'Baja del usuario elena.demo@vecinopay.test: se quedó sin tiendas activas.'),
    (v_id_admin, v_pelu,       '2026-09-17T10:30:00', 'BAJA',   'tienda',   v_pelu,     'Baja de la tienda Peluquería Estilo.'),
    (v_id_admin, NULL,         '2026-09-21T08:55:00', 'LOGIN',  'usuario',  v_id_admin, 'Inicio de sesión como ADMIN_SISTEMA.'),
    (v_id_dona,  v_dona_rosa,  '2026-09-21T09:05:00', 'LOGIN',  'usuario',  v_id_dona,  'Inicio de sesión como DUENO.'),
    (v_id_cliente, v_dona_rosa,'2026-09-21T19:10:00', 'LOGIN',  'usuario',  v_id_cliente, 'Inicio de sesión como CLIENTE.'),
    (v_ana,      v_pan,        '2026-09-22T08:00:00', 'LOGIN',  'usuario',  v_ana,      'Inicio de sesión como DUENO.'),
    (v_carlos,   v_bodega,     '2026-09-22T08:20:00', 'LOGIN',  'usuario',  v_carlos,   'Inicio de sesión como DUENO.'),
    (v_id_dona,  v_dona_rosa,  '2026-09-22T09:00:00', 'LOGIN',  'usuario',  v_id_dona,  'Inicio de sesión como DUENO.'),
    (v_jorge,    v_libreria,   '2026-09-22T09:30:00', 'LOGIN',  'usuario',  v_jorge,    'Inicio de sesión como DUENO.');

  RAISE NOTICE 'Tiendas de demostración cargadas.';
END
$semilla$;
