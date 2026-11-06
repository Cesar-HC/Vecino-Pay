import { aDec, Dec, deudaALaFecha } from '@vecinopay/finance';

export interface CompraParaSu {
  modalidad: string;
  estado: string;
  montoLista: Dec;
  cuotas: { numero: number; estado: string; saldoFinal: Dec }[];
}

/**
 * Capital pendiente de una compra (decisión de Adrián): monto de lista hasta pagar la cuota 1 y luego
 * saldo_final de la última pagada. Si se paga fuera de orden, cuenta la mayor k con 1..k pagadas.
 */
export function capitalPendienteCompra(c: CompraParaSu): Dec {
  if (c.estado === 'ANULADA' || c.estado === 'PAGADA') return new Dec(0);
  if (c.modalidad === 'FIN_MES') return c.montoLista;
  const orden = [...c.cuotas].sort((a, b) => a.numero - b.numero);
  let saldo = c.montoLista;
  for (const q of orden) {
    if (q.estado !== 'PAGADA') break;
    saldo = q.saldoFinal;
  }
  return saldo;
}

export function calcularSu(compras: CompraParaSu[]): Dec {
  return compras.reduce<Dec>((s, c) => s.plus(capitalPendienteCompra(c)), aDec('0'));
}

export interface DatosDeuda {
  /** Listados sin pagar del cliente. */
  listados: { total: Dec; totalCapital: Dec; fechaPago: string }[];
  /** Capital de las compras a fin de mes aún sin listar. */
  comprasSinListar: Dec[];
  /** Capital de las cuotas aún sin listar. Antes de la cuota 1 suman P'. */
  cuotasSinListar: Dec[];
  tedMora: Dec;
  /** Fecha operativa h. */
  hoy: string;
}

/**
 * Deuda a la fecha (6.3m, decisión de Adrián): T del listado vencido no pagado, más su mora a h, más el capital de
 * las cuotas que aún no vencen. Extensiones que el informe no define: los listados no vencidos y las compras sin
 * listar suman su capital, sin interés. No usa SU: antes de la cuota 1, SU es 257.80 y aquí el saldo es P' (261.07).
 */
export function calcularDeuda(d: DatosDeuda): Dec {
  const sinListar = [...d.comprasSinListar, ...d.cuotasSinListar].reduce<Dec>((s, x) => s.plus(x), aDec('0'));
  return d.listados.reduce<Dec>(
    (s, l) =>
      l.fechaPago < d.hoy
        ? deudaALaFecha({ total: l.total, tedMora: d.tedMora, fechaPago: l.fechaPago, hoy: d.hoy, saldoPendiente: s })
        : s.plus(l.totalCapital),
    sinListar,
  );
}
