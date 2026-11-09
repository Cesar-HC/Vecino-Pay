// Comportamientos que cambiaron con el motor: SQL Server no distinguía mayúsculas y PostgreSQL sí.
// Corre sobre las semillas, sin modificarlas (las altas que prueba se rechazan).
import { Prueba } from '../apoyo/app';

jest.setTimeout(60000);

const p = new Prueba();
beforeAll(async () => {
  await p.iniciar();
  p.reloj.fijar('2026-09-22T12:00:00');
});
afterAll(() => p.cerrar());

const producto = (codigo: string) => ({
  codigo,
  nombre: 'X',
  unidad: 'UND',
  precioContado: '1.00',
  precioLista: '1.10',
  permiteFinMes: true,
  permiteCuotas: true,
});

describe('comparación sin distinguir mayúsculas (citext)', () => {
  it('el usuario entra aunque lo escriba en mayúsculas', async () => {
    expect(await p.login('ROSA@VECINOPAY.TEST', 'Tienda#2026', 'DUENO')).toBeTruthy();
  });

  it('un código de producto igual en otras mayúsculas es duplicado y la siguiente operación funciona', async () => {
    const rosa = await p.rosa();
    const r = await p.post('/productos', rosa, producto('p001')).expect(409);
    expect(r.body.codigo).toBe('CODIGO_DUPLICADO');
    // La transacción abortada no arrastra a las operaciones siguientes.
    const lista = await p.get('/productos', rosa).expect(200);
    expect(lista.body.items.length).toBeGreaterThan(0);
  });

  it('un usuario con otras mayúsculas es duplicado', async () => {
    const admin = await p.admin();
    const r = await p
      .post('/usuarios', admin, {
        perfil: 'DUENO',
        username: 'ROSA@vecinopay.TEST',
        nombres: 'X',
        claveTemporal: 'Clave#2026',
      })
      .expect(409);
    expect(r.body.codigo).toBe('USUARIO_DUPLICADO');
  });

  it('la búsqueda por texto no distingue mayúsculas ni ñ', async () => {
    const rosa = await p.rosa();
    const productos = await p.get('/productos?texto=POLLO', rosa).expect(200);
    expect(productos.body.items.map((x: { codigo: string }) => x.codigo)).toContain('P001');
    const tiendas = await p.get('/tiendas?texto=DOÑA', await p.admin()).expect(200);
    expect(tiendas.body.items.length).toBeGreaterThan(0);
  });
});

describe('orden estable', () => {
  it('las compras de un cliente salen por fecha y, si empatan, por id', async () => {
    const rosa = await p.rosa();
    const r = (await p.get('/compras?pagina=1&tamano=50', rosa).expect(200)).body.items as {
      fechaHora: string;
    }[];
    const fechas = r.map((x) => x.fechaHora);
    expect([...fechas].sort()).toEqual(fechas);
  });
});
