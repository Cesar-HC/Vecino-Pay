// Cada operación de 8.1 deja su fila; cada código de error de la sección 9 responde lo que dice el contrato.
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { dniUnico, LUIS, MARIA, Prueba } from '../apoyo/app';

jest.setTimeout(120000);

const p = new Prueba();
let admin: string;
let t: Awaited<ReturnType<Prueba['crearTienda']>>;
const HORA = '2026-09-10T10:00:00';

const compraDe = (clienteId: string, cantidad = '1', extra: object = {}) => ({
  clienteId,
  modalidad: 'FIN_MES',
  items: [{ productoId: t.productos.P001, cantidad }],
  ...extra,
});

/** Ejecuta la operación y exige exactamente las filas nuevas indicadas, con hora del reloj, usuario y tienda. */
async function auditada(
  operacion: () => PromiseLike<{ status: number }>,
  estado: number,
  esperadas: { accion: string; tabla: string; usuario?: 'con' | 'sin'; tienda?: 'con' | 'sin'; registro?: 'con' | 'sin' }[],
) {
  const ultima = (await p.bd.auditoria.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? 0n;
  const r = await operacion();
  expect(r.status).toBe(estado);
  const nuevas = await p.bd.auditoria.findMany({ where: { id: { gt: ultima } }, orderBy: { id: 'asc' } });
  expect(nuevas.map((f) => `${f.accion} ${f.tabla}`)).toEqual(esperadas.map((e) => `${e.accion} ${e.tabla}`));
  nuevas.forEach((f, i) => {
    const e = esperadas[i];
    expect(f.fecha_hora.toISOString()).toBe(`${HORA}.000Z`);
    if (e.usuario) expect(f.usuario_id === null ? 'sin' : 'con').toBe(e.usuario);
    if (e.tienda) expect(f.tienda_id === null ? 'sin' : 'con').toBe(e.tienda);
    if (e.registro) expect(f.registro_id === null ? 'sin' : 'con').toBe(e.registro);
  });
  return r;
}

beforeAll(async () => {
  await p.iniciar();
  p.reloj.fijar(HORA);
  admin = await p.admin();
  t = await p.crearTienda('Tienda Auditoría', admin, await p.rosa());
});
afterAll(() => p.cerrar());

describe('matriz de auditoría (8.1)', () => {
  it('tienda: alta, reactivación y baja que arrastra al dueño', async () => {
    const unico = `${Date.now()}`.slice(-9);
    const r = await auditada(
      () =>
        p.post('/tiendas', admin, {
          ruc: `20${unico}`,
          razonSocial: 'X',
          nombreComercial: 'X',
          giro: 'Bodega',
          cokTea: '0.20',
          usuarioDueno: `a${unico}@prueba.test`,
          claveTemporal: 'Clave#2026',
        }),
      201,
      [
        { accion: 'ALTA', tabla: 'usuario', usuario: 'con' },
        { accion: 'ALTA', tabla: 'tienda', usuario: 'con', tienda: 'con', registro: 'con' },
      ],
    );
    const id = (r as unknown as { body: { id: string } }).body.id;
    await auditada(() => p.patch(`/tiendas/${id}/estado`, admin, { estado: 'INACTIVO' }), 200, [
      { accion: 'BAJA', tabla: 'usuario' },
      { accion: 'BAJA', tabla: 'tienda' },
    ]);
    await auditada(() => p.patch(`/tiendas/${id}/estado`, admin, { estado: 'ACTIVO' }), 200, [{ accion: 'CAMBIO', tabla: 'tienda' }]);
  });

  it('la baja de una tienda no reactiva a un dueño bloqueado', async () => {
    const unico = `${Date.now()}`.slice(-9);
    const usuarioDueno = `b${unico}@prueba.test`;
    const base = { razonSocial: 'X', nombreComercial: 'X', giro: 'Bodega', cokTea: '0.20', usuarioDueno, claveTemporal: 'Clave#2026' };
    const t1 = (await p.post('/tiendas', admin, { ...base, ruc: `21${unico}` }).expect(201)).body;
    const t2 = (await p.post('/tiendas', admin, { ...base, ruc: `22${unico}` }).expect(201)).body;
    await p.patch(`/usuarios/${t1.duenio.id}/estado`, admin, { estado: 'INACTIVO' }).expect(200);
    await p.patch(`/tiendas/${t2.id}/estado`, admin, { estado: 'INACTIVO' }).expect(200);
    const u = await p.bd.usuario.findUniqueOrThrow({ where: { id: BigInt(t1.duenio.id) } });
    expect(u.estado).toBe('INACTIVO');
    await p.post('/auth/login', undefined, { username: usuarioDueno, password: 'Clave#2026', perfil: 'DUENO' }).expect(401);
  });

  it('usuario: reactivación', async () => {
    const u = (await p.post('/usuarios', admin, { perfil: 'ADMIN_SISTEMA', username: `c${dniUnico()}@p.test`, nombres: 'X', claveTemporal: 'Clave#2026' }).expect(201)).body;
    await auditada(() => p.patch(`/usuarios/${u.id}/estado`, admin, { estado: 'INACTIVO' }), 200, [{ accion: 'BAJA', tabla: 'usuario' }]);
    await auditada(() => p.patch(`/usuarios/${u.id}/estado`, admin, { estado: 'ACTIVO' }), 200, [{ accion: 'CAMBIO', tabla: 'usuario' }]);
  });

  it('cliente: alta con los datos de mora, baja y reactivación', async () => {
    const r = await auditada(() => p.post('/clientes', t.token, LUIS(dniUnico())), 201, [
      { accion: 'ALTA', tabla: 'cliente', usuario: 'con', tienda: 'con', registro: 'con' },
    ]);
    const id = (r as unknown as { body: { id: string } }).body.id;
    const f = await p.bd.auditoria.findFirstOrThrow({ where: { tabla: 'cliente', accion: 'ALTA' }, orderBy: { id: 'desc' } });
    expect(f.detalle).toContain('"plazoMora":360');
    expect(f.detalle).toContain('Aceptó el tratamiento');
    await auditada(() => p.patch(`/clientes/${id}/estado`, t.token, { estado: 'INACTIVO' }), 200, [{ accion: 'BAJA', tabla: 'cliente' }]);
    await auditada(() => p.patch(`/clientes/${id}/estado`, t.token, { estado: 'ACTIVO' }), 200, [{ accion: 'CAMBIO', tabla: 'cliente' }]);
  });

  it('compra: alta y rechazo por límite, sin registro_id', async () => {
    const id = (await p.post('/clientes', t.token, LUIS(dniUnico())).expect(201)).body.id;
    await auditada(() => p.post('/compras', t.token, compraDe(id)), 201, [
      { accion: 'ALTA', tabla: 'compra', usuario: 'con', tienda: 'con', registro: 'con' },
    ]);
    await auditada(() => p.post('/compras', t.token, compraDe(id, '999')), 422, [
      { accion: 'RECHAZO', tabla: 'compra', usuario: 'con', tienda: 'con', registro: 'sin' },
    ]);
  });

  it('activación fallida y login', async () => {
    const cuerpo = { dni: '00000001', codigo: 'NO-EXISTE', celular: '999888777', password: 'Clave#2026', passwordConfirmacion: 'Clave#2026', aceptaDatos: true };
    await auditada(() => p.post('/auth/activar', undefined, cuerpo), 400, [{ accion: 'RECHAZO', tabla: 'cliente', usuario: 'sin' }]);
    await auditada(() => p.post('/auth/login', undefined, { username: 'nadie', password: 'x', perfil: 'DUENO' }), 401, [
      { accion: 'RECHAZO', tabla: 'usuario', usuario: 'sin' },
    ]);
    await auditada(() => p.post('/auth/login', undefined, { username: t.usuarioDueno, password: t.clave, perfil: 'DUENO' }), 200, [
      { accion: 'LOGIN', tabla: 'usuario', usuario: 'con', tienda: 'con' },
    ]);
  });

  it('el rechazo por DNI ya activado queda auditado y no consume el código', async () => {
    const c = (await p.post('/clientes', t.token, LUIS('45872316')).expect(201)).body;
    const cuerpo = { dni: '45872316', codigo: c.codigoActivacion, celular: '999888777', password: 'Clave#2026', passwordConfirmacion: 'Clave#2026', aceptaDatos: true };
    await auditada(() => p.post('/auth/activar', undefined, cuerpo), 409, [{ accion: 'RECHAZO', tabla: 'cliente', tienda: 'con', registro: 'con' }]);
    expect((await p.get(`/clientes/${c.id}`, t.token)).body.codigoActivacion).toBe(c.codigoActivacion);
  });

  it('corte, vencido y pago: el sistema audita con usuario NULL; el rechazo de pago se conserva', async () => {
    const reloj = p.reloj;
    const id = (await p.post('/clientes', t.token, { ...LUIS(dniUnico()), diaCorte: 11, diaPago: 12 }).expect(201)).body.id;
    await p.post('/compras', t.token, compraDe(id)).expect(201);
    reloj.fijar('2026-09-11T17:00:01');
    await p.post('/cortes/ejecutar', admin).expect(200);
    const f = await p.bd.auditoria.findFirstOrThrow({ where: { tabla: 'listado_pago', accion: 'ALTA' }, orderBy: { id: 'desc' } });
    expect(f.usuario_id).toBeNull();
    expect(f.tienda_id?.toString()).toBe(t.tiendaId);
    expect(f.fecha_hora.toISOString()).toBe('2026-09-11T17:00:01.000Z');
    const [l] = (await p.get(`/listados?clienteId=${id}`, t.token)).body.items;

    reloj.fijar('2026-09-12T17:00:01');
    await p.post('/cortes/ejecutar', admin).expect(200);
    const v = await p.bd.auditoria.findFirstOrThrow({ where: { tabla: 'listado_pago', accion: 'CAMBIO', registro_id: BigInt(l.id) } });
    expect(v.usuario_id).toBeNull();
    expect((await p.bd.listado_pago.findUniqueOrThrow({ where: { id: BigInt(l.id) } })).estado).toBe('VENCIDO');

    reloj.fijar(HORA.replace('09-10', '09-13'));
    const rechazo = await p.post(`/listados/${l.id}/pago`, t.token, { montoPagado: '1.00', medioPago: 'Efectivo' }).expect(422);
    expect(rechazo.body.codigo).toBe('PAGO_NO_EXACTO');
    const a = await p.bd.auditoria.findFirstOrThrow({ where: { tabla: 'pago', accion: 'RECHAZO', registro_id: BigInt(l.id) } });
    expect(a.usuario_id).not.toBeNull();
    reloj.fijar(HORA);
  });

  it('A05 no muestra ningún importe de lo que la API escribe', async () => {
    const filas = (await p.get('/auditoria?tamano=200', admin).expect(200)).body.items as { detalle: string | null }[];
    expect(filas.some((f) => /\*\*\*/.test(f.detalle ?? ''))).toBe(true);
    for (const f of filas) expect(f.detalle ?? '').not.toMatch(/\d+\.\d{2}/);
  });
});

describe('códigos de error del contrato', () => {
  const productoBase = (codigo: string) => ({ codigo, nombre: 'X', unidad: 'UND', precioContado: '1.00', precioLista: '1.10', permiteFinMes: true, permiteCuotas: true });

  it('duplicados: 409 con su código', async () => {
    const dni = dniUnico();
    await p.post('/clientes', t.token, LUIS(dni)).expect(201);
    const c = await p.post('/clientes', t.token, LUIS(dni)).expect(409);
    expect(c.body.codigo).toBe('DNI_DUPLICADO');

    const codigo = `D${dniUnico()}`;
    await p.post('/productos', t.token, productoBase(codigo)).expect(201);
    const pr = await p.post('/productos', t.token, productoBase(codigo)).expect(409);
    expect(pr.body.codigo).toBe('CODIGO_DUPLICADO');

    const lista = (await p.get('/tiendas', admin)).body.items;
    const ti = await p
      .post('/tiendas', admin, { ruc: lista[0].ruc, razonSocial: 'X', nombreComercial: 'X', giro: 'X', cokTea: '0.2', usuarioDueno: t.usuarioDueno })
      .expect(409);
    expect(ti.body.codigo).toBe('RUC_DUPLICADO');

    const u = await p.post('/usuarios', admin, { perfil: 'DUENO', username: t.usuarioDueno, nombres: 'X', claveTemporal: 'Clave#2026' }).expect(409);
    expect(u.body.codigo).toBe('USUARIO_DUPLICADO');

    const n = await p.post('/tiendas', admin, { ruc: `30${dniUnico()}1`, razonSocial: 'X', nombreComercial: 'X', giro: 'X', cokTea: '0.2', usuarioDueno: '45872316' }).expect(409);
    expect(n.body.codigo).toBe('USUARIO_NO_ES_DUENO');
  });

  it('validaciones de negocio', async () => {
    const barato = await p.post('/productos', t.token, { ...productoBase(`E${dniUnico()}`), precioLista: '0.50' }).expect(400);
    expect(barato.body.codigo).toBe('PRECIO_LISTA');
    const soloMes = (await p.post('/productos', t.token, { ...productoBase(`F${dniUnico()}`), permiteCuotas: false }).expect(201)).body;
    const id = (await p.post('/clientes', t.token, LUIS(dniUnico())).expect(201)).body.id;
    const modalidad = await p
      .post('/compras', t.token, { clienteId: id, modalidad: 'CUOTAS', numCuotas: 2, items: [{ productoId: soloMes.id, cantidad: '1' }] })
      .expect(400);
    expect(modalidad.body.codigo).toBe('MODALIDAD');
    const fm = await p.post('/compras', t.token, compraDe(id, '1', { numCuotas: 2 })).expect(400);
    expect(fm.body.codigo).toBe('MODALIDAD');
    const rango = await p
      .post('/compras', t.token, { clienteId: id, modalidad: 'CUOTAS', numCuotas: 9, items: [{ productoId: t.productos.P012, cantidad: '1' }] })
      .expect(400);
    expect(rango.body.codigo).toBe('CUOTAS_RANGO');
    const compra = (await p.post('/compras', t.token, compraDe(id)).expect(201)).body;
    const noEs = await p.get(`/compras/${compra.id}/cronograma`, t.token).expect(409);
    expect(noEs.body.codigo).toBe('NO_ES_CUOTAS');

    const clave = await p.post('/auth/cambiar-contrasena', t.token, { actual: 'mala', nueva: 'Clave#2030' }).expect(400);
    expect(clave.body.codigo).toBe('CLAVE_ACTUAL');
    await p.post('/tiendas', admin, { ruc: `31${dniUnico()}1`, razonSocial: 'X', nombreComercial: 'X', giro: 'X', cokTea: '0', usuarioDueno: t.usuarioDueno }).expect(400);
  });

  it('cliente y producto dados de baja, y ciclo cerrado', async () => {
    const baja = (await p.post('/clientes', t.token, LUIS(dniUnico())).expect(201)).body.id;
    await p.patch(`/clientes/${baja}/estado`, t.token, { estado: 'INACTIVO' }).expect(200);
    const c = await p.post('/compras', t.token, compraDe(baja)).expect(409);
    expect(c.body.codigo).toBe('CLIENTE_INACTIVO');

    const id = (await p.post('/clientes', t.token, { ...LUIS(dniUnico()), diaCorte: 14, diaPago: 15 }).expect(201)).body.id;
    const inactivo = (await p.post('/productos', t.token, productoBase(`G${dniUnico()}`)).expect(201)).body;
    await p.patch(`/productos/${inactivo.id}/estado`, t.token, { estado: 'INACTIVO' }).expect(200);
    const pr = await p.post('/compras', t.token, { clienteId: id, modalidad: 'FIN_MES', items: [{ productoId: inactivo.id, cantidad: '1' }] }).expect(409);
    expect(pr.body.codigo).toBe('PRODUCTO_INACTIVO');

    await p.post('/compras', t.token, compraDe(id)).expect(201);
    p.reloj.fijar('2026-09-14T17:00:01');
    await p.post('/cortes/ejecutar', admin).expect(200);
    p.reloj.fijar('2026-09-14T16:00:00'); // Solo posible con reloj fijo: una compra de un ciclo que ya se cerró.
    const cerrado = await p.post('/compras', t.token, compraDe(id)).expect(409);
    expect(cerrado.body.codigo).toBe('CICLO_CERRADO');
    p.reloj.fijar(HORA);
  });

  it('entradas inválidas dan 400 en español, no 500', async () => {
    const sinTasa = await p.post('/clientes', t.token, { ...LUIS(dniUnico()), tasa: undefined }).expect(400);
    expect(sinTasa.body.mensaje).not.toMatch(/must|should/);
    await p.get('/listados?fechaCorte=2026-13-45', t.token).expect(400);
    await p.get('/auditoria?desde=2026-13-45', admin).expect(400);
    await p.post('/compras', t.token, { clienteId: '1', modalidad: 'FIN_MES', items: [{ productoId: t.productos.P001, cantidad: '0.001' }], extra: 1 }).expect(400).expect((r) => {
      expect(r.body.mensaje).toContain('extra');
      expect(r.body.mensaje).not.toMatch(/should not exist/);
    });
    const id = (await p.post('/clientes', t.token, LUIS(dniUnico())).expect(201)).body.id;
    const barato = (await p.post('/productos', t.token, { ...productoBase(`H${dniUnico()}`), precioContado: '0.01', precioLista: '0.01' }).expect(201)).body;
    const cero = await p.post('/compras', t.token, { clienteId: id, modalidad: 'FIN_MES', items: [{ productoId: barato.id, cantidad: '0.001' }] }).expect(400);
    expect(cero.body.codigo).toBe('CANTIDAD');
  });

  it('paginación y filtros combinados', async () => {
    const r = (await p.get('/productos?pagina=1&tamano=2', t.token).expect(200)).body;
    expect(r.items).toHaveLength(2);
    expect(r.total).toBeGreaterThan(2);
    const u = (await p.get(`/usuarios?texto=no-existe-nadie&tiendaId=${t.tiendaId}`, admin).expect(200)).body;
    expect(u.items).toEqual([]);
  });

  it('un token alterado, vencido o sin firma no entra; /auth/yo respeta la tienda del token', async () => {
    const [cabecera, carga, firma] = t.token.split('.');
    await p.get('/productos', `${cabecera}.${carga}.${firma.slice(0, -2)}xx`).expect(401);
    const sinFirma = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${carga}.`;
    await p.get('/productos', sinFirma).expect(401);
    const jwt = p.app.get(JwtService);
    const datos = JSON.parse(Buffer.from(carga, 'base64url').toString());
    delete datos.exp;
    delete datos.iat;
    await p.get('/productos', await jwt.signAsync(datos, { expiresIn: -10 })).expect(401);

    const unico = `${Date.now()}`.slice(-9);
    const otra = (await p.post('/tiendas', admin, { ruc: `40${unico}`, razonSocial: 'Y', nombreComercial: 'Segunda', giro: 'X', cokTea: '0.2', usuarioDueno: t.usuarioDueno }).expect(201)).body;
    const cambio = (await p.post('/auth/cambiar-tienda', t.token, { tiendaId: otra.id }).expect(200)).body;
    const yo = (await p.get('/auth/yo', cambio.token).expect(200)).body;
    expect(yo.tienda.id).toBe(otra.id);
    expect(yo.tiendas).toHaveLength(2);
  });
});

describe('clientes de una misma tienda', () => {
  it('uno no ve los pagos ni los listados del otro', async () => {
    const activar = async (dni: string, codigo: string) => {
      const clave = 'Clave#2026';
      await p.post('/auth/activar', undefined, { dni, codigo, celular: '999888777', password: clave, passwordConfirmacion: clave, aceptaDatos: true }).expect(201);
      return p.login(dni, clave, 'CLIENTE');
    };
    const dni1 = dniUnico();
    const dni2 = String(Number(dni1) + 1).padStart(8, '0');
    const c1 = (await p.post('/clientes', t.token, { ...LUIS(dni1), diaCorte: 12, diaPago: 13 }).expect(201)).body;
    const c2 = (await p.post('/clientes', t.token, { ...MARIA(dni2), diaCorte: 12, diaPago: 13 }).expect(201)).body;
    const t1 = await activar(dni1, c1.codigoActivacion);
    const t2 = await activar(dni2, c2.codigoActivacion);

    await p.post('/compras', t.token, compraDe(c1.id)).expect(201);
    p.reloj.fijar('2026-09-12T17:00:01');
    await p.post('/cortes/ejecutar', admin).expect(200);
    const [l] = (await p.get(`/listados?clienteId=${c1.id}`, t.token)).body.items;
    await p.post(`/listados/${l.id}/pago`, t.token, { montoPagado: l.total, medioPago: 'Yape', numeroOperacion: 'OP-SECRETA' }).expect(201);

    const propios = (await p.get('/mi/pagos', t1).expect(200)).body.pagos;
    expect(propios).toHaveLength(1);
    const ajenos = await p.get('/mi/pagos', t2).expect(200);
    expect(ajenos.body.pagos).toEqual([]);
    expect(JSON.stringify(ajenos.body)).not.toContain('OP-SECRETA');
    await p.get(`/mi/listados/${l.id}`, t1).expect(200);
    await p.get(`/mi/listados/${l.id}`, t2).expect(404);
    p.reloj.fijar(HORA);
  });
});

describe('límite de intentos, con la guardia real', () => {
  const q = new Prueba();
  beforeAll(() => q.iniciar(true));
  afterAll(() => q.cerrar());

  it('no se evade con mayúsculas ni espacios finales', async () => {
    const intentar = (username: string) => q.post('/auth/login', undefined, { username, password: 'mala', perfil: 'DUENO' });
    const variantes = ['intruso@x.test', 'INTRUSO@x.test', 'intruso@x.test ', ' Intruso@X.test  '];
    for (let i = 0; i < 10; i++) await intentar(variantes[i % variantes.length]).expect(401);
    await intentar('INTRUSO@X.TEST   ').expect(429);
    await intentar('otro@x.test').expect(401); // Otro usuario no queda bloqueado.
  });

  it('limita también por IP, ante el rociado de claves', async () => {
    let bloqueado = false;
    for (let i = 0; i < 70 && !bloqueado; i++) {
      const r = await q.post('/auth/login', undefined, { username: `rociado${i}@x.test`, password: 'mala', perfil: 'DUENO' });
      bloqueado = r.status === 429;
    }
    expect(bloqueado).toBe(true);
  });
});

describe('permisos del usuario de la API (13.6)', () => {
  const sa = new PrismaClient({ datasourceUrl: process.env.URL_SA_PRUEBAS });
  afterAll(() => sa.$disconnect());

  it('no puede alterar el esquema ni borrar en ninguna tabla', async () => {
    const tablas = ['usuario', 'tienda', 'producto', 'cliente', 'compra', 'compra_detalle', 'cuota', 'listado_pago', 'listado_item', 'pago', 'auditoria'];
    const filas = await p.bd.auditoria.count();
    for (const tabla of tablas) {
      await expect(p.bd.$executeRawUnsafe(`DELETE FROM dbo.${tabla}`)).rejects.toThrow(/229|DELETE permission/i);
    }
    await expect(p.bd.$executeRawUnsafe('TRUNCATE TABLE dbo.auditoria')).rejects.toThrow(/1088|permission/i);
    await expect(p.bd.$executeRawUnsafe('ALTER TABLE dbo.auditoria ADD x INT')).rejects.toThrow(/permission|1088|4902/i);
    await expect(p.bd.$executeRawUnsafe('DISABLE TRIGGER TR_auditoria_solo_insercion ON dbo.auditoria')).rejects.toThrow();
    await expect(p.bd.$executeRawUnsafe("UPDATE dbo.auditoria SET detalle = 'x'")).rejects.toThrow(/229|UPDATE permission/i);
    expect(await p.bd.auditoria.count()).toBe(filas);
  });

  it('los 3 triggers siguen habilitados', async () => {
    const r = await sa.$queryRaw<{ activos: number }[]>`SELECT COUNT(*) AS activos FROM sys.triggers WHERE is_disabled = 0 AND name LIKE 'TR[_]%'`;
    expect(Number(r[0].activos)).toBe(3);
  });
});
