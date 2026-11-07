// Aislamiento multitienda, cobertura de rutas y auditoría (diseño de fase 3, 13.4 y 13.6).
import { DiscoveryService, Reflector } from '@nestjs/core';
import { Dec, interesCompra } from '@vecinopay/finance';
import { CLAVE_PUBLICO, CLAVE_ROLES } from '../../src/comun/utilidades';
import { dniUnico, LUIS, MARIA, Prueba } from '../apoyo/app';

jest.setTimeout(120000);

const p = new Prueba();
let admin: string;
type Tienda = Awaited<ReturnType<Prueba['crearTienda']>>;
let a: Tienda;
let b: Tienda;
let clienteA: string;
let compraA: string;
let compraCuotasA: string;
let listadoA: string;

// Todas las rutas con :id de operación. La meta-prueba falla si aparece una que no esté aquí.
const RUTAS_CON_ID_DUENO: [string, string, object?][] = [
  ['PATCH', '/productos/:id', { nombre: 'x' }],
  ['PATCH', '/productos/:id/estado', { estado: 'INACTIVO' }],
  ['GET', '/clientes/:id'],
  ['PATCH', '/clientes/:id', { nombres: 'x' }],
  ['PATCH', '/clientes/:id/estado', { estado: 'INACTIVO' }],
  ['GET', '/compras/:id'],
  ['GET', '/compras/:id/cronograma'],
  ['GET', '/listados/:id'],
  ['GET', '/listados/:id/valor-hoy'],
  ['GET', '/listados/:id/liquidacion'],
  ['POST', '/listados/:id/pago', { montoPagado: '228.42', medioPago: 'Efectivo' }],
];
const RUTAS_CON_ID_ADMIN = [
  'PATCH /tiendas/:id',
  'PATCH /tiendas/:id/estado',
  'PATCH /usuarios/:id',
  'POST /usuarios/:id/restablecer-clave',
  'PATCH /usuarios/:id/estado',
];
const RUTAS_CON_ID_CLIENTE = ['GET /mi/listados/:id'];
const PUBLICAS = ['GET /salud', 'POST /auth/login', 'POST /auth/activar'];

// Cada mutación debe dejar auditoría; las de esta lista se comprueban abajo o en juegos.e2e.
const MUTACIONES = [
  'POST /auth/activar',
  'POST /auth/login',
  'POST /auth/cambiar-contrasena',
  'POST /auth/cambiar-tienda', // Solo emite un token: no cambia datos.
  'POST /tiendas',
  'PATCH /tiendas/:id',
  'PATCH /tiendas/:id/estado',
  'POST /usuarios',
  'PATCH /usuarios/:id',
  'POST /usuarios/:id/restablecer-clave',
  'PATCH /usuarios/:id/estado',
  'POST /productos',
  'PATCH /productos/:id',
  'PATCH /productos/:id/estado',
  'POST /clientes',
  'POST /clientes/calcular-tasas', // No guarda.
  'PATCH /clientes/:id',
  'PATCH /clientes/:id/estado',
  'POST /compras',
  'POST /compras/simular', // No guarda.
  'POST /cortes/ejecutar',
  'POST /listados/:id/pago',
];

const llamar = (metodo: string, ruta: string, token: string, cuerpo?: object) =>
  metodo === 'GET'
    ? p.get(ruta, token)
    : metodo === 'POST'
      ? p.post(ruta, token, cuerpo as never)
      : p.patch(ruta, token, cuerpo as never);

beforeAll(async () => {
  await p.iniciar();
  p.reloj.fijar('2026-09-10T10:00:00');
  admin = await p.admin();
  const rosa = await p.rosa();
  a = await p.crearTienda('Tienda A', admin, rosa);
  b = await p.crearTienda('Tienda B', admin, rosa);
  const dni = dniUnico();
  clienteA = (await p.post('/clientes', a.token, LUIS(dni)).expect(201)).body.id;
  await p.post('/clientes', b.token, LUIS(dni)).expect(201); // Mismo DNI en otra tienda.
  compraA = (
    await p
      .post('/compras', a.token, { clienteId: clienteA, modalidad: 'FIN_MES', items: [{ productoId: a.productos.P001, cantidad: '1' }] })
      .expect(201)
  ).body.id;
  const maria = (await p.post('/clientes', a.token, MARIA(dniUnico())).expect(201)).body.id;
  compraCuotasA = (
    await p
      .post('/compras', a.token, {
        clienteId: maria,
        modalidad: 'CUOTAS',
        numCuotas: 3,
        items: [{ productoId: a.productos.P012, cantidad: '1' }],
      })
      .expect(201)
  ).body.id;
  p.reloj.fijar('2026-09-20T17:00:01');
  await p.post('/cortes/ejecutar', admin).expect(200);
  listadoA = (await p.get(`/listados?clienteId=${clienteA}`, a.token).expect(200)).body.items[0].id;
  p.reloj.fijar('2026-09-22T10:00:00');
});

afterAll(() => p.cerrar());

describe('cobertura de rutas', () => {
  const rutas = () => {
    const discovery = p.app.get(DiscoveryService);
    const reflector = p.app.get(Reflector);
    const lista: { firma: string; publico: boolean; roles?: string[] }[] = [];
    const verbos: Record<number, string> = { 0: 'GET', 1: 'POST', 2: 'PUT', 3: 'DELETE', 4: 'PATCH' };
    for (const w of discovery.getControllers()) {
      const clase = w.metatype as new () => object;
      if (!clase || !Reflect.getMetadata('path', clase)) continue;
      const base = String(Reflect.getMetadata('path', clase)).replace(/^\/$/, '');
      for (const nombre of Object.getOwnPropertyNames(clase.prototype)) {
        const h = (clase.prototype as Record<string, () => void>)[nombre];
        const path = Reflect.getMetadata('path', h);
        if (nombre === 'constructor' || path === undefined) continue;
        const sub = String(path).replace(/^\/$/, '');
        const firma = `${verbos[Reflect.getMetadata('method', h)]} /${[base, sub].filter(Boolean).join('/')}`;
        lista.push({
          firma,
          publico: !!reflector.getAllAndOverride(CLAVE_PUBLICO, [h, clase]),
          roles: reflector.getAllAndOverride(CLAVE_ROLES, [h, clase]),
        });
      }
    }
    return lista;
  };

  it('toda ruta es pública declarada o exige un rol', () => {
    const r = rutas();
    expect(r.length).toBeGreaterThan(40);
    for (const x of r) {
      if (x.publico) expect(PUBLICAS).toContain(x.firma);
      else expect({ firma: x.firma, tieneRoles: !!x.roles?.length }).toEqual({ firma: x.firma, tieneRoles: true });
    }
  });

  it('toda ruta con parámetro está en la matriz de aislamiento', () => {
    const conocidas = [...RUTAS_CON_ID_DUENO.map(([m, r]) => `${m} ${r}`), ...RUTAS_CON_ID_ADMIN, ...RUTAS_CON_ID_CLIENTE];
    const conId = rutas().filter((x) => x.firma.includes(':')).map((x) => x.firma);
    expect(conId.sort()).toEqual(conocidas.sort());
  });

  it('toda mutación está en la matriz de auditoría', () => {
    const mutan = rutas().filter((x) => !x.firma.startsWith('GET')).map((x) => x.firma);
    expect(mutan.sort()).toEqual([...MUTACIONES].sort());
  });
});

describe('aislamiento entre tiendas', () => {
  const idDe = (ruta: string) => {
    if (ruta.startsWith('/productos')) return a.productos.P001;
    if (ruta.startsWith('/clientes')) return clienteA;
    if (ruta.includes('cronograma')) return compraCuotasA;
    if (ruta.startsWith('/compras')) return compraA;
    return listadoA;
  };

  it.each(RUTAS_CON_ID_DUENO.map(([m, r, c]) => [m, r, c ?? null] as const))('%s %s con token de otra tienda responde 404 y no cambia nada', async (metodo, ruta, cuerpo) => {
    const auditoria = await p.bd.auditoria.count();
    const pagos = await p.bd.pago.count();
    await llamar(metodo, ruta.replace(':id', idDe(ruta)), b.token, cuerpo ?? undefined).expect(404);
    expect(await p.bd.pago.count()).toBe(pagos);
    expect(await p.bd.auditoria.count()).toBe(auditoria);
  });

  it.each(['/productos', '/clientes', '/compras', '/listados'])('GET %s de B no contiene nada de A', async (ruta) => {
    const r = (await p.get(ruta, b.token).expect(200)).body.items as { id: string }[];
    if (ruta === '/productos') expect(r.map((x) => x.id).filter((id) => Object.values(a.productos).includes(id))).toEqual([]);
    if (ruta === '/compras') expect(r.map((x) => x.id)).not.toContain(compraA);
    if (ruta === '/listados') expect(r.map((x) => x.id)).not.toContain(listadoA);
    if (ruta === '/clientes') expect(r.map((x) => x.id)).not.toContain(clienteA);
  });

  it('una compra de B no puede usar cliente ni producto de A, ni enviar tiendaId', async () => {
    const clienteB = (await p.get('/clientes', b.token)).body.items[0].id;
    const item = (productoId: string) => [{ productoId, cantidad: '1' }];
    await p.post('/compras', b.token, { clienteId: clienteA, modalidad: 'FIN_MES', items: item(b.productos.P001) }).expect(404);
    await p.post('/compras', b.token, { clienteId: clienteB, modalidad: 'FIN_MES', items: item(a.productos.P001) }).expect(404);
    await p
      .post('/compras', b.token, { clienteId: clienteB, modalidad: 'FIN_MES', items: item(b.productos.P001), tiendaId: a.tiendaId })
      .expect(400);
  });

  it('cada tienda tiene sus tickets correlativos y el corte deja cada listado en su tienda', async () => {
    const clienteB = (await p.get('/clientes', b.token)).body.items[0].id;
    p.reloj.fijar('2026-09-23T10:00:00');
    const r = await p
      .post('/compras', b.token, { clienteId: clienteB, modalidad: 'FIN_MES', items: [{ productoId: b.productos.P001, cantidad: '1' }] })
      .expect(201);
    expect(r.body.ticket).toBe('T-000001');
    const listado = await p.bd.listado_pago.findUniqueOrThrow({ where: { id: BigInt(listadoA) } });
    expect(listado.tienda_id.toString()).toBe(a.tiendaId);
  });

  it('un rol no entra a las rutas de otro', async () => {
    const luis = await p.login('45872316', 'Vecino#2026', 'CLIENTE');
    await p.get('/clientes', luis).expect(403);
    await p.get('/clientes', admin).expect(403);
    await p.get('/tiendas', a.token).expect(403);
    await p.get('/mi/resumen', a.token).expect(403);
    await p.get('/clientes').expect(401);
    await p.get(`/mi/listados/${listadoA}`, luis).expect(404);
  });

  it('las rutas del cliente no revelan VAN, contado, COK ni precio contado', async () => {
    const luis = await p.login('45872316', 'Vecino#2026', 'CLIENTE');
    const lista = (await p.get('/mi/listados', luis).expect(200)).body.items;
    const rutas = ['/mi/resumen', '/mi/listados', `/mi/listados/${lista[0].id}`, '/mi/cuotas', '/mi/pagos', '/mi/perfil', '/mi/ayuda/ejemplo'];
    for (const ruta of rutas) {
      const texto = JSON.stringify((await p.get(ruta, luis).expect(200)).body);
      for (const campo of ['"van"', 'montoContado', 'monto_contado', 'cokTea', 'cok_tea', 'precioContado', 'precio_contado', 'compraId']) expect(texto).not.toContain(campo);
    }
  });

  it('el administrador no recibe importes ni tasas', async () => {
    const resumen = JSON.stringify((await p.get('/plataforma/resumen', admin).expect(200)).body);
    expect(resumen).not.toMatch(/"detalle"|S\/ \d/);
    const auditoria = (await p.get('/auditoria?tamano=200', admin).expect(200)).body.items as { detalle: string | null }[];
    expect(auditoria.length).toBeGreaterThan(5);
    for (const f of auditoria) {
      expect(f.detalle ?? '').not.toMatch(/(S\/|US\$)\s*\d|datos=/);
    }
  });

  it('la auditoría nunca guarda contraseñas ni códigos de activación', async () => {
    const filas = await p.bd.auditoria.findMany({ select: { detalle: true } });
    const codigos = (await p.bd.cliente.findMany({ select: { codigo_activacion: true } })).map((c) => c.codigo_activacion).filter(Boolean) as string[];
    for (const f of filas) {
      const d = f.detalle ?? '';
      expect(d).not.toMatch(/\$2[ab]\$|Clave#2026|Admin#2026|Tienda#2026/);
      for (const c of codigos) expect(d).not.toContain(c);
    }
  });

  it('la baja de una tienda corta el acceso de su dueño de inmediato y sigue listada', async () => {
    const admin2 = await p.admin();
    const c = await p.crearTienda('Tienda baja', admin2, await p.rosa());
    await p.get('/productos', c.token).expect(200);
    await p.patch(`/tiendas/${c.tiendaId}/estado`, admin2, { estado: 'INACTIVO' }).expect(200);
    await p.get('/productos', c.token).expect(401);
    const lista = (await p.get('/tiendas?estado=INACTIVO', admin2).expect(200)).body.items;
    expect(lista.map((t: { id: string }) => t.id)).toContain(c.tiendaId);
    const u = (await p.get(`/usuarios?texto=${c.usuarioDueno}`, admin2).expect(200)).body.items[0];
    expect(u.estado).toBe('INACTIVO');
    const a2 = await p.bd.auditoria.findFirstOrThrow({ where: { tabla: 'tienda', accion: 'BAJA', registro_id: BigInt(c.tiendaId) } });
    expect(a2.accion).toBe('BAJA');
  });
});

describe('auditoría de cada mutación', () => {
  const ultima = () => p.bd.auditoria.findFirstOrThrow({ orderBy: { id: 'desc' } });
  const esperar = async (accion: string, tabla: string) => {
    const f = await ultima();
    expect([f.accion, f.tabla]).toEqual([accion, tabla]);
    return f;
  };

  it('deja una fila con acción, tabla, hora del reloj, usuario y tienda', async () => {
    p.reloj.fijar('2026-09-24T09:30:00');
    const prod = (await p.post('/productos', a.token, {
      codigo: `Z${dniUnico()}`,
      nombre: 'Nuevo',
      unidad: 'UND',
      precioContado: '1.00',
      precioLista: '1.10',
      permiteFinMes: true,
      permiteCuotas: false,
    }).expect(201)).body;
    const f = await esperar('ALTA', 'producto');
    expect(f.fecha_hora.toISOString()).toBe('2026-09-24T09:30:00.000Z');
    expect(f.tienda_id?.toString()).toBe(a.tiendaId);
    expect(f.usuario_id).not.toBeNull();

    await p.patch(`/productos/${prod.id}`, a.token, { nombre: 'Otro' }).expect(200);
    await esperar('CAMBIO', 'producto');
    await p.patch(`/productos/${prod.id}/estado`, a.token, { estado: 'INACTIVO' }).expect(200);
    await esperar('BAJA', 'producto');
    await p.patch(`/productos/${prod.id}/estado`, a.token, { estado: 'ACTIVO' }).expect(200);
    await esperar('CAMBIO', 'producto');

    await p.patch(`/clientes/${clienteA}`, a.token, { direccion: 'Calle 1' }).expect(200);
    await esperar('CAMBIO', 'cliente');
    await p.patch(`/tiendas/${a.tiendaId}`, admin, { direccion: 'Av. 2' }).expect(200);
    await esperar('CAMBIO', 'tienda');

    const u = (await p.post('/usuarios', admin, {
      perfil: 'DUENO',
      username: `u${dniUnico()}@prueba.test`,
      nombres: 'Usuario',
      claveTemporal: 'Clave#2026',
    }).expect(201)).body;
    await esperar('ALTA', 'usuario');
    await p.patch(`/usuarios/${u.id}`, admin, { nombres: 'Otro' }).expect(200);
    await esperar('CAMBIO', 'usuario');
    await p.post(`/usuarios/${u.id}/restablecer-clave`, admin, { claveTemporal: 'Clave#2027' }).expect(204);
    await esperar('CAMBIO', 'usuario');
    await p.patch(`/usuarios/${u.id}/estado`, admin, { estado: 'INACTIVO' }).expect(200);
    await esperar('BAJA', 'usuario');

    await p.post('/auth/cambiar-contrasena', a.token, { actual: a.clave, nueva: 'Clave#2028' }).expect(204);
    await esperar('CAMBIO', 'usuario');
    await p.login(a.usuarioDueno, 'Clave#2028', 'DUENO');
    await esperar('LOGIN', 'usuario');
  });

  it('no permite crear cuentas de cliente desde A04 ni darse de baja a sí mismo', async () => {
    const r = await p.post('/usuarios', admin, { perfil: 'CLIENTE', username: 'x', nombres: 'x', claveTemporal: 'Clave#2026' }).expect(400);
    expect(r.body.codigo).toBe('PERFIL_NO_PERMITIDO');
    const yo = (await p.get('/auth/yo', admin).expect(200)).body.usuario;
    const b2 = await p.patch(`/usuarios/${yo.id}/estado`, admin, { estado: 'INACTIVO' }).expect(409);
    expect(b2.body.codigo).toBe('AUTOBAJA');
  });
});

describe('cliente con cuotas y compras por listar', () => {
  const PROHIBIDOS = ['"van"', 'montoContado', 'monto_contado', 'cokTea', 'cok_tea', 'precioContado', 'precio_contado', 'subtotalContado', 'tirDiaria', 'sumaValorActual', 'valorActual', 'compraId'];
  const activar = async (dni: string, codigo: string) => {
    const clave = 'Clave#2026';
    await p.post('/auth/activar', undefined, { dni, codigo, celular: '999888777', password: clave, passwordConfirmacion: clave, aceptaDatos: true }).expect(201);
    return p.login(dni, clave, 'CLIENTE');
  };

  it('/mi/* no revela datos de la tienda, con un listado de cuota emitido', async () => {
    p.reloj.fijar('2026-09-10T10:00:00');
    const dni = dniUnico();
    const c = (await p.post('/clientes', a.token, { ...MARIA(dni), diaCorte: 17, diaPago: 22 }).expect(201)).body;
    const token = await activar(dni, c.codigoActivacion);
    await p.post('/compras', a.token, { clienteId: c.id, modalidad: 'CUOTAS', numCuotas: 3, items: [{ productoId: a.productos.P012, cantidad: '1' }] }).expect(201);
    p.reloj.fijar('2026-10-17T17:00:01');
    await p.post('/cortes/ejecutar', admin).expect(200);
    const [l] = (await p.get('/mi/listados', token).expect(200)).body.items;
    const detalle = (await p.get(`/mi/listados/${l.id}`, token).expect(200)).body;
    expect(detalle.items[0].tipo).toBe('CUOTA');
    expect(detalle.items[0].detalle.length).toBeGreaterThan(0);
    const delDueno = (await p.get(`/listados/${l.id}`, a.token).expect(200)).body;
    expect(delDueno.items[0].compraId).toBeTruthy();
    const cuotas = (await p.get('/mi/cuotas', token).expect(200)).body;
    expect(cuotas.compras).toHaveLength(1);
    for (const ruta of ['/mi/resumen', '/mi/listados', `/mi/listados/${l.id}`, '/mi/cuotas', '/mi/pagos', '/mi/perfil', '/mi/ayuda/ejemplo']) {
      const texto = JSON.stringify((await p.get(ruta, token).expect(200)).body);
      for (const campo of PROHIBIDOS) expect(texto).not.toContain(campo);
    }
    p.reloj.fijar('2026-09-22T10:00:00');
  });

  it('C03 proyecta una compra a fin de mes con su interés; sin deuda no hay próximo pago; lo vencido sin listar no se muestra', async () => {
    p.reloj.fijar('2026-09-12T10:00:00');
    const dni = dniUnico();
    const c = (await p.post('/clientes', a.token, { ...LUIS(dni), diaCorte: 18, diaPago: 19 }).expect(201)).body;
    const token = await activar(dni, c.codigoActivacion);
    expect((await p.get('/mi/resumen', token).expect(200)).body.proximoPago).toBeNull();

    await p.post('/compras', a.token, { clienteId: c.id, modalidad: 'FIN_MES', items: [{ productoId: a.productos.P001, cantidad: '1' }] }).expect(201);
    const interes = interesCompra('9.00', '0.001032653810255', 7);
    const r = (await p.get('/mi/resumen', token).expect(200)).body.proximoPago;
    expect(r).toMatchObject({ capital: '9.00', interes: interes.toFixed(2), total: new Dec('9.00').plus(interes).toFixed(2), mora: '0.00', fecha: '2026-09-19', diasRestantes: 7, proyectado: true });

    p.reloj.fijar('2026-09-25T10:00:00'); // Sin corte de por medio, la fecha proyectada ya pasó.
    expect((await p.get('/mi/resumen', token).expect(200)).body.proximoPago).toBeNull();
    p.reloj.fijar('2026-09-22T10:00:00');
  });
});

describe('concurrencia', () => {
  let c: Tienda;
  const compra = (clienteId: string, cantidad: string) => ({
    clienteId,
    modalidad: 'FIN_MES',
    items: [{ productoId: c.productos.P001, cantidad }],
  });
  beforeAll(async () => {
    p.reloj.fijar('2026-09-10T10:00:00');
    c = await p.crearTienda('Tienda concurrente', admin, await p.rosa());
  });

  it('2 compras simultáneas que juntas superan el límite: una 201 y otra 422', async () => {
    const cliente = (await p.post('/clientes', c.token, { ...LUIS(dniUnico()), limiteCredito: '100.00' }).expect(201)).body.id;
    const precio = (await p.get('/productos?texto=P001', c.token)).body.items[0];
    const cantidad = (60 / Number(precio.precioLista)).toFixed(3);
    const r = await Promise.all([p.post('/compras', c.token, compra(cliente, cantidad)), p.post('/compras', c.token, compra(cliente, cantidad))]);
    expect(r.map((x) => x.status).sort()).toEqual([201, 422]);
  });

  it('20 compras simultáneas en una tienda: tickets sin repetir ni saltos', async () => {
    const cliente = (await p.post('/clientes', c.token, { ...LUIS(dniUnico()), limiteCredito: '99999.00' }).expect(201)).body.id;
    const r = await Promise.all(Array.from({ length: 20 }, () => p.post('/compras', c.token, compra(cliente, '1'))));
    expect(r.map((x) => x.status)).toEqual(Array(20).fill(201));
    const numeros = r.map((x) => Number(x.body.ticket.slice(2))).sort((x, y) => x - y);
    expect(numeros[19] - numeros[0]).toBe(19);
    expect(new Set(numeros).size).toBe(20);
  });

  it('la compra de las 17:00:00 entra al corte; la de las 17:00:01 pasa al ciclo siguiente', async () => {
    const cliente = (await p.post('/clientes', c.token, { ...LUIS(dniUnico()), diaCorte: 15, diaPago: 20 }).expect(201)).body.id;
    p.reloj.fijar('2026-09-15T17:00:00');
    await p.post('/compras', c.token, compra(cliente, '1')).expect(201);
    p.reloj.fijar('2026-09-15T17:00:01');
    const despues = await p.post('/compras', c.token, compra(cliente, '1')).expect(201);
    expect(despues.body.fechaCorte).toBe('2026-10-15');
    await p.post('/cortes/ejecutar', admin).expect(200);
    const [l] = (await p.get(`/listados?clienteId=${cliente}`, c.token)).body.items;
    const d = (await p.get(`/listados/${l.id}`, c.token)).body;
    expect(d.items).toHaveLength(1);
  });

  it('2 cortes y 2 pagos simultáneos: 1 listado sin ítems duplicados y 1 solo pago', async () => {
    const cliente = (await p.post('/clientes', c.token, { ...LUIS(dniUnico()), diaCorte: 16, diaPago: 21 }).expect(201)).body.id;
    p.reloj.fijar('2026-09-16T10:00:00');
    await p.post('/compras', c.token, compra(cliente, '1')).expect(201);
    p.reloj.fijar('2026-09-16T17:00:01');
    const cortes = await Promise.all([p.post('/cortes/ejecutar', admin), p.post('/cortes/ejecutar', admin)]);
    expect(cortes.map((x) => x.status)).toEqual([200, 200]);
    expect(cortes.flatMap((x) => x.body.errores)).toEqual([]);
    const listados = (await p.get(`/listados?clienteId=${cliente}`, c.token)).body.items;
    expect(listados).toHaveLength(1);
    expect(await p.bd.listado_item.count({ where: { listado_id: BigInt(listados[0].id) } })).toBe(1);

    p.reloj.fijar('2026-09-17T10:00:00');
    const cuerpo = { montoPagado: listados[0].total, medioPago: 'Efectivo' };
    const pagos = await Promise.all([
      p.post(`/listados/${listados[0].id}/pago`, c.token, cuerpo),
      p.post(`/listados/${listados[0].id}/pago`, c.token, cuerpo),
    ]);
    expect(pagos.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(await p.bd.pago.count({ where: { listado_id: BigInt(listados[0].id) } })).toBe(1);
  });
});
