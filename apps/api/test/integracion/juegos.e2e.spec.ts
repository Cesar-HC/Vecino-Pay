// Recorrido de punta a punta de 6.4 por HTTP (diseño de fase 3, 13.3). Cifras al céntimo, texto exacto.
import { dniUnico, LUIS, MARIA, Prueba } from '../apoyo/app';

jest.setTimeout(120000);

const p = new Prueba();
let dueno: string;
let admin: string;
let productos: Record<string, string>;

const compra = (clienteId: string, items: [string, string][], extra: object = {}) => ({
  clienteId,
  modalidad: 'FIN_MES',
  items: items.map(([codigo, cantidad]) => ({ productoId: productos[codigo], cantidad })),
  ...extra,
});

/** Las cinco compras del Juego 1 en orden cronológico. */
const CICLO_LUIS: [string, [string, string][], string][] = [
  ['2026-08-22T09:15:00', [['P001', '2.350'], ['P002', '1']], '44.20'],
  ['2026-08-29T18:40:00', [['P003', '2'], ['P004', '4']], '32.80'],
  ['2026-09-05T11:05:00', [['P002', '1'], ['P001', '1.530'], ['P003', '1'], ['P005', '1']], '63.82'],
  ['2026-09-12T19:30:00', [['P005', '1'], ['P004', '3'], ['P006', '1']], '30.50'],
  ['2026-09-18T08:50:00', [['P002', '1'], ['P001', '2.250'], ['P006', '1'], ['P007', '1']], '52.30'],
];

async function clienteConCiclo() {
  const c = (await p.post('/clientes', dueno, LUIS(dniUnico())).expect(201)).body;
  for (const [hora, items, monto] of CICLO_LUIS) {
    p.reloj.fijar(hora);
    const r = await p.post('/compras', dueno, compra(c.id, items)).expect(201);
    expect(r.body.montoLista).toBe(monto);
  }
  return c.id as string;
}

async function cortar(hora: string) {
  p.reloj.fijar(hora);
  return (await p.post('/cortes/ejecutar', admin).expect(200)).body;
}

async function listadoDe(clienteId: string) {
  const l = await p.get(`/listados?clienteId=${clienteId}`, dueno).expect(200);
  return l.body.items as { id: string; total: string; estado: string; fechaCorte: string }[];
}

beforeAll(async () => {
  await p.iniciar();
  p.reloj.fijar('2026-08-01T10:00:00');
  admin = await p.admin();
  const t = await p.crearTienda('Tienda Juego', admin, await p.rosa());
  dueno = t.token;
  productos = t.productos;
});

afterAll(() => p.cerrar());

describe('Juego 1 (T16, T17)', () => {
  let luis: string;
  let listado: string;

  it('registra las compras con su fecha operativa y ciclo', async () => {
    luis = (await p.post('/clientes', dueno, LUIS(dniUnico())).expect(201)).body.id;
    const cliente = await p.get(`/clientes/${luis}`, dueno).expect(200);
    expect(cliente.body.ted).toBe('0.001032653810255');
    expect(cliente.body.tedMora).toBe('0.000264785548963');

    p.reloj.fijar(CICLO_LUIS[0][0]);
    const primera = await p.post('/compras', dueno, compra(luis, CICLO_LUIS[0][1])).expect(201);
    expect(primera.body).toMatchObject({ montoLista: '44.20', fechaOperativa: '2026-08-22', fechaPago: '2026-09-26' });

    p.reloj.fijar(CICLO_LUIS[1][0]);
    const segunda = await p.post('/compras', dueno, compra(luis, CICLO_LUIS[1][1])).expect(201);
    expect(segunda.body).toMatchObject({ montoLista: '32.80', fechaOperativa: '2026-08-30' });

    p.reloj.fijar(CICLO_LUIS[2][0]);
    await p.post('/compras', dueno, compra(luis, CICLO_LUIS[2][1])).expect(201);
    p.reloj.fijar(CICLO_LUIS[3][0]);
    const cuarta = await p.post('/compras', dueno, compra(luis, CICLO_LUIS[3][1])).expect(201);
    expect(cuarta.body).toMatchObject({ montoLista: '30.50', fechaOperativa: '2026-09-13' });
    p.reloj.fijar(CICLO_LUIS[4][0]);
    await p.post('/compras', dueno, compra(luis, CICLO_LUIS[4][1])).expect(201);
  });

  it('rechaza la compra de 999.00 por límite, sin registrarla, con 276.38 en el mensaje', async () => {
    p.reloj.fijar('2026-09-19T10:00:00');
    const antes = (await p.get(`/compras?clienteId=${luis}`, dueno)).body.total;
    const rechazos = await p.bd.auditoria.count({ where: { accion: 'RECHAZO', tabla: 'compra' } });
    const r = await p.post('/compras', dueno, compra(luis, [['P003', '99.900']])).expect(422);
    expect(r.body.codigo).toBe('LIMITE_EXCEDIDO');
    expect(r.body.mensaje).toContain('276.38');
    expect((await p.get(`/compras?clienteId=${luis}`, dueno)).body.total).toBe(antes);
    expect(await p.bd.auditoria.count({ where: { accion: 'RECHAZO', tabla: 'compra' } })).toBe(rechazos + 1);
  });

  it('a las 17:00:00 aún no hay corte; a las 17:00:01 emite el listado de 228.42', async () => {
    p.reloj.fijar('2026-09-20T17:00:00');
    const no = await p.post('/cortes/ejecutar', admin).expect(409);
    expect(no.body.codigo).toBe('CORTE_NO_DISPONIBLE');

    await cortar('2026-09-20T17:00:01');
    const [l] = await listadoDe(luis);
    listado = l.id;
    const d = (await p.get(`/listados/${l.id}`, dueno).expect(200)).body;
    expect([d.totalCapital, d.totalInteres, d.total]).toEqual(['223.62', '4.80', '228.42']);
    expect(d.items.map((i: { dias: number }) => i.dias)).toEqual([35, 27, 21, 13, 8]);
    expect(d.items.map((i: { interes: string }) => i.interes)).toEqual(['1.63', '0.93', '1.40', '0.41', '0.43']);
    expect(d.items.map((i: { total: string }) => i.total)).toEqual(['45.83', '33.73', '65.22', '30.91', '52.73']);
    expect(d.items.map((i: { posteriorAlCorte: boolean }) => i.posteriorAlCorte)).toEqual([false, true, false, true, false]);
    // D06: el detalle de cada compra.
    expect(d.items[0].detalle.map((x: { codigo: string; cantidad: string }) => [x.codigo, x.cantidad])).toEqual([['P001', '2.350'], ['P002', '1.000']]);
    expect(JSON.stringify(d.items)).not.toContain('recioContado');
  });

  it('repetir el corte no emite ni audita nada', async () => {
    const auditoria = await p.bd.auditoria.count();
    const items = await p.bd.listado_item.count();
    const r = await cortar('2026-09-20T17:00:01');
    expect(r.listadosEmitidos).toEqual([]);
    expect(await p.bd.auditoria.count()).toBe(auditoria);
    expect(await p.bd.listado_item.count()).toBe(items);
  });

  it('la compra de las 17:45 pasa al ciclo siguiente y sale en comprasPosteriores', async () => {
    p.reloj.fijar('2026-09-20T17:45:00');
    const r = await p.post('/compras', dueno, compra(luis, [['P001', '1.300'], ['P004', '3']])).expect(201);
    expect(r.body).toMatchObject({
      montoLista: '21.30',
      fechaOperativa: '2026-09-21',
      fechaCorte: '2026-10-20',
      fechaPago: '2026-10-26',
    });
    const d = (await p.get(`/listados/${listado}`, dueno).expect(200)).body;
    expect(d.items).toHaveLength(5);
    expect(d.comprasPosteriores.map((c: { monto: string }) => c.monto)).toEqual(['21.30']);
  });

  it('al 22/09: SU 244.92, disponible 255.08; valor de hoy al 16/09', async () => {
    p.reloj.fijar('2026-09-22T12:00:00');
    const c = (await p.get(`/clientes/${luis}`, dueno).expect(200)).body;
    expect([c.su, c.disponible]).toEqual(['244.92', '255.08']);
    expect(c.deudaALaFecha).toBe('244.92');
    const v = (await p.get(`/listados/${listado}/valor-hoy?fecha=2026-09-16`, dueno).expect(200)).body;
    expect(v.td).toBe(10);
    expect(v.d.startsWith('0.0102681')).toBe(true);
    expect([v.descuento, v.neto]).toEqual(['2.35', '226.07']);
  });
});

describe('Escenarios de pago (T17)', () => {
  const pagar = (id: string, montoPagado: string) => p.post(`/listados/${id}/pago`, dueno, { montoPagado, medioPago: 'Efectivo' });
  const cicloConListado = async () => {
    const id = await clienteConCiclo();
    await cortar('2026-09-20T17:00:01');
    const [l] = await listadoDe(id);
    return { cliente: id, listado: l.id };
  };

  it.each(['2026-09-26T17:00:00', '2026-09-26T17:00:00.900'])('a las %s no hay mora', async (hora) => {
    const { listado } = await cicloConListado();
    p.reloj.fijar(hora);
    const r = await pagar(listado, '228.42').expect(201);
    expect(r.body.imputacion).toEqual({ mora: '0.00', interes: '4.80', capital: '223.62' });
    expect(r.body.pago.diasMora).toBe(0);
    const d = (await p.get(`/listados/${listado}`, dueno)).body;
    expect(d.items).toHaveLength(5);
    expect(d.diasMora).toBe(0);
  });

  it('26/09 a las 17:30: mora 0.06, pago.fecha real 26/09 e ítem con fecha 27/09', async () => {
    const { listado } = await cicloConListado();
    p.reloj.fijar('2026-09-26T17:30:00');
    const l = (await p.get(`/listados/${listado}/liquidacion`, dueno).expect(200)).body;
    expect([l.diasMora, l.mora, l.totalALaFecha]).toEqual([1, '0.06', '228.48']);
    expect([l.fechaReal, l.horaReal, l.fechaOperativaPago]).toEqual(['2026-09-26', '17:30:00', '2026-09-27']);
    expect(l.imputacion).toEqual({ mora: '0.06', interes: '4.80', capital: '223.62' });
    expect(l.disponibleDespues).toBe('500.00');
    const r = await pagar(listado, '228.48').expect(201);
    expect(r.body.imputacion.mora).toBe('0.06');
    expect(r.body.pago.fecha).toBe('2026-09-26');
    const d = (await p.get(`/listados/${listado}`, dueno)).body;
    expect(d.items[5]).toMatchObject({ orden: 6, tipo: 'MORA', fecha: '2026-09-27', dias: 1, capital: '0.00', interes: '0.00', mora: '0.06', total: '0.06' });
    expect([d.totalMora, d.total, d.estado, d.fechaPagoReal]).toEqual(['0.06', '228.48', 'PAGADO', '2026-09-26']);
    const a = await p.bd.auditoria.findFirstOrThrow({ where: { tabla: 'pago', accion: 'ALTA', detalle: { contains: d.numero } }, orderBy: { id: 'desc' } });
    expect(a.detalle).toContain('"hora":"17:30:00"');
  });

  it('01/10: rechaza 200.00 y 228.73; acepta 228.72 con mora 0.30; disponible 478.70; no se paga dos veces', async () => {
    const { cliente, listado } = await cicloConListado();
    p.reloj.fijar('2026-09-20T17:45:00');
    await p.post('/compras', dueno, compra(cliente, [['P001', '1.300'], ['P004', '3']])).expect(201);
    p.reloj.fijar('2026-10-01T10:00:00');

    expect((await p.get(`/clientes/${cliente}`, dueno)).body.deudaALaFecha).toBe('250.02');
    const parcial = await pagar(listado, '200.00').expect(422);
    expect(parcial.body.codigo).toBe('PAGO_NO_EXACTO');
    expect(parcial.body.mensaje).toContain('228.72');
    await pagar(listado, '228.73').expect(422);
    expect(await p.bd.pago.count({ where: { listado_id: BigInt(listado) } })).toBe(0);

    const r = await pagar(listado, '228.72').expect(201);
    expect(r.body.imputacion).toEqual({ mora: '0.30', interes: '4.80', capital: '223.62' });
    expect(r.body.pago.diasMora).toBe(5);
    expect(r.body.disponible).toBe('478.70');
    const c = (await p.get(`/clientes/${cliente}`, dueno)).body;
    expect(c.disponible).toBe('478.70');
    const d = (await p.get(`/listados/${listado}`, dueno)).body;
    expect(d.items[5]).toMatchObject({ orden: 6, tipo: 'MORA', dias: 5, mora: '0.30' });

    const otra = await pagar(listado, '228.72').expect(409);
    expect(otra.body.codigo).toBe('LISTADO_YA_PAGADO');
  });
});

describe('Juego 2 (T18 a T20, T22)', () => {
  let maria: string;
  let compraId: string;
  const cuerpo = () => compra(maria, [['P012', '1'], ['P013', '1']], { modalidad: 'CUOTAS', numCuotas: 3 });

  it('calcula la TED igual a la semilla, la TEM y la TEA', async () => {
    p.reloj.fijar('2026-09-15T10:00:00');
    const c = (await p.post('/clientes', dueno, MARIA(dniUnico())).expect(201)).body;
    maria = c.id;
    expect(c.ted).toBe('0.001147371952051');
    const t = (await p.post('/clientes/calcular-tasas', dueno, { tasa: MARIA('').tasa }).expect(200)).body;
    expect(t.tem.startsWith('0.03499999')).toBe(true);
    expect(t.tea.startsWith('0.511068')).toBe(true);
  });

  it('el simulador muestra T18 y T20 sin guardar nada', async () => {
    p.reloj.fijar('2026-09-15T10:35:00');
    const compras = await p.bd.compra.count();
    const s = (await p.post('/compras/simular', dueno, cuerpo()).expect(200)).body;
    expect(s.cuotas).toMatchObject({
      g: 11,
      capitalCapitalizado: '261.07',
      interesGracia: '3.27',
      cuotaFija: '93.25',
      ultimaCuota: '93.26',
      tceaPorcentaje: '51.09',
      van: '20.01',
      tirDiaria: '0.0011469966',
      cokTea: '0.200000000',
      sumaValorActual: '269.81',
    });
    expect(s.cuotas.filas.map((f: { t: number }) => f.t)).toEqual([41, 72, 102]);
    expect(s.cuotas.filas.map((f: { valorActual: string }) => f.valorActual)).toEqual(['91.33', '89.91', '88.56']);
    expect(s.lineas).toHaveLength(2);
    expect(await p.bd.compra.count()).toBe(compras);
  });

  it('registra la compra y su cronograma', async () => {
    const r = await p.post('/compras', dueno, cuerpo()).expect(201);
    compraId = r.body.id;
    expect([r.body.montoLista, r.body.montoContado]).toEqual(['257.80', '249.80']);
    const k = (await p.get(`/compras/${compraId}/cronograma`, dueno).expect(200)).body;
    expect(k.filas.map((f: { diasPeriodo: number }) => f.diasPeriodo)).toEqual([30, 31, 30]);
    expect(k.filas.map((f: { monto: string }) => f.monto)).toEqual(['93.25', '93.25', '93.26']);
    expect(k.filas.map((f: { saldoFinal: string }) => f.saldoFinal)).toEqual(['176.96', '90.11', '0.00']);
    expect(k.filas.map((f: { vence: string }) => f.vence)).toEqual(['2026-10-26', '2026-11-26', '2026-12-26']);
    expect(k.filas.map((f: { saldoInicial: string }) => f.saldoInicial)).toEqual(['261.07', '176.96', '90.11']);
    expect(k.filas.map((f: { interes: string }) => f.interes)).toEqual(['9.14', '6.40', '3.15']);
    expect(k.filas.map((f: { amortizacion: string }) => f.amortizacion)).toEqual(['84.11', '86.85', '90.11']);
    expect(k.flujoCaja.filas[0].flujo).toBe('-249.80');
    expect(k.flujoCaja.filas.slice(1).map((f: { t: number }) => f.t)).toEqual([41, 72, 102]);
    expect(k.flujoCaja.cokTea).toBe('0.200000000');
    expect(k.totales).toEqual({ interes: '18.69', amortizacion: '261.07', monto: '279.76' });
    expect(k.resumen).toMatchObject({ interesesTotales: '21.96', tirDiaria: '0.0011469966', tceaPorcentaje: '51.09', van: '20.01' });
    expect(k.flujoCaja.filas.slice(1).map((f: { valorActual: string }) => f.valorActual)).toEqual(['91.33', '89.91', '88.56']);
    expect(k.flujoCaja.sumaValorActual).toBe('269.81');
    expect(k.flujoCaja.cokVigenteCoincide).toBe(true);
  });

  it('deuda a la fecha por HTTP: 261.07 antes de vencer y 270.27 al 28/10', async () => {
    const unaMaria = (await p.post('/clientes', dueno, MARIA(dniUnico())).expect(201)).body.id;
    const deuda = async () => (await p.get(`/clientes/${unaMaria}`, dueno).expect(200)).body;
    p.reloj.fijar('2026-09-15T10:35:00');
    await p.post('/compras', dueno, compra(unaMaria, [['P012', '1'], ['P013', '1']], { modalidad: 'CUOTAS', numCuotas: 3 })).expect(201);
    const antes = await deuda();
    expect([antes.deudaALaFecha, antes.su]).toEqual(['261.07', '257.80']); // P' y no SU, antes de la cuota 1.
    await cortar('2026-10-20T17:00:01');
    p.reloj.fijar('2026-10-22T10:00:00');
    expect((await deuda()).deudaALaFecha).toBe('261.07');
    p.reloj.fijar('2026-10-26T17:00:00');
    expect((await deuda()).deudaALaFecha).toBe('261.07');
    p.reloj.fijar('2026-10-28T10:00:00');
    const vencida = await deuda();
    expect(vencida.deudaALaFecha).toBe('270.27');
    expect(vencida.su).toBe('257.80'); // La deuda no cambia la regla de SU.
    const [l] = await listadoDe(unaMaria);
    await p.post(`/listados/${l.id}/pago`, dueno, { montoPagado: '93.31', medioPago: 'Yape' }).expect(201);
    expect((await deuda()).deudaALaFecha).toBe('176.96');
  });

  it('paga las tres cuotas: 176.96, 90.11 con mora 0.12, y 0.00', async () => {
    const listadoEn = async (fecha: string) =>
      (await listadoDe(maria)).find((l) => l.fechaCorte === fecha) as { id: string };
    const items = async (id: string) => (await p.get(`/listados/${id}`, dueno)).body.items[0];

    const antes = await cortar('2026-09-20T17:00:01');
    expect(antes.listadosEmitidos.filter((l: { clienteId: string }) => l.clienteId === maria)).toEqual([]);

    await cortar('2026-10-20T17:00:01');
    const l1 = await listadoEn('2026-10-20');
    expect(await items(l1.id)).toMatchObject({ tipo: 'CUOTA', capital: '84.11', interes: '9.14', total: '93.25', dias: 30 });
    p.reloj.fijar('2026-10-26T10:00:00');
    await p.post(`/listados/${l1.id}/pago`, dueno, { montoPagado: '93.25', medioPago: 'Yape' }).expect(201);
    const c1 = (await p.get(`/clientes/${maria}`, dueno)).body;
    expect([c1.su, c1.disponible]).toEqual(['176.96', '423.04']);

    await cortar('2026-11-20T17:00:01');
    const l2 = await listadoEn('2026-11-20');
    expect(await items(l2.id)).toMatchObject({ capital: '86.85', interes: '6.40', total: '93.25', dias: 31 });
    p.reloj.fijar('2026-11-30T10:00:00');
    const r2 = await p.post(`/listados/${l2.id}/pago`, dueno, { montoPagado: '93.37', medioPago: 'Efectivo' }).expect(201);
    expect(r2.body.imputacion).toEqual({ mora: '0.12', interes: '6.40', capital: '86.85' });
    expect(r2.body.pago.diasMora).toBe(4);
    expect((await p.get(`/clientes/${maria}`, dueno)).body.su).toBe('90.11');

    await cortar('2026-12-20T17:00:01');
    const l3 = await listadoEn('2026-12-20');
    expect(await items(l3.id)).toMatchObject({ capital: '90.11', interes: '3.15', total: '93.26' });
    p.reloj.fijar('2026-12-26T10:00:00');
    await p.post(`/listados/${l3.id}/pago`, dueno, { montoPagado: '93.26', medioPago: 'Plin' }).expect(201);
    const c3 = (await p.get(`/clientes/${maria}`, dueno)).body;
    expect([c3.su, c3.disponible]).toEqual(['0.00', '600.00']);
    expect((await p.get(`/compras/${compraId}`, dueno)).body.estado).toBe('PAGADA');
  });
});
