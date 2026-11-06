import { aDec, Dec } from '@vecinopay/finance';

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
