-- Verifica las semillas contra el informe. Solo vale para el estado al 22/09/2026 (antes de la demo).
-- Falla con una excepción que lista todas las diferencias. No forma parte de db/init.
-- Uso: npm run db:verificar
-- Los valores "esperado" son los mismos de la versión de SQL Server; solo cambió la sintaxis.
DO $verificar$
DECLARE
  v_tienda BIGINT := (SELECT id FROM tienda WHERE ruc = '10412587369');
  v_luis BIGINT;
  v_maria BIGINT;
  v_cuotas BIGINT;
  v_pelu BIGINT := (SELECT id FROM tienda WHERE ruc = '20999000001');
  v_elena BIGINT;
  v_otra BIGINT;
  v_prod BIGINT;
  v_fh TIMESTAMP;
  v_desfase INT := 0;
  v_base INT;
  v_fallos TEXT;
BEGIN
  v_luis := (SELECT id FROM cliente WHERE tienda_id = v_tienda AND dni = '45872316');
  v_maria := (SELECT id FROM cliente WHERE tienda_id = v_tienda AND nombres = 'María' AND apellidos = 'Huamán');
  v_cuotas := (SELECT id FROM compra WHERE tienda_id = v_tienda AND ticket = 'T-000284');
  v_elena := (SELECT duenio_id FROM tienda WHERE id = v_pelu);

  CREATE TEMP TABLE chequeo (nombre TEXT NOT NULL, esperado NUMERIC(18,2) NOT NULL, obtenido NUMERIC(18,2)) ON COMMIT DROP;

  INSERT INTO chequeo VALUES
    ('filas usuario',        7, (SELECT COUNT(*) FROM usuario)),
    ('filas tienda',         6, (SELECT COUNT(*) FROM tienda)),
    ('filas producto',       13, (SELECT COUNT(*) FROM producto)),
    ('filas cliente',        2, (SELECT COUNT(*) FROM cliente)),
    ('filas compra',         7, (SELECT COUNT(*) FROM compra)),
    ('filas compra_detalle', 19, (SELECT COUNT(*) FROM compra_detalle)),
    ('filas cuota',          3, (SELECT COUNT(*) FROM cuota)),
    ('filas listado_pago',   1, (SELECT COUNT(*) FROM listado_pago)),
    ('filas listado_item',   5, (SELECT COUNT(*) FROM listado_item)),
    ('filas pago',           0, (SELECT COUNT(*) FROM pago)),
    ('filas auditoria',      31, (SELECT COUNT(*) FROM auditoria));

  -- D01 y 6.3m. La suma de monto_lista solo vale en este estado: no define la regla de SU (ver escalaciones).
  INSERT INTO chequeo VALUES
    ('capital por cobrar',   502.72, (SELECT SUM(monto_lista) FROM compra WHERE tienda_id = v_tienda AND estado = 'PENDIENTE')),
    ('SU Luis',              244.92, (SELECT SUM(monto_lista) FROM compra WHERE cliente_id = v_luis AND estado = 'PENDIENTE')),
    ('uso Luis',              49.00, (SELECT round(SUM(c.monto_lista) * 100 / MAX(cl.limite_credito), 1) FROM compra c JOIN cliente cl ON cl.id = c.cliente_id WHERE c.cliente_id = v_luis AND c.estado = 'PENDIENTE')),
    ('disponible Luis',      255.08, (SELECT MAX(cl.limite_credito) - SUM(c.monto_lista) FROM compra c JOIN cliente cl ON cl.id = c.cliente_id WHERE c.cliente_id = v_luis AND c.estado = 'PENDIENTE')),
    ('SU María',             257.80, (SELECT SUM(monto_lista) FROM compra WHERE cliente_id = v_maria AND estado = 'PENDIENTE')),
    ('uso María',             43.00, (SELECT round(SUM(c.monto_lista) * 100 / MAX(cl.limite_credito), 1) FROM compra c JOIN cliente cl ON cl.id = c.cliente_id WHERE c.cliente_id = v_maria AND c.estado = 'PENDIENTE')),
    ('disponible María',     342.20, (SELECT MAX(cl.limite_credito) - SUM(c.monto_lista) FROM compra c JOIN cliente cl ON cl.id = c.cliente_id WHERE c.cliente_id = v_maria AND c.estado = 'PENDIENTE')),
    ('cobro próximo',        228.42, (SELECT SUM(total) FROM listado_pago WHERE tienda_id = v_tienda AND estado = 'EMITIDO')),
    ('intereses del ciclo',    4.80, (SELECT SUM(total_interes) FROM listado_pago WHERE tienda_id = v_tienda AND estado = 'EMITIDO')),
    ('cartera en mora',        0.00, (SELECT COALESCE(SUM(total), 0) FROM listado_pago WHERE tienda_id = v_tienda AND estado = 'VENCIDO')),
    ('VAN acumulado',         20.01, (SELECT SUM(van) FROM compra WHERE tienda_id = v_tienda AND modalidad = 'CUOTAS'));

  -- Tablas 16, 19 y 20.
  INSERT INTO chequeo VALUES
    ('listado capital',      223.62, (SELECT total_capital FROM listado_pago WHERE tienda_id = v_tienda AND numero = 'EC-202609-00001')),
    ('listado suma ítems',   228.42, (SELECT SUM(i.total) FROM listado_item i JOIN listado_pago l ON l.id = i.listado_id WHERE l.tienda_id = v_tienda)),
    ('cuotas interés',        18.69, (SELECT SUM(interes) FROM cuota WHERE compra_id = v_cuotas)),
    ('cuotas amortización',  261.07, (SELECT SUM(amortizacion) FROM cuota WHERE compra_id = v_cuotas)),
    ('cuotas suma',          279.76, (SELECT SUM(monto) FROM cuota WHERE compra_id = v_cuotas)),
    ('cuota 3 saldo final',    0.00, (SELECT saldo_final FROM cuota WHERE compra_id = v_cuotas AND numero = 3)),
    ('intereses totales',     21.96, (SELECT SUM(q.monto) - MAX(c.monto_lista) FROM cuota q JOIN compra c ON c.id = q.compra_id WHERE c.id = v_cuotas));

  -- Coherencia del detalle y del ciclo.
  INSERT INTO chequeo VALUES
    ('compras con lista distinta del detalle', 0, (SELECT COUNT(*) FROM compra c WHERE c.tienda_id = v_tienda AND c.monto_lista <> (SELECT SUM(d.subtotal) FROM compra_detalle d WHERE d.compra_id = c.id))),
    ('compras con contado distinto del detalle', 0, (SELECT COUNT(*) FROM compra c WHERE c.tienda_id = v_tienda AND c.monto_contado <> (SELECT SUM(round(d.cantidad * d.precio_contado, 2)) FROM compra_detalle d WHERE d.compra_id = c.id))),
    ('T-000301 fecha de pago', 20261026, (SELECT to_char(fecha_pago, 'YYYYMMDD')::int FROM compra WHERE tienda_id = v_tienda AND ticket = 'T-000301')),
    ('T-000301 en listados', 0, (SELECT COUNT(*) FROM listado_item i JOIN compra c ON c.id = i.compra_id WHERE c.tienda_id = v_tienda AND c.ticket = 'T-000301')),
    ('auditoría ALTA sin usuario', 1, (SELECT COUNT(*) FROM auditoria WHERE tienda_id = v_tienda AND accion = 'ALTA' AND usuario_id IS NULL)),
    ('auditoría ALTA de la tienda', 1, (SELECT COUNT(*) FROM auditoria WHERE accion = 'ALTA' AND tabla = 'tienda' AND registro_id = v_tienda)),
    ('auditoría RECHAZO sin registro', 1, (SELECT COUNT(*) FROM auditoria WHERE tienda_id = v_tienda AND accion = 'RECHAZO' AND registro_id IS NULL)),
    ('Luis activado', 1, (SELECT COUNT(*) FROM cliente WHERE id = v_luis AND usuario_id IS NOT NULL AND codigo_activacion IS NULL)),
    ('María sin activar', 1, (SELECT COUNT(*) FROM cliente WHERE id = v_maria AND usuario_id IS NULL AND codigo_activacion = 'MDR-7K2Q')),
    ('acentos: ñ guardada', 1, (SELECT COUNT(*) FROM tienda WHERE id = v_tienda AND position(chr(241) IN nombre_comercial) > 0)),
    ('acentos: á guardada', 1, (SELECT COUNT(*) FROM cliente WHERE id = v_maria AND position(chr(225) IN apellidos) > 0)),
    ('hora de corte fija', 2, (SELECT COUNT(*) FROM cliente WHERE tienda_id = v_tienda AND hora_corte = '17:00:00')),
    ('T-000284 registro', 202609151035, (SELECT to_char(fecha_hora, 'YYYYMMDDHH24MI')::bigint FROM compra WHERE id = v_cuotas)),
    ('T-000284 corte', 20260920, (SELECT to_char(fecha_corte, 'YYYYMMDD')::int FROM compra WHERE id = v_cuotas)),
    ('T-000284 pago', 20260926, (SELECT to_char(fecha_pago, 'YYYYMMDD')::int FROM compra WHERE id = v_cuotas)),
    ('TEA de Luis', 45.00, (SELECT valor_tasa * 100 FROM cliente WHERE id = v_luis AND tipo_tasa = 'EFECTIVA' AND plazo_tasa = 360 AND capitalizacion IS NULL)),
    ('mora de Luis', 10.00, (SELECT valor_tasa_mora * 100 FROM cliente WHERE id = v_luis AND tipo_tasa_mora = 'EFECTIVA')),
    ('TNA de María', 42.00, (SELECT valor_tasa * 100 FROM cliente WHERE id = v_maria AND tipo_tasa = 'NOMINAL' AND plazo_tasa = 360 AND capitalizacion = 30)),
    ('mora de María', 12.00, (SELECT valor_tasa_mora * 100 FROM cliente WHERE id = v_maria AND tipo_tasa_mora = 'EFECTIVA')),
    ('COK de la tienda', 20.00, (SELECT cok_tea * 100 FROM tienda WHERE id = v_tienda)),
    ('giro de la tienda', 1, (SELECT COUNT(*) FROM tienda WHERE id = v_tienda AND giro = 'Minimarket')),
    ('teléfono de la tienda', 1, (SELECT COUNT(*) FROM tienda WHERE id = v_tienda AND telefono IS NOT NULL)),
    ('columna pago.numero_operacion', 30, (SELECT character_maximum_length FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pago' AND column_name = 'numero_operacion'));

  -- Tiendas de demostración (decisión de Adrián): A02 a A05 no salen vacías y no tocan los juegos.
  INSERT INTO chequeo VALUES
    ('productos de Doña Rosa', 9, (SELECT COUNT(*) FROM producto WHERE tienda_id = v_tienda)),
    ('tiendas de demostración', 5, (SELECT COUNT(*) FROM tienda WHERE ruc IN ('20999000001', '20999000002', '20999000003', '20999000004', '20999000005'))),
    ('tiendas activas', 5, (SELECT COUNT(*) FROM tienda WHERE estado = 'ACTIVO')),
    ('meses con alta de tienda', 6, (SELECT COUNT(DISTINCT to_char(fecha_hora, 'YYYY-MM')) FROM auditoria WHERE accion = 'ALTA' AND tabla = 'tienda')),
    ('filas ALTA tienda', 6, (SELECT COUNT(*) FROM auditoria WHERE accion = 'ALTA' AND tabla = 'tienda')),
    ('Peluquería Estilo INACTIVO', 1, (SELECT COUNT(*) FROM tienda WHERE id = v_pelu AND nombre_comercial = 'Peluquería Estilo' AND estado = 'INACTIVO')),
    ('Peluquería Estilo: BAJA tienda', 1, (SELECT COUNT(*) FROM auditoria WHERE accion = 'BAJA' AND tabla = 'tienda' AND registro_id = v_pelu)),
    ('dueña de Peluquería Estilo INACTIVO', 1, (SELECT COUNT(*) FROM usuario WHERE id = v_elena AND estado = 'INACTIVO')),
    ('dueña de Peluquería Estilo: BAJA usuario', 1, (SELECT COUNT(*) FROM auditoria WHERE accion = 'BAJA' AND tabla = 'usuario' AND registro_id = v_elena)),
    ('clientes fuera de Doña Rosa', 0, (SELECT COUNT(*) FROM cliente WHERE tienda_id <> v_tienda)),
    ('compras fuera de Doña Rosa', 0, (SELECT COUNT(*) FROM compra WHERE tienda_id <> v_tienda)),
    ('listados fuera de Doña Rosa', 0, (SELECT COUNT(*) FROM listado_pago WHERE tienda_id <> v_tienda)),
    ('usuarios activos', 6, (SELECT COUNT(*) FROM usuario WHERE estado = 'ACTIVO')),
    ('filas LOGIN', 8, (SELECT COUNT(*) FROM auditoria WHERE accion = 'LOGIN'));

  v_base := (SELECT COUNT(*) FROM chequeo);

  -- Hora por defecto de la auditoría: debe ser la de Lima (UTC-5). La inserción se revierte.
  BEGIN
    INSERT INTO auditoria (accion, tabla) VALUES ('LOGIN', 'usuario') RETURNING fecha_hora INTO v_fh;
    v_desfase := abs(round(extract(epoch FROM (v_fh - ((now() AT TIME ZONE 'UTC') - interval '5 hours'))) / 60))::int;
    RAISE EXCEPTION 'reversion' USING ERRCODE = 'VP999';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> 'VP999' THEN RAISE; END IF;
  END;
  INSERT INTO chequeo VALUES ('auditoría con hora de Lima (minutos de desfase)', 0, CASE WHEN v_desfase <= 1 THEN 0 ELSE v_desfase END);
  v_base := v_base + 1;

  -- Pruebas negativas: cada operación debe ser rechazada por la causa esperada. Todo se revierte (VP999).
  BEGIN
    UPDATE auditoria SET detalle = 'alterado';
    RAISE EXCEPTION 'reversion' USING ERRCODE = 'VP999';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'VP999' THEN INSERT INTO chequeo VALUES ('negativa: UPDATE de auditoría', 0, 1);
    ELSIF SQLSTATE <> 'VP001' THEN INSERT INTO chequeo VALUES ('negativa: UPDATE de auditoría, causa inesperada', 0, 1); END IF;
  END;

  BEGIN
    DELETE FROM auditoria;
    RAISE EXCEPTION 'reversion' USING ERRCODE = 'VP999';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'VP999' THEN INSERT INTO chequeo VALUES ('negativa: DELETE de auditoría', 0, 1);
    ELSIF SQLSTATE <> 'VP001' THEN INSERT INTO chequeo VALUES ('negativa: DELETE de auditoría, causa inesperada', 0, 1); END IF;
  END;

  BEGIN
    INSERT INTO tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, cok_tea)
    SELECT duenio_id, '20000000001', 'Otra', 'Otra', 'Otro', 0.2 FROM tienda WHERE id = v_tienda
    RETURNING id INTO v_otra;
    INSERT INTO producto (tienda_id, codigo, nombre, unidad, precio_contado, precio_lista, permite_fin_mes, permite_cuotas)
    VALUES (v_otra, 'X1', 'Ajeno', 'UND', 1.00, 1.00, TRUE, FALSE) RETURNING id INTO v_prod;
    INSERT INTO compra_detalle (compra_id, producto_id, cantidad, precio_lista, precio_contado, subtotal)
    VALUES (v_cuotas, v_prod, 1, 1.00, 1.00, 1.00);
    RAISE EXCEPTION 'reversion' USING ERRCODE = 'VP999';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'VP999' THEN INSERT INTO chequeo VALUES ('negativa: detalle con producto de otra tienda', 0, 1);
    ELSIF SQLSTATE <> 'VP002' THEN INSERT INTO chequeo VALUES ('negativa: detalle de otra tienda, causa inesperada', 0, 1); END IF;
  END;

  BEGIN
    INSERT INTO tienda (duenio_id, ruc, razon_social, nombre_comercial, giro, cok_tea)
    SELECT duenio_id, '20000000002', 'Otra', 'Otra', 'Otro', 0.2 FROM tienda WHERE id = v_tienda
    RETURNING id INTO v_otra;
    INSERT INTO compra (tienda_id, cliente_id, ticket, fecha_hora, modalidad, monto_lista, monto_contado, fecha_corte, fecha_pago)
    VALUES (v_otra, v_luis, 'X-1', '2026-09-01T10:00:00', 'FIN_MES', 1.00, 1.00, '2026-09-20', '2026-09-26');
    RAISE EXCEPTION 'reversion' USING ERRCODE = 'VP999';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'VP999' THEN INSERT INTO chequeo VALUES ('negativa: compra con cliente de otra tienda', 0, 1);
    ELSIF SQLERRM NOT LIKE '%fk_compra_cliente%' THEN INSERT INTO chequeo VALUES ('negativa: compra de otra tienda, causa inesperada', 0, 1); END IF;
  END;

  BEGIN
    INSERT INTO cuota (compra_id, numero, fecha_vencimiento, saldo_inicial, interes, amortizacion, monto, saldo_final)
    VALUES (v_cuotas, 9, '2027-06-26', 10.00, 1.00, 1.00, 3.00, 9.00);
    RAISE EXCEPTION 'reversion' USING ERRCODE = 'VP999';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'VP999' THEN INSERT INTO chequeo VALUES ('negativa: cuota descuadrada', 0, 1);
    ELSIF SQLERRM NOT LIKE '%ck_cuota_monto%' THEN INSERT INTO chequeo VALUES ('negativa: cuota descuadrada, causa inesperada', 0, 1); END IF;
  END;

  BEGIN
    INSERT INTO listado_pago (tienda_id, cliente_id, numero, fecha_corte, fecha_pago, total_capital, total_interes, total_mora, total)
    VALUES (v_tienda, v_luis, 'EC-DUPLICADO', '2026-09-20', '2026-09-26', 1.00, 0.00, 0.00, 1.00);
    RAISE EXCEPTION 'reversion' USING ERRCODE = 'VP999';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'VP999' THEN INSERT INTO chequeo VALUES ('negativa: segundo listado del mismo corte', 0, 1);
    ELSIF SQLERRM NOT LIKE '%uq_listado_cliente_corte%' THEN INSERT INTO chequeo VALUES ('negativa: segundo listado, causa inesperada', 0, 1); END IF;
  END;

  BEGIN
    INSERT INTO listado_item (listado_id, cuota_id, orden, tipo, fecha, dias, capital, interes, mora, total)
    SELECT l.id, q.id, 99, 'CUOTA', q.fecha_vencimiento, 30, q.amortizacion, q.interes, 0.00, q.monto
    FROM listado_pago l
    CROSS JOIN cuota q
    WHERE l.tienda_id = v_tienda AND l.numero = 'EC-202609-00001' AND q.compra_id = v_cuotas AND q.numero = 1;
    RAISE EXCEPTION 'reversion' USING ERRCODE = 'VP999';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'VP999' THEN INSERT INTO chequeo VALUES ('negativa: ítem de otro cliente en el listado', 0, 1);
    ELSIF SQLSTATE <> 'VP003' THEN INSERT INTO chequeo VALUES ('negativa: ítem de otro cliente, causa inesperada', 0, 1); END IF;
  END;

  -- Plataforma (PostgreSQL): UTF-8, comparación sin distinguir mayúsculas y zona horaria de Lima.
  INSERT INTO chequeo VALUES
    ('plataforma: base en UTF-8', 1, (SELECT COUNT(*) FROM pg_database WHERE datname = current_database() AND pg_encoding_to_char(encoding) = 'UTF8')),
    ('plataforma: ILIKE con ñ', 1, (SELECT COUNT(*) FROM (SELECT 'Doña'::text AS x) t WHERE x ILIKE 'DOÑA')),
    ('plataforma: usuario en mayúsculas (citext)', 1, (SELECT COUNT(*) FROM usuario WHERE username = 'ROSA@VECINOPAY.TEST')),
    ('plataforma: zona America/Lima', 1, (SELECT COUNT(*) FROM pg_timezone_names WHERE name = 'America/Lima'));

  v_fallos := (
    SELECT left(string_agg(nombre || ': esperado ' || esperado || ', obtenido ' || COALESCE(obtenido::text, 'NULL'), '; '), 1900)
    FROM chequeo
    WHERE obtenido IS NULL OR obtenido <> esperado
  );

  IF v_fallos IS NOT NULL THEN
    RAISE EXCEPTION 'Verificación fallida: %', v_fallos;
  END IF;

  RAISE NOTICE 'Semillas verificadas: % chequeos del informe, 4 de plataforma y 7 pruebas negativas sin diferencias.', v_base;
END
$verificar$;
