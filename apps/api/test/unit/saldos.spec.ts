import { Dec, red } from '@vecinopay/finance';
import { calcularSu, capitalPendienteCompra, CompraParaSu } from '../../src/clientes/saldos';

const d = (x: string) => new Dec(x);
const cuotas = (pagadas: number[]) =>
  [
    { numero: 1, saldoFinal: d('176.96') },
    { numero: 2, saldoFinal: d('90.11') },
    { numero: 3, saldoFinal: d('0.00') },
  ].map((q) => ({ ...q, estado: pagadas.includes(q.numero) ? 'PAGADA' : 'PENDIENTE' }));
const maria = (pagadas: number[], estado = 'PENDIENTE'): CompraParaSu => ({
  modalidad: 'CUOTAS',
  estado,
  montoLista: d('257.80'),
  cuotas: cuotas(pagadas),
});
const texto = (c: CompraParaSu) => red(capitalPendienteCompra(c)).toFixed(2);

describe('capital pendiente (decisión de Adrián)', () => {
  it('María: 257.80, 176.96, 90.11 y 0.00', () => {
    expect(texto(maria([]))).toBe('257.80');
    expect(texto(maria([1]))).toBe('176.96');
    expect(texto(maria([1, 2]))).toBe('90.11');
    expect(texto(maria([1, 2, 3]))).toBe('0.00');
  });

  it('pago fuera de orden: la cuota 3 sin la 2 deja el saldo de la 1', () => {
    expect(texto(maria([1, 3]))).toBe('176.96');
    expect(texto(maria([3]))).toBe('257.80');
  });

  it('compra pagada o anulada no cuenta', () => {
    expect(texto(maria([1, 2, 3], 'PAGADA'))).toBe('0.00');
    expect(texto(maria([], 'ANULADA'))).toBe('0.00');
  });

  it('Luis al 22/09: las compras a fin de mes pendientes suman 244.92', () => {
    const compras = ['44.20', '32.80', '63.82', '30.50', '52.30', '21.30'].map((m) => ({
      modalidad: 'FIN_MES',
      estado: 'PENDIENTE',
      montoLista: d(m),
      cuotas: [],
    }));
    expect(calcularSu(compras).toFixed(2)).toBe('244.92');
  });
});
