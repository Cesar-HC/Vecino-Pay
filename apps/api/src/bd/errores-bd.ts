import { Prisma } from '@prisma/client';

/** Tabla por columnas o nombre del índice, cuando Prisma no informa el modelo. */
const TABLA_POR_OBJETIVO: [RegExp, string][] = [
  [/username|uq_usuario/i, 'usuario'],
  [/ruc|uq_tienda/i, 'tienda'],
  [/tienda_id,codigo$|uq_producto/i, 'producto'],
  [/tienda_id,dni|usuario_id|tienda_id,codigo_activacion|ux_cliente|uq_cliente/i, 'cliente'],
  [/tienda_id,ticket|uq_compra/i, 'compra'],
  [/cliente_id,fecha_corte|tienda_id,numero|uq_listado/i, 'listado_pago'],
  [/listado_id,orden|uq_item/i, 'listado_item'],
  [/compra_id,numero|uq_cuota/i, 'cuota'],
  [/listado_id|uq_pago/i, 'pago'],
];

/**
 * Nombre lógico de la tabla de la restricción única violada (P2002): "usuario", "tienda", "producto"...
 * Devuelve null si el error es otro. Un P2002 que no se reconoce devuelve el texto original, nunca null,
 * para que los llamadores sigan reintentando o respondiendo 409.
 */
export function restriccionUnica(e: unknown): string | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return null;
  const modelo = e.meta?.modelName;
  if (typeof modelo === 'string' && modelo) return modelo;
  const objetivo = e.meta?.target;
  const texto = Array.isArray(objetivo) ? objetivo.join(',') : String(objetivo ?? e.message);
  return TABLA_POR_OBJETIVO.find(([patron]) => patron.test(texto))?.[1] ?? texto;
}
