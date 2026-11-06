import { diasEntre } from './calendario';
import { aDec, Dec, Entrada, red, soles } from './decimal';
import { ErrorFinanciero } from './errores';
import { tasaDeDias } from './tasas';
import { validarTasaDiaria } from './validaciones';

export type Moneda = 'PEN' | 'USD';

export function simboloMoneda(moneda: Moneda = 'PEN'): string {
  return moneda === 'USD' ? 'US$' : 'S/';
}

/** 6.3i: Im = Red(T·[(1+TEDm)^dm − 1]) si el pago es tardío; Tr = T + Im. */
export function liquidarAFecha(a: {
  total: Entrada;
  tedMora: Entrada;
  fechaPago: string;
  fechaOperativaPago: string;
}) {
  validarTasaDiaria(a.tedMora);
  const total = aDec(a.total);
  const diasMora = Math.max(diasEntre(a.fechaPago, a.fechaOperativaPago), 0);
  const mora = diasMora > 0 ? red(total.times(tasaDeDias(a.tedMora, diasMora))) : new Dec(0);
  return { diasMora, mora, totalALaFecha: total.plus(mora) };
}

/**
 * RegistrarPago (Figura 35). Solo acepta el total exacto a la fecha: rechaza el pago parcial y
 * también el mayor. Imputa en el orden de prelación: mora, interés compensatorio y capital.
 */
export function registrarPago(a: {
  total: Entrada;
  interes: Entrada;
  capital: Entrada;
  tedMora: Entrada;
  fechaPago: string;
  fechaOperativaPago: string;
  montoPagado: Entrada;
  moneda?: Moneda;
}) {
  if (!aDec(a.total).eq(aDec(a.interes).plus(aDec(a.capital)))) {
    throw new ErrorFinanciero(
      'MONTO',
      'El total debe ser igual al interés más el capital, para que el pago se impute completo.',
    );
  }
  const { diasMora, mora, totalALaFecha } = liquidarAFecha(a);
  if (!aDec(a.montoPagado).eq(totalALaFecha)) {
    return {
      aceptado: false as const,
      diasMora,
      mora,
      totalALaFecha,
      mensaje: `Pago rechazado: debe pagar el total de ${simboloMoneda(a.moneda)} ${soles(totalALaFecha)}. No se aceptan pagos parciales ni mayores.`,
    };
  }
  return {
    aceptado: true as const,
    diasMora,
    mora,
    totalALaFecha,
    imputacion: { mora, interes: aDec(a.interes), capital: aDec(a.capital) },
  };
}
