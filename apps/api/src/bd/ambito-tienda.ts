import { Prisma } from '@prisma/client';

export const MODELOS_DIRECTOS = ['producto', 'cliente', 'compra', 'listado_pago'] as const;
/** Heredan la tienda por FK (Tablas 28, 29, 31 y 32). Cambiaría aquí si se agrega tienda_id a estas tablas. */
export const MODELOS_HEREDADOS: Record<string, { relacion: string; fk: string; padre: string }> = {
  compra_detalle: { relacion: 'compra', fk: 'compra_id', padre: 'compra' },
  cuota: { relacion: 'compra', fk: 'compra_id', padre: 'compra' },
  listado_item: { relacion: 'listado_pago', fk: 'listado_id', padre: 'listado_pago' },
  pago: { relacion: 'listado_pago', fk: 'listado_id', padre: 'listado_pago' },
};
export const MODELOS_GLOBALES = ['usuario', 'tienda', 'auditoria'] as const;

/** Con trigger de inserción: se insertan solo con createMany (fases 1-2, 9.1.3). */
const SOLO_CREATE_MANY = ['compra_detalle', 'listado_item'];
const PROHIBIDAS = ['delete', 'deleteMany', 'upsert'];
const CON_WHERE = [
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
];

export class FueraDeAmbito extends Error {}

export type ClienteBd = Prisma.TransactionClient;
type Operables = 'producto' | 'cliente' | 'compra' | 'listado_pago' | 'compra_detalle' | 'cuota' | 'listado_item' | 'pago';
/** Lo único que un servicio de operación puede tocar: modelos de su tienda. */
export type Ambito = Pick<ClienteBd, Operables>;

type Args = { where?: { AND?: unknown }; data?: object | object[]; include?: object; select?: object };
type Delegado = Record<string, (args?: Args) => Promise<unknown>>;

const OPERACIONES_ANIDADAS = ['connect', 'connectOrCreate', 'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'set', 'disconnect'];

/** Nada de cambiar de tienda ni de tocar otras tablas a través de una relación. */
function exigirDatosPlanos(modelo: string, data: object | object[] | undefined, permitirTienda: boolean) {
  for (const fila of [data ?? []].flat() as Record<string, unknown>[]) {
    if (!permitirTienda && 'tienda_id' in fila) throw new FueraDeAmbito(`No se puede cambiar la tienda de ${modelo}.`);
    for (const valor of Object.values(fila)) {
      if (valor && typeof valor === 'object' && OPERACIONES_ANIDADAS.some((op) => op in valor)) {
        throw new FueraDeAmbito(`${modelo} no admite escrituras anidadas.`);
      }
    }
  }
}

/** Un include o select no puede llegar a los modelos globales con datos sensibles. */
function exigirLecturaPermitida(modelo: string, proyeccion: unknown) {
  if (!proyeccion || typeof proyeccion !== 'object') return;
  for (const [clave, valor] of Object.entries(proyeccion)) {
    if ((clave === 'usuario' || clave === 'auditoria') && valor) {
      throw new FueraDeAmbito(`${modelo} no puede incluir ${clave}.`);
    }
    exigirLecturaPermitida(modelo, valor);
  }
}

/**
 * Envuelve al cliente Prisma (o a una transacción) para que toda consulta quede dentro de la tienda.
 * Lanza FueraDeAmbito con modelos globales, borrados, consultas crudas o un padre de otra tienda.
 */
export function crearAmbito(base: ClienteBd, tiendaId: bigint): Ambito {
  const raiz = base as unknown as Record<string, Delegado>;

  const envolver = (modelo: string): Delegado => {
    const delegado = raiz[modelo];
    const heredado = MODELOS_HEREDADOS[modelo];
    const filtro = heredado ? { [heredado.relacion]: { tienda_id: tiendaId } } : { tienda_id: tiendaId };

    const comprobarPadres = async (filas: Record<string, unknown>[]) => {
      if (!heredado) return;
      const ids = [...new Set(filas.map((f) => f[heredado.fk] as bigint))];
      const encontrados = await raiz[heredado.padre].count({
        where: { id: { in: ids }, tienda_id: tiendaId },
      } as Args);
      if (encontrados !== ids.length) throw new FueraDeAmbito(`El padre de ${modelo} no es de esta tienda.`);
    };
    const fijar = (d: object) => (heredado ? d : { ...d, tienda_id: tiendaId });

    return new Proxy(delegado, {
      get(obj, op: string) {
        const original = obj[op];
        if (typeof original !== 'function') return original;
        if (PROHIBIDAS.includes(op)) {
          return () => {
            throw new FueraDeAmbito(`${op} no está permitido en ${modelo}.`);
          };
        }
        if (op === 'create') {
          if (SOLO_CREATE_MANY.includes(modelo)) {
            return () => {
              throw new FueraDeAmbito(`${modelo} solo admite createMany.`);
            };
          }
          return async (args: Args) => {
            exigirDatosPlanos(modelo, args.data, true);
            exigirLecturaPermitida(modelo, args.include);
            exigirLecturaPermitida(modelo, args.select);
            await comprobarPadres([args.data as Record<string, unknown>]);
            return original.call(obj, { ...args, data: fijar(args.data as object) });
          };
        }
        if (op === 'createMany') {
          return async (args: Args) => {
            const filas = (Array.isArray(args.data) ? args.data : [args.data]) as Record<string, unknown>[];
            if (filas.length === 0) return { count: 0 };
            exigirDatosPlanos(modelo, filas, true);
            await comprobarPadres(filas);
            return original.call(obj, { ...args, data: filas.map(fijar) });
          };
        }
        if (CON_WHERE.includes(op)) {
          return (args: Args = {}) => {
            exigirDatosPlanos(modelo, args.data, false);
            exigirLecturaPermitida(modelo, args.include);
            exigirLecturaPermitida(modelo, args.select);
            // Con AND y no por claves: otro filtro sobre la misma relación no se pisa con el de la tienda.
            const previos = args.where?.AND === undefined ? [] : [args.where.AND].flat();
            return original.call(obj, { ...args, where: { ...args.where, AND: [...previos, filtro] } });
          };
        }
        return () => {
          throw new FueraDeAmbito(`${op} no está permitido en ${modelo}.`);
        };
      },
    });
  };

  const cache = new Map<string, Delegado>();
  return new Proxy({} as Ambito, {
    get(_, prop: string) {
      if (![...MODELOS_DIRECTOS, ...Object.keys(MODELOS_HEREDADOS)].includes(prop as never)) {
        throw new FueraDeAmbito(`${prop} no está disponible dentro del ámbito de una tienda.`);
      }
      if (!cache.has(prop)) cache.set(prop, envolver(prop));
      return cache.get(prop);
    },
  });
}
