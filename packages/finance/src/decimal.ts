import Decimal from 'decimal.js';
import { ErrorFinanciero } from './errores';

/** Decimal del motor: precisión amplia para potencias con exponente fraccionario. */
export const Dec = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
export type Dec = Decimal;

/** Dinero y tasas entran como texto o Decimal, nunca como number (evita errores de float). */
export type Entrada = string | Decimal;

export function aDec(x: Entrada): Decimal {
  if (typeof x !== 'string' && !Decimal.isDecimal(x)) {
    throw new ErrorFinanciero(
      'ENTRADA_NO_DECIMAL',
      'Los montos y las tasas deben enviarse como texto o Decimal, no como number.',
    );
  }
  const valido = typeof x === 'string' ? /^-?\d+(\.\d+)?$/.test(x) : x.isFinite();
  if (!valido) {
    throw new ErrorFinanciero(
      'ENTRADA_INVALIDA',
      `El valor ${String(x)} no es válido: use un número decimal con punto, por ejemplo 228.42.`,
    );
  }
  return new Dec(x);
}

/** Redondear2 (Tabla 21). 6.3e: Red(x) = floor(100x + 0.5) / 100, con piso también para negativos. */
export function red(x: Entrada): Decimal {
  return aDec(x).times(100).plus('0.5').floor().div(100);
}

/** Importe con 2 decimales para mostrar. Solo para valores ya redondeados con red. */
export function soles(x: Entrada): string {
  return aDec(x).toFixed(2);
}
