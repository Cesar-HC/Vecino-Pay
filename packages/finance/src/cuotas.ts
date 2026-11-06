import { diasEntre, sumarMeses } from './calendario';
import { aDec, Dec, Entrada, red } from './decimal';
import { ErrorFinanciero } from './errores';
import { tasaDeDias } from './tasas';
import {
  validarDias,
  validarEntero,
  validarMontoPositivo,
  validarTasaDiaria,
} from './validaciones';

/** 6.3j: P' = Red(P·(1+TED)^g). */
export function capitalCapitalizado(p: Entrada, ted: Entrada, g: number): Dec {
  validarDias(g, 'Los días de gracia');
  validarTasaDiaria(ted);
  return red(aDec(p).times(aDec(ted).plus(1).pow(g)));
}

/** 6.3j: R = Red(P' / Σ (1+TED)^(−T_k)). */
export function cuotaFrancesa(capital: Entrada, ted: Entrada, dias: number[]) {
  if (dias.length === 0) {
    throw new ErrorFinanciero('CUOTAS_RANGO', 'El número de cuotas debe ser como mínimo 1.');
  }
  validarTasaDiaria(ted);
  const base = aDec(ted).plus(1);
  const sumaFactores = dias.reduce((s, T) => s.plus(new Dec(1).div(base.pow(T))), new Dec(0));
  return { cuota: red(aDec(capital).div(sumaFactores)), sumaFactores };
}

export interface FilaCronograma {
  k: number;
  vence: string;
  diasPeriodo: number;
  /** Días desde la fecha de pago del ciclo. */
  T: number;
  /** Días desde la compra: g + T. */
  t: number;
  saldoInicial: Dec;
  interes: Dec;
  amortizacion: Dec;
  cuota: Dec;
  saldoFinal: Dec;
}

/**
 * PlanDeCuotas (Figura 37, 6.3j): gracia total, cuota francesa con días exactos y cronograma.
 * El interés de cada fila usa los días reales del período, no la TEM. La última cuota es saldo más interés.
 */
export function planDeCuotas(a: {
  p: Entrada;
  ted: Entrada;
  n: number;
  fechaOperativa: string;
  fechaPago: string;
}) {
  validarMontoPositivo(a.p, 'El monto de la compra');
  validarEntero(a.n, 'El número de cuotas');
  if (a.n < 1) {
    throw new ErrorFinanciero('CUOTAS_RANGO', 'El número de cuotas debe ser como mínimo 1.');
  }
  const g = diasEntre(a.fechaOperativa, a.fechaPago);
  if (g < 0) {
    throw new ErrorFinanciero(
      'FECHA_ORDEN',
      'La fecha de la compra no puede ser posterior a su fecha de pago.',
    );
  }
  const p = aDec(a.p);
  const capital = capitalCapitalizado(p, a.ted, g);
  const vencimientos = Array.from({ length: a.n }, (_, i) => sumarMeses(a.fechaPago, i + 1));
  const dias = vencimientos.map((f) => diasEntre(a.fechaPago, f));
  const { cuota: cuotaFija, sumaFactores } = cuotaFrancesa(capital, a.ted, dias);

  const filas: FilaCronograma[] = [];
  let saldo = capital;
  let anterior = 0;
  for (let i = 0; i < a.n; i++) {
    const diasPeriodo = dias[i] - anterior;
    const interes = red(saldo.times(tasaDeDias(a.ted, diasPeriodo)));
    const ultima = i === a.n - 1;
    const amortizacion = ultima ? saldo : cuotaFija.minus(interes);
    const cuota = ultima ? saldo.plus(interes) : cuotaFija;
    const saldoFinal = saldo.minus(amortizacion);
    if (!cuota.gt(0) || saldoFinal.isNegative()) {
      throw new ErrorFinanciero(
        'MONTO',
        `El monto de la compra es demasiado pequeño para dividirlo en ${a.n} cuotas.`,
      );
    }
    filas.push({
      k: i + 1,
      vence: vencimientos[i],
      diasPeriodo,
      T: dias[i],
      t: g + dias[i],
      saldoInicial: saldo,
      interes,
      amortizacion,
      cuota,
      saldoFinal,
    });
    saldo = saldoFinal;
    anterior = dias[i];
  }

  const suma = (f: (x: FilaCronograma) => Dec) => filas.reduce((s, x) => s.plus(f(x)), new Dec(0));
  const totalCuotas = suma((x) => x.cuota);
  return {
    g,
    capitalCapitalizado: capital,
    interesGracia: capital.minus(p),
    cuotaFija,
    ultimaCuota: filas[filas.length - 1].cuota,
    sumaFactores,
    filas,
    totalInteresCuotas: suma((x) => x.interes),
    totalAmortizacion: suma((x) => x.amortizacion),
    totalCuotas,
    interesesTotales: totalCuotas.minus(p),
  };
}
