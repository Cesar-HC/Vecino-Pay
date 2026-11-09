// Prueba de concepto de Prisma sobre el esquema real (diseño de fase 3, paso 0: S2 a S9).
// Corre con vecinopay_app, por eso también cubre S9.
import { Prisma, PrismaClient } from '@prisma/client';

jest.setTimeout(30000);

const prisma = new PrismaClient();
const unico = String(Date.now()).slice(-8);
let tiendaId: bigint;
let otraTiendaId: bigint;
let clienteId: bigint;
let productoId: bigint;
let productoAjenoId: bigint;

const datosCliente = (tienda: bigint, dni: string) => ({
  tienda_id: tienda,
  dni,
  nombres: 'Prueba',
  apellidos: 'Prisma',
  limite_credito: '9999999999.99',
  max_meses: 3,
  dia_corte: 20,
  dia_pago: 26,
  tipo_tasa: 'EFECTIVA',
  valor_tasa: '0.450000000',
  plazo_tasa: 360,
  tipo_tasa_mora: 'EFECTIVA',
  valor_tasa_mora: '0.100000000',
  ted: '0.001032653810255',
  ted_mora: '0.000264785548963',
});

const datosProducto = (tienda: bigint, codigo: string) => ({
  tienda_id: tienda,
  codigo,
  nombre: 'Producto de prueba',
  unidad: 'UND',
  precio_contado: '1.00',
  precio_lista: '1.10',
  permite_fin_mes: true,
  permite_cuotas: true,
});

const datosCompra = (ticket: string) => ({
  tienda_id: tiendaId,
  cliente_id: clienteId,
  ticket,
  fecha_hora: new Date('2026-08-29T18:40:00.000Z'),
  modalidad: 'FIN_MES',
  monto_lista: '9999999999.99',
  monto_contado: '9999999999.99',
  fecha_corte: new Date('2026-09-20T00:00:00.000Z'),
  fecha_pago: new Date('2026-09-26T00:00:00.000Z'),
});

beforeAll(async () => {
  const rosa = await prisma.usuario.findFirstOrThrow({ where: { username: 'rosa@vecinopay.test' } });
  const crearTienda = (ruc: string) =>
    prisma.tienda.create({
      data: {
        duenio_id: rosa.id,
        ruc,
        razon_social: 'Prueba',
        nombre_comercial: 'Prueba',
        giro: 'Minimarket',
        cok_tea: '0.200000000',
      },
    });
  tiendaId = (await crearTienda(`10${unico}1`)).id;
  otraTiendaId = (await crearTienda(`10${unico}2`)).id;
  clienteId = (await prisma.cliente.create({ data: datosCliente(tiendaId, unico) })).id;
  productoId = (await prisma.producto.create({ data: datosProducto(tiendaId, `P${unico}`) })).id;
  productoAjenoId = (await prisma.producto.create({ data: datosProducto(otraTiendaId, `P${unico}`) })).id;
});

afterAll(() => prisma.$disconnect());

describe('paso 0: Prisma sobre PostgreSQL', () => {
  it('S2: decimales exactos', async () => {
    const c = await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    expect(c.ted.toFixed()).toBe('0.001032653810255');
    expect(c.limite_credito.toFixed(2)).toBe('9999999999.99');
    const compra = await prisma.compra.create({
      data: {
        ...datosCompra(`S2-${unico}`),
        modalidad: 'CUOTAS',
        num_cuotas: 3,
        dias_gracia: 11,
        capital_capitalizado: '261.07',
        tem: '0.034999999999986',
        cuota_fija: '93.25',
        tcea: '0.5108647287',
        van: '20.01',
      },
    });
    const leida = await prisma.compra.findUniqueOrThrow({ where: { id: compra.id } });
    expect(leida.tcea?.toFixed()).toBe('0.5108647287');
    expect(leida.tem?.toFixed()).toBe('0.034999999999986');
  });

  it('S3: fechas sin corrimiento', async () => {
    const compra = await prisma.compra.create({ data: datosCompra(`S3-${unico}`) });
    const leida = await prisma.compra.findUniqueOrThrow({ where: { id: compra.id } });
    expect(leida.fecha_hora.toISOString()).toBe('2026-08-29T18:40:00.000Z');
    expect(leida.fecha_corte.toISOString()).toBe('2026-09-20T00:00:00.000Z');
    const auditoria = await prisma.auditoria.create({
      data: { fecha_hora: new Date('2026-09-26T17:00:00.900Z'), accion: 'ALTA', tabla: 'compra', detalle: 'S3' },
    });
    const a = await prisma.auditoria.findUniqueOrThrow({ where: { id: auditoria.id } });
    expect(a.fecha_hora.toISOString()).toBe('2026-09-26T17:00:00.900Z');
  });

  it('S4: hora_corte toma el DEFAULT y se puede leer', async () => {
    const c = await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    expect(c.hora_corte.toISOString().slice(11, 19)).toBe('17:00:00');
  });

  it('S5: createMany con trigger pasa y el trigger sigue rechazando; create se registra', async () => {
    const compra = await prisma.compra.create({ data: datosCompra(`S5-${unico}`) });
    const fila = {
      compra_id: compra.id,
      producto_id: productoId,
      cantidad: '1.000',
      precio_lista: '1.10',
      precio_contado: '1.00',
      subtotal: '1.10',
    };
    await expect(prisma.compra_detalle.createMany({ data: [fila] })).resolves.toEqual({ count: 1 });
    await expect(prisma.compra_detalle.createMany({ data: [{ ...fila, producto_id: productoAjenoId }] })).rejects.toThrow(
      /misma tienda/i,
    );
    const conCreate = await prisma.compra_detalle.create({ data: fila }).then(
      () => 'pasa',
      (e: Error) => `falla: ${e.message.split('\n').pop()}`,
    );
    console.log(`S5, create en compra_detalle: ${conCreate}`);
  });

  it('S6: create en auditoria', async () => {
    const a = await prisma.auditoria.create({ data: { accion: 'ALTA', tabla: 'compra', detalle: 'S6' } });
    expect(a.id).toBeGreaterThan(0n);
  });

  it('S7: createMany de un ítem de mora', async () => {
    const listado = await prisma.listado_pago.create({
      data: {
        tienda_id: tiendaId,
        cliente_id: clienteId,
        numero: `EC-${unico}`,
        fecha_corte: new Date('2026-09-20T00:00:00.000Z'),
        fecha_pago: new Date('2026-09-26T00:00:00.000Z'),
        total_capital: '0.00',
        total_interes: '0.00',
        total_mora: '0.06',
        total: '0.06',
      },
    });
    const r = await prisma.listado_item.createMany({
      data: [
        {
          listado_id: listado.id,
          orden: 1,
          tipo: 'MORA',
          fecha: new Date('2026-09-27T00:00:00.000Z'),
          dias: 1,
          capital: '0.00',
          interes: '0.00',
          mora: '0.06',
          total: '0.06',
        },
      ],
    });
    expect(r.count).toBe(1);
  });

  it('S8: extensión dentro de una transacción y FOR NO KEY UPDATE que hace esperar', async () => {
    const ambito = prisma.$extends({
      query: {
        cliente: {
          findMany({ args, query }) {
            args.where = { ...args.where, tienda_id: otraTiendaId };
            return query(args);
          },
        },
      },
    });
    const vistos = await ambito.$transaction(async (tx) => tx.cliente.findMany({ where: { id: clienteId } }));
    expect(vistos).toHaveLength(0);

    const bloqueo = (t: Prisma.TransactionClient) =>
      t.$queryRaw`SELECT id FROM cliente WHERE id = ${clienteId} FOR NO KEY UPDATE`;
    let soltar: () => void = () => undefined;
    let avisar: () => void = () => undefined;
    const tomado = new Promise<void>((r) => (avisar = r));
    const primera = prisma.$transaction(async (tx) => {
      await bloqueo(tx);
      avisar();
      await new Promise<void>((r) => (soltar = r));
    });
    await tomado;
    const inicio = Date.now();
    const segunda = prisma.$transaction(async (tx) => {
      await bloqueo(tx);
      return Date.now() - inicio;
    });
    setTimeout(() => soltar(), 800);
    const [espera] = await Promise.all([segunda, primera]);
    expect(espera).toBeGreaterThanOrEqual(700);
  });

  it('S9: el usuario de la API no borra ni altera la auditoría', async () => {
    const filas = await prisma.auditoria.count();
    await expect(prisma.$executeRawUnsafe('TRUNCATE TABLE auditoria')).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe('DELETE FROM auditoria')).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe("UPDATE auditoria SET detalle = 'x'")).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe('ALTER TABLE auditoria DISABLE TRIGGER tr_auditoria_solo_insercion')).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe('DELETE FROM producto')).rejects.toThrow();
    expect(await prisma.auditoria.count()).toBe(filas);
  });
});
