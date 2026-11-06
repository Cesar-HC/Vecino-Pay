import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GuardRoles } from '../../src/auth/guardias';
import { CLAVE_PUBLICO } from '../../src/comun/utilidades';
import { detalleParaAdmin, armarDetalle } from '../../src/auditoria/detalle';
import { crearAmbito, FueraDeAmbito, MODELOS_DIRECTOS, MODELOS_GLOBALES, MODELOS_HEREDADOS, ClienteBd } from '../../src/bd/ambito-tienda';
import { aDecBd, aInstanteBd, dePartesBd } from '../../src/bd/conversiones';
import { leerEnv } from '../../src/config/cargar-env';
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
  it('uid=sa y username=sa también se rechazan; el secreto conocido avisa en desarrollo', () => {
    expect(problemas({ NODE_ENV: 'test', JWT_SECRET: 'a', DATABASE_URL: 'sqlserver://db;uid=sa;password=x' })).toHaveLength(1);
    expect(problemas({ NODE_ENV: 'test', JWT_SECRET: 'a', DATABASE_URL: 'sqlserver://db;username=sa;password=x' })).toHaveLength(1);
    expect(cargarConfiguracion({ NODE_ENV: 'development', JWT_SECRET: 'cambia-este-secreto', DATABASE_URL: URL_OK }).avisos).toHaveLength(1);
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

describe('lectura de .env', () => {
  it('conserva el # de las claves y quita comentarios y comillas', () => {
    expect(leerEnv('A=Vecino#2026
B="x y" # nota
C=z # nota
# D=1
E=
F=a;b=c#d')).toEqual({ A: 'Vecino#2026', B: 'x y', C: 'z', E: '', F: 'a;b=c#d' });
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
  it('enmascara también un importe sin símbolo', () => {
    expect(detalleParaAdmin('Pago de 9.15 del listado EC-202609-00001')).toBe('Pago de *** del listado EC-202609-00001');
  });
});

describe('guardia de roles', () => {
  const contexto = (perfil: string) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ contexto: { perfil } }) }),
    }) as never;
  const guardia = (publico: boolean, roles?: string[]) =>
    new GuardRoles({ getAllAndOverride: (clave: string) => (clave === CLAVE_PUBLICO ? publico : roles) } as never);

  it('una ruta sin @Publico ni @Roles responde 403', () => {
    expect(() => guardia(false).canActivate(contexto('ADMIN_SISTEMA'))).toThrow(ForbiddenException);
  });
  it('un perfil que no está en @Roles responde 403; el que está, pasa', () => {
    expect(() => guardia(false, ['DUENO']).canActivate(contexto('CLIENTE'))).toThrow(ForbiddenException);
    expect(guardia(false, ['DUENO']).canActivate(contexto('DUENO'))).toBe(true);
    expect(guardia(true).canActivate(contexto('CLIENTE'))).toBe(true);
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
    expect(llamadas[0].args).toEqual({ where: { dni: '1', AND: [{ tienda_id: 7n }] } });
    await ambito.cuota.findMany();
    expect(llamadas[1].args).toEqual({ where: { AND: [{ compra: { tienda_id: 7n } }] } });
    await ambito.pago.count();
    expect(llamadas[2].args).toEqual({ where: { AND: [{ listado_pago: { tienda_id: 7n } }] } });
  });

  it('un where con otra tienda se combina con AND: no le gana al ámbito', async () => {
    await ambito.cliente.findMany({ where: { tienda_id: 99n } });
    expect(llamadas[0].args).toEqual({ where: { tienda_id: 99n, AND: [{ tienda_id: 7n }] } });
  });

  it('otro filtro sobre la misma relación no se pisa con el de la tienda', async () => {
    await ambito.pago.findMany({ where: { listado_pago: { cliente_id: 5n } } });
    expect(llamadas[0].args).toEqual({ where: { listado_pago: { cliente_id: 5n }, AND: [{ listado_pago: { tienda_id: 7n } }] } });
  });

  it('no deja cambiar de tienda, escribir por una relación ni leer modelos globales', () => {
    expect(() => ambito.producto.update({ where: { id: 1n }, data: { tienda_id: 2n } as never })).toThrow(FueraDeAmbito);
    expect(() => ambito.producto.update({ where: { id: 1n }, data: { tienda: { connect: { id: 2n } } } })).toThrow(FueraDeAmbito);
    expect(() => ambito.cliente.findMany({ include: { usuario: true } })).toThrow(FueraDeAmbito);
    expect(() => ambito.compra.findMany({ include: { tienda: { include: { usuario: true } } } })).toThrow(FueraDeAmbito);
    expect(() => ambito.compra.findMany({ select: { cliente: { select: { usuario: true } } } })).toThrow(FueraDeAmbito);
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
