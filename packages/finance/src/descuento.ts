import { aDec, Dec, Entrada, red } from './decimal';
import { validarDias } from './validaciones';

function factorEfectivo(tea: Entrada, td: number): Dec {
  validarDias(td, 'Los días de descuento');
  return aDec(tea).plus(1).pow(new Dec(td).div(360));
}

/** 6.3l: TE = (1+TEA)^(td/360) − 1; d = TE/(1+TE); Descuento = Red(VN·d); Neto = VN − Descuento. */
export function valorHoy(a: { vn: Entrada; tea: Entrada; td: number }) {
  const te = factorEfectivo(a.tea, a.td).minus(1);
  const d = te.div(te.plus(1));
  const vn = aDec(a.vn);
  const descuento = red(vn.times(d));
  return { te, d, descuento, neto: vn.minus(descuento) };
}

/** 6.3l, relación inversa: TE = d/(1 − d). */
export function efectivaDesdeDescontada(d: Entrada): Dec {
  const dd = aDec(d);
  return dd.div(new Dec(1).minus(dd));
}

/** Tabla 14: VN / (1+TEA)^(td/360). */
export function valorPresenteEfectiva(a: { vn: Entrada; tea: Entrada; td: number }) {
  const vn = aDec(a.vn);
  const neto = red(vn.div(factorEfectivo(a.tea, a.td)));
  return { descuento: vn.minus(neto), neto };
}

/** Tabla 14: VN / (1 + i·td/360). Solo para comparar. */
export function valorPresenteSimple(a: { vn: Entrada; tasa: Entrada; td: number }) {
  validarDias(a.td, 'Los días de descuento');
  const vn = aDec(a.vn);
  const neto = red(vn.div(aDec(a.tasa).times(a.td).div(360).plus(1)));
  return { descuento: vn.minus(neto), neto };
}
