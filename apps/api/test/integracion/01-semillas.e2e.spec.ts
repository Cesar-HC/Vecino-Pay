// Estado sembrado al 22/09/2026 (diseño de fase 3, 13.5). Corre sobre las semillas; la activación se consume una vez.
import { Dec, diasEntre, interesCompra } from '@vecinopay/finance';
import { dniUnico, LUIS, Prueba } from '../apoyo/app';

jest.setTimeout(60000);

const p = new Prueba();
beforeAll(async () => {
  await p.iniciar();
  p.reloj.fijar('2026-09-22T12:00:00');
});
afterAll(() => p.cerrar());

describe('estado sembrado', () => {
  it('las tres contraseñas de demo entran contra los hash sembrados', async () => {
    expect(await p.admin()).toBeTruthy();
    expect(await p.rosa()).toBeTruthy();
    expect(await p.login('45872316', 'Vecino#2026', 'CLIENTE')).toBeTruthy();
  });

  it('un perfil equivocado no entra y queda el rechazo en auditoría', async () => {
    const antes = await p.bd.auditoria.count({ where: { accion: 'RECHAZO', tabla: 'usuario' } });
    const r = await p.post('/auth/login', undefined, { username: '45872316', password: 'Vecino#2026', perfil: 'DUENO' }).expect(401);
    expect(r.body.codigo).toBe('CREDENCIALES');
    await p.post('/auth/login', undefined, { username: 'nadie', password: 'x', perfil: 'DUENO' }).expect(401);
    expect(await p.bd.auditoria.count({ where: { accion: 'RECHAZO', tabla: 'usuario' } })).toBe(antes + 2);
  });

  it('D01 de Rosa', async () => {
    const r = (await p.get('/negocio/resumen', await p.rosa()).expect(200)).body;
    const pen = r.porMoneda.PEN;
    expect(pen).toMatchObject({
      capitalPorCobrar: '502.72',
      cobroProximo: { fecha: '2026-09-26', total: '228.42' },
      interesesDelCiclo: '4.80',
      carteraEnMora: '0.00',
      vanAcumulado: '20.01',
    });
    expect(pen.usoLimite.map((u: { usoPorcentaje: string }) => u.usoPorcentaje)).toEqual(['49.0', '43.0']);
    expect(pen.cobrosPorFecha[0]).toEqual({ fecha: '2026-09-26', total: '228.42' });
    // 26/10: T-000301 con su interés proyectado (del motor, no del informe) y la cuota 1 de María.
    const interes = interesCompra('21.30', '0.001032653810255', diasEntre('2026-09-21', '2026-10-26'));
    expect(pen.cobrosPorFecha.slice(1)).toEqual([
      { fecha: '2026-10-26', total: new Dec('21.30').plus(interes).plus('93.25').toFixed(2) },
      { fecha: '2026-11-26', total: '93.25' },
      { fecha: '2026-12-26', total: '93.26' },
    ]);
  });

  it('D06: listado sembrado con sus marcas', async () => {
    const rosa = await p.rosa();
    const lista = (await p.get('/listados', rosa).expect(200)).body.items;
    const l = (await p.get(`/listados/${lista[0].id}`, rosa).expect(200)).body;
    expect(l.numero).toBe('EC-202609-00001');
    expect(l.items.map((i: { ticket: string }) => i.ticket)).toEqual(['T-000231', 'T-000245', 'T-000262', 'T-000278', 'T-000290']);
    const marcados = l.items.filter((i: { posteriorAlCorte: boolean }) => i.posteriorAlCorte).map((i: { ticket: string }) => i.ticket);
    expect(marcados).toEqual(['T-000245', 'T-000278']);
    expect(l.comprasPosteriores.map((c: { ticket: string }) => c.ticket)).toEqual(['T-000301']);
  });

  it('C03 de Luis', async () => {
    const r = (await p.get('/mi/resumen', await p.login('45872316', 'Vecino#2026', 'CLIENTE')).expect(200)).body;
    expect(r.proximoPago).toMatchObject({ total: '228.42', capital: '223.62', interes: '4.80', mora: '0.00', fecha: '2026-09-26', diasRestantes: 4, proyectado: false });
    expect(r.credito).toMatchObject({ limite: '500.00', disponible: '255.08' });
    expect(r.comprasDelCiclo).toBe(5);
  });

  it('A02 del administrador: altas por mes y giro, sin importes', async () => {
    const r = (await p.get('/plataforma/resumen', await p.admin()).expect(200)).body;
    expect(r.altasPorMes).toContainEqual({ mes: '2026-08', cantidad: 1 });
    expect(r.tiendasPorGiro).toContainEqual(expect.objectContaining({ giro: 'Minimarket' }));
  });

  it('C02: María activa una sola vez con su código y se registra la aceptación', async () => {
    const cuerpo = {
      dni: '40000002',
      codigo: 'MDR-7K2Q',
      celular: '999888777',
      password: 'Maria#2026',
      passwordConfirmacion: 'Maria#2026',
      aceptaDatos: true,
    };
    await p.post('/auth/activar', undefined, { ...cuerpo, aceptaDatos: false }).expect(400);
    await p.post('/auth/activar', undefined, { ...cuerpo, codigo: 'MAL-0000' }).expect(400);
    const r = await p.post('/auth/activar', undefined, cuerpo).expect(201);
    expect(r.body.username).toBe('40000002');
    await p.post('/auth/activar', undefined, cuerpo).expect(400);
    const a = await p.bd.auditoria.findFirstOrThrow({ where: { detalle: { contains: 'aceptó el tratamiento' } }, orderBy: { id: 'desc' } });
    expect(a.accion).toBe('ALTA');
  });

  it('C06 de María: cuotas y explicación', async () => {
    const maria = await p.login('40000002', 'Maria#2026', 'CLIENTE');
    const [c] = (await p.get('/mi/cuotas', maria).expect(200)).body.compras;
    expect(c).toMatchObject({ cuotaFija: '93.25', tceaPorcentaje: '51.09' });
    expect(c.proximaCuota.vence).toBe('2026-10-26');
    // C03 sin listado emitido: la próxima cuota, proyectada.
    const resumen = (await p.get('/mi/resumen', maria).expect(200)).body;
    expect(resumen.proximoPago).toMatchObject({ total: '93.25', fecha: '2026-10-26', proyectado: true });
    // Vencido el listado, Luis ve lo que el pago exacto exige hoy.
    p.reloj.fijar('2026-09-27T10:00:00');
    const luis = (await p.get('/mi/resumen', await p.login('45872316', 'Vecino#2026', 'CLIENTE')).expect(200)).body;
    expect(luis.proximoPago).toMatchObject({ mora: '0.06', totalALaFecha: '228.48', diasRestantes: -1 });
    // D01 tras el vencimiento: el próximo cobro ya es el proyectado.
    const d01 = (await p.get('/negocio/resumen', await p.rosa()).expect(200)).body.porMoneda.PEN;
    expect(d01.cobroProximo.fecha).toBe('2026-10-26');
    p.reloj.fijar('2026-09-22T12:00:00');
    expect(c.explicacion).toMatchObject({ g: 11, interesGracia: '3.27' });
  });

  it('C09 de Luis: su compra más antigua como ejemplo', async () => {
    const r = (await p.get('/mi/ayuda/ejemplo', await p.login('45872316', 'Vecino#2026', 'CLIENTE')).expect(200)).body;
    expect(r).toMatchObject({ capital: '44.20', dias: 35, interes: '1.63' });
  });

  it('un DNI ya activado en otra tienda no activa de nuevo y su código no se consume', async () => {
    const admin = await p.admin();
    const t = await p.crearTienda('Otra tienda', admin, await p.rosa());
    const c = (await p.post('/clientes', t.token, LUIS('45872316')).expect(201)).body;
    const r = await p
      .post('/auth/activar', undefined, {
        dni: '45872316',
        codigo: c.codigoActivacion,
        celular: '999888777',
        password: 'Otra#2026a',
        passwordConfirmacion: 'Otra#2026a',
        aceptaDatos: true,
      })
      .expect(409);
    expect(r.body.codigo).toBe('DNI_YA_ACTIVADO');
    const leido = (await p.get(`/clientes/${c.id}`, t.token)).body;
    expect(leido.codigoActivacion).toBe(c.codigoActivacion);
  });

  it('no se cambian condiciones con deuda; sí el límite', async () => {
    const rosa = await p.rosa();
    const luis = (await p.get('/clientes?texto=45872316', rosa)).body.items[0];
    const r = await p.patch(`/clientes/${luis.id}`, rosa, { diaPago: 27 }).expect(409);
    expect(r.body.codigo).toBe('CONDICIONES_CON_DEUDA');
    await p.patch(`/clientes/${luis.id}`, rosa, { limiteCredito: '500.00' }).expect(200);
  });

  it('un monto como number se rechaza', async () => {
    const rosa = await p.rosa();
    await p
      .post('/productos', rosa, {
        codigo: `N${dniUnico()}`,
        nombre: 'x',
        unidad: 'UND',
        precioContado: 1,
        precioLista: '1.00',
        permiteFinMes: true,
        permiteCuotas: false,
      })
      .expect(400);
  });
});
