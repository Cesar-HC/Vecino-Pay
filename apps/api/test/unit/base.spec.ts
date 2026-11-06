import { Prisma } from '@prisma/client';
import { detalleParaAdmin, armarDetalle } from '../../src/auditoria/detalle';
import { crearAmbito, FueraDeAmbito, MODELOS_DIRECTOS, MODELOS_GLOBALES, MODELOS_HEREDADOS, ClienteBd } from '../../src/bd/ambito-tienda';
import { aDecBd, aInstanteBd, dePartesBd } from '../../src/bd/conversiones';
import { cargarConfiguracion, ConfiguracionInvalida } from '../../src/config/configuracion';
import { RelojFijo } from '../../src/reloj/reloj';

const URL_OK = 'sqlserver://db:1433;database=VecinoPay;user=vecinopay_app;password=OtraClave#99';
const SECRETO = 'x'.repeat(40);

const problemas = (env: Record<string, string>) => {
  try {
    cargarConfiguracion(env);
    return [];
  } catch (e) {
    return (e as ConfiguracionInvalida).problemas;
  }
};

describe('configuración', () => {
  it('sin NODE_ENV actúa como producción', () => {
    expect(problemas({ JWT_SECRET: 'cambia-este-secreto', DATABASE_URL: URL_OK })).toHaveLength(1);
    expect(cargarConfiguracion({ JWT_SECRET: SECRETO, DATABASE_URL: URL_OK }).entorno).toBe('production');
  });
  it('producción rechaza secreto corto, reloj fijo y clave por defecto, y los informa juntos', () => {
    const p = problemas({
      NODE_ENV: 'production',
      JWT_SECRET: 'corto',
      RELOJ_FIJO: '2026-09-22T12:00:00-05:00',
      DATABASE_URL: 'sqlserver://db;user=vecinopay_app;password=VecinoApp#2026',
    });
    expect(p).toHaveLength(3);
  });
  it('user=sa se rechaza en todo entorno', () => {
    expect(problemas({ NODE_ENV: 'development', JWT_SECRET: 'a', DATABASE_URL: 'sqlserver://db;user=sa;password=x' })).toHaveLength(1);
  });
  it('desarrollo acepta el secreto por defecto y el reloj fijo', () => {
    const c = cargarConfiguracion({
      NODE_ENV: 'development',
      JWT_SECRET: 'cambia-este-secreto',
      DATABASE_URL: URL_OK,
      RELOJ_FIJO: '2026-09-22T12:00:00-05:00',
    });
    expect(c.relojFijo).toBe('2026-09-22T12:00:00-05:00');
  });
  it('reloj fijo vacío activa la hora real; sin desplazamiento se rechaza', () => {
    expect(cargarConfiguracion({ NODE_ENV: 'test', JWT_SECRET: 'a', DATABASE_URL: URL_OK, RELOJ_FIJO: '' }).relojFijo).toBeNull();
    expect(problemas({ NODE_ENV: 'test', JWT_SECRET: 'a', DATABASE_URL: URL_OK, RELOJ_FIJO: '2026-09-22T12:00:00' })).toHaveLength(1);
  });
});

describe('reloj', () => {
  it('RelojFijo exige desplazamiento y siempre devuelve lo mismo', () => {
    expect(() => new RelojFijo('2026-09-22T12:00:00')).toThrow();
    const r = new RelojFijo('2026-09-22T12:00:00-05:00');
    expect(r.ahora().toISOString()).toBe('2026-09-22T17:00:00.000Z');
    expect(r.ahora()).toEqual(r.ahora());
  });
});

describe('conversiones', () => {
  it('la hora local de Lima va y vuelve igual', () => {
    const partes = { fecha: '2026-08-29', hora: '18:40:00' };
    expect(dePartesBd(aInstanteBd(partes))).toEqual(partes);
  });
  it('una tasa pequeña no sale en notación científica', () => {
    expect(aDecBd(new Prisma.Decimal('0.000000001')).toFixed()).toBe('0.000000001');
  });
});

describe('detalle para el administrador', () => {
  it('quita los datos y enmascara importes', () => {
    const d = armarDetalle('Compra rechazada: supera S/ 276.38 y US$ 999.00', { tedMora: '0.1' });
    const r = detalleParaAdmin(d) as string;
    expect(r).toBe('Compra rechazada: supera S/ *** y US$ ***');
    expect(r).not.toContain('276.38');
    expect(r).not.toContain('999.00');
  });
});

describe('ámbito de tienda', () => {
  it('todo modelo de la BD está clasificado', () => {
    const clasificados = [...MODELOS_DIRECTOS, ...Object.keys(MODELOS_HEREDADOS), ...MODELOS_GLOBALES].sort();
    expect(Prisma.dmmf.datamodel.models.map((m) => m.name).sort()).toEqual(clasificados);
  });

  const llamadas: { op: string; args: unknown }[] = [];
  const delegado = new Proxy(
    {},
    {
      get: (_, op: string) => async (args: unknown) => {
        llamadas.push({ op, args });
        return op === 'count' ? 0 : [];
      },
    },
  );
  const base = new Proxy({}, { get: () => delegado }) as unknown as ClienteBd;
  const ambito = crearAmbito(base, 7n);

  beforeEach(() => (llamadas.length = 0));

  it('agrega la tienda en modelos directos y por relación en heredados', async () => {
    await ambito.cliente.findMany({ where: { dni: '1' } });
    expect(llamadas[0].args).toEqual({ where: { dni: '1', tienda_id: 7n } });
    await ambito.cuota.findMany();
    expect(llamadas[1].args).toEqual({ where: { compra: { tienda_id: 7n } } });
    await ambito.pago.count();
    expect(llamadas[2].args).toEqual({ where: { listado_pago: { tienda_id: 7n } } });
  });

  it('un where con otra tienda no puede ganarle al ámbito', async () => {
    await ambito.cliente.findMany({ where: { tienda_id: 99n } });
    expect(llamadas[0].args).toEqual({ where: { tienda_id: 7n } });
  });

  it('fija la tienda al crear en modelos directos', async () => {
    await ambito.producto.create({ data: { tienda_id: 99n } as never });
    expect(llamadas[0].args).toEqual({ data: { tienda_id: 7n } });
  });

  it('rechaza un padre de otra tienda', async () => {
    await expect(ambito.cuota.createMany({ data: [{ compra_id: 1n } as never] })).rejects.toThrow(FueraDeAmbito);
  });

  it('lanza error con modelos globales, borrados, consultas crudas y create con trigger', () => {
    const a = ambito as unknown as Record<string, unknown>;
    for (const prop of ['usuario', 'tienda', 'auditoria', '$queryRaw', '$executeRaw', '$queryRawUnsafe']) {
      expect(() => a[prop]).toThrow(FueraDeAmbito);
    }
    expect(() => ambito.cliente.delete({ where: { id: 1n } })).toThrow(FueraDeAmbito);
    expect(() => ambito.cliente.deleteMany()).toThrow(FueraDeAmbito);
    expect(() => ambito.compra_detalle.create({ data: {} as never })).toThrow(FueraDeAmbito);
    expect(() => ambito.listado_item.create({ data: {} as never })).toThrow(FueraDeAmbito);
  });
});
