import Decimal from 'decimal.js';

export const MONTO_DIGITADO = /^\d{1,10}(\.\d{1,2})?$/;
export const PORCENTAJE_DIGITADO = /^\d{1,3}(\.\d{1,7})?$/;
export const CANTIDAD_DIGITADA = /^\d{1,7}(\.\d{1,3})?$/;

/** Lo digitado en porcentaje a tanto por uno, sin errores binarios: "42" → "0.42". */
export function porcentajeATantoPorUno(p: string): string {
  if (!PORCENTAJE_DIGITADO.test(p)) throw new Error('El porcentaje admite hasta 7 decimales.');
  return new Decimal(p).div(100).toFixed();
}

/** Tanto por uno a porcentaje para llenar un formulario: "0.450000000" → "45". */
export const tantoPorUnoAPorcentaje = (t: string): string => new Decimal(t).times(100).toString();

/** Solo para avisar en el formulario; quien decide es la API. */
export const listaMenorQueContado = (contado: string, lista: string): boolean =>
  new Decimal(lista).lessThan(contado);

/** Con un texto que no es número responde false: el mensaje lo da la validación del formato. */
export function mayorQueCero(x: string): boolean {
  try {
    return new Decimal(x).greaterThan(0);
  } catch {
    return false;
  }
}

/** Para comparar montos sin pasar por number. */
export const esMayor = (a: string, b: string): boolean => new Decimal(a).greaterThan(b);

/** Enteros de lista (plazo, cuotas, mes): no son montos. */
export const aEntero = (x: string | number): number => parseInt(String(x), 10);
