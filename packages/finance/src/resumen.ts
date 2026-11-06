import { aDec, Dec, Entrada, soles } from './decimal';
import { liquidarAFecha, Moneda, simboloMoneda } from './pago';
import { validarMontoPositivo } from './validaciones';

/** 6.3i: Disp = L − SU. SU es siempre un dato de entrada: el motor no decide cómo se obtiene. */
export function creditoDisponible(limite: Entrada, su: Entrada): Dec {
  return aDec(limite).minus(aDec(su));
}

/** Principal (Figura 23): se rechaza solo si el monto supera el disponible. */
export function evaluarLimite(a: {
  monto: Entrada;
  limite: Entrada;
  su: Entrada;
  moneda?: Moneda;
}) {
  validarMontoPositivo(a.monto, 'El monto de la compra');
  const disponible = creditoDisponible(a.limite, a.su);
  if (aDec(a.monto).gt(disponible)) {
    return {
      aceptada: false as const,
      disponible,
      mensaje: `Compra rechazada: supera el crédito disponible de ${simboloMoneda(a.moneda)} ${soles(disponible)}.`,
    };
  }
  return { aceptada: true as const, disponible };
}

/** 6.3m: CPC = Σ SU_c. */
export function capitalPorCobrar(saldos: Entrada[]): Dec {
  return saldos.reduce<Dec>((s, x) => s.plus(aDec(x)), new Dec(0));
}

/** 6.3m: Uso_c = SU_c / L_c × 100, sin redondear. La pantalla lo muestra con 1 decimal. */
export function usoLimite(su: Entrada, limite: Entrada): Dec {
  return aDec(su).div(aDec(limite)).times(100);
}

/** 6.3m: Deuda_h = T + Red(T·[(1+TEDm)^D(Fpago,h) − 1]) + S_pend. */
export function deudaALaFecha(a: {
  total: Entrada;
  tedMora: Entrada;
  fechaPago: string;
  hoy: string;
  saldoPendiente: Entrada;
}): Dec {
  const { totalALaFecha } = liquidarAFecha({
    total: a.total,
    tedMora: a.tedMora,
    fechaPago: a.fechaPago,
    fechaOperativaPago: a.hoy,
  });
  return totalALaFecha.plus(aDec(a.saldoPendiente));
}
