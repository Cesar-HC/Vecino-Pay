import { aDec, Dec, Entrada } from './decimal';
import { TasaPactada, validarDias, validarTasa, validarTasaDiaria } from './validaciones';

/** TasaEfectivaDiaria (Figura 29, 6.3f). Efectiva: (1+TEP)^(1/p) − 1. Nominal: (1+TN/m)^(1/c) − 1, con m = p/c. */
export function tasaEfectivaDiaria(t: TasaPactada): Dec {
  validarTasa(t);
  const valor = aDec(t.valor);
  if (t.tipo === 'EFECTIVA') {
    return valor.plus(1).pow(new Dec(1).div(t.plazo)).minus(1);
  }
  const c = t.capitalizacion ?? 1;
  const m = new Dec(t.plazo).div(c);
  return valor.div(m).plus(1).pow(new Dec(1).div(c)).minus(1);
}

/** TE_n de 6.3f: (1 + TED)^n − 1. También es i_k de la Tabla 9 con n = días del período. */
export function tasaDeDias(ted: Entrada, n: number): Dec {
  validarDias(n, 'El número de días');
  validarTasaDiaria(ted);
  return aDec(ted).plus(1).pow(n).minus(1);
}

/** TEM de referencia: 30 días. */
export function tem(ted: Entrada): Dec {
  return tasaDeDias(ted, 30);
}

/** TEA de referencia: 360 días. */
export function tea(ted: Entrada): Dec {
  return tasaDeDias(ted, 360);
}

/** Cuantiza una tasa para guardarla: DECIMAL(18,15) por defecto; la TCEA usa 10 decimales (Tabla 27). */
export function cuantizarTasa(x: Entrada, decimales = 15): Dec {
  return aDec(x).toDecimalPlaces(decimales, Dec.ROUND_HALF_UP);
}
