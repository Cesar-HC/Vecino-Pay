import { aDec, Dec, Entrada, red } from './decimal';
import { validarEntero } from './validaciones';

/** 6.3a: I_s = C·i·d/360. VecinoPay no cobra con interés simple; solo sirve para comparar (6.3n). */
export function interesSimple(c: Entrada, tasa: Entrada, dias: number): Dec {
  validarEntero(dias, 'El número de días');
  return red(aDec(c).times(aDec(tasa)).times(dias).div(360));
}

/** 6.3a: S = C + I_s. */
export function montoSimple(c: Entrada, tasa: Entrada, dias: number): Dec {
  return aDec(c).plus(interesSimple(c, tasa, dias));
}

/** 6.3b: S = C·(1+TEA)^(d/360). */
export function montoCompuesto(c: Entrada, tea: Entrada, dias: number): Dec {
  validarEntero(dias, 'El número de días');
  return red(aDec(c).times(aDec(tea).plus(1).pow(new Dec(dias).div(360))));
}
