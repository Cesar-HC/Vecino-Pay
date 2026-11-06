import { asignarCiclo } from './ciclo';
import { planDeCuotas } from './cuotas';
import { aDec, Dec, Entrada, red } from './decimal';
import { ErrorFinanciero } from './errores';
import { tasaEfectivaDiaria, tea } from './tasas';
import { validarNumeroCuotas, validarPrecios } from './validaciones';

export interface Flujo {
  monto: Entrada;
  t: number;
}

const TOLERANCIA = new Dec('0.000001');
const MAX_ITERACIONES = 200;
const SIN_RAIZ =
  'No se puede calcular la TIR: no hay una tasa diaria entre 0 % y 1 % que iguale las cuotas con el monto.';

function valorActual(flujos: Flujo[], r: Dec): Dec {
  const base = r.plus(1);
  return flujos.reduce((s, f) => s.plus(aDec(f.monto).div(base.pow(f.t))), new Dec(0));
}

/** TirDiaria (Figura 39, 6.3k): bisección en [0, 0.01] hasta que |VA − P| < 0.000001. */
export function tirDiaria(p: Entrada, flujos: Flujo[]): Dec {
  const monto = aDec(p);
  let bajo = new Dec(0);
  let alto = new Dec('0.01');
  if (valorActual(flujos, bajo).lt(monto) || valorActual(flujos, alto).gt(monto)) {
    throw new ErrorFinanciero('TIR_SIN_RAIZ', SIN_RAIZ);
  }
  for (let i = 0; i < MAX_ITERACIONES; i++) {
    const r = bajo.plus(alto).div(2);
    const va = valorActual(flujos, r);
    if (va.minus(monto).abs().lt(TOLERANCIA)) return r;
    if (va.gt(monto)) bajo = r;
    else alto = r;
  }
  throw new ErrorFinanciero('TIR_SIN_RAIZ', SIN_RAIZ);
}

/**
 * IndicadoresVenta (Figura 41, 6.3k). La TCEA usa el precio de lista y el VAN el contado.
 * El VAN acumula sin redondear y aplica Red al final; los valores actuales redondeados solo se muestran.
 */
export function indicadoresVenta(a: {
  p: Entrada;
  pContado: Entrada;
  flujos: Flujo[];
  cok: Entrada;
}) {
  const tir = tirDiaria(a.p, a.flujos);
  const tedCok = tasaEfectivaDiaria({ tipo: 'EFECTIVA', valor: a.cok, plazo: 360 });
  const base = tedCok.plus(1);
  const sinRedondear = a.flujos.map((f) => aDec(f.monto).div(base.pow(f.t)));
  const suma = sinRedondear.reduce((s, x) => s.plus(x), new Dec(0));
  return {
    tirDiaria: tir,
    tcea: tea(tir),
    tedCok,
    valoresActuales: sinRedondear.map((x) => red(x)),
    sumaVa: red(suma),
    van: red(suma.minus(aDec(a.pContado))),
  };
}

/** Principal, rama CUOTAS (Figura 23): lo que el simulador de D04 muestra antes de confirmar. */
export function simularVentaEnCuotas(a: {
  p: Entrada;
  pContado: Entrada;
  ted: Entrada;
  n: number;
  maxMeses: number;
  cok: Entrada;
  fechaOperativa: string;
  diaCorte: number;
  diaPago: number;
}) {
  validarNumeroCuotas(a.n, a.maxMeses);
  validarPrecios(a.pContado, a.p);
  const ciclo = asignarCiclo(a);
  const plan = planDeCuotas({
    p: a.p,
    ted: a.ted,
    n: a.n,
    fechaOperativa: a.fechaOperativa,
    fechaPago: ciclo.fechaPago,
  });
  const indicadores = indicadoresVenta({
    p: a.p,
    pContado: a.pContado,
    cok: a.cok,
    flujos: plan.filas.map((f) => ({ monto: f.cuota, t: f.t })),
  });
  return { ciclo, plan, indicadores };
}
