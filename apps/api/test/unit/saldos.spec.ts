import { Dec, red } from '@vecinopay/finance';
import { calcularDeuda, calcularSu, capitalPendienteCompra, CompraParaSu } from '../../src/clientes/saldos';

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

describe('deuda a la fecha (6.3m, decisión de Adrián)', () => {
  const tedMoraMaria = d('0.000314851458950');
  const tedMoraLuis = d('0.000264785548963');
  const cuotas = [d('84.11'), d('86.85'), d('90.11')];
  const cuota1 = { total: d('93.25'), totalCapital: d('84.11'), fechaPago: '2026-10-26' };
  const texto = (x: Dec) => x.toFixed(2);

  it('María al 28/10, con la cuota 1 vencida: 93.25 + 0.06 + 176.96 = 270.27', () => {
    expect(texto(calcularDeuda({ listados: [cuota1], comprasSinListar: [], cuotasSinListar: cuotas.slice(1), tedMora: tedMoraMaria, hoy: '2026-10-28' }))).toBe('270.27');
  });

  it("antes de la cuota 1, el saldo es P' (261.07), no SU", () => {
    expect(texto(calcularDeuda({ listados: [], comprasSinListar: [], cuotasSinListar: cuotas, tedMora: tedMoraMaria, hoy: '2026-09-22' }))).toBe('261.07');
  });

  it('un listado no vencido suma su capital sin interés, también el mismo día de pago', () => {
    for (const hoy of ['2026-10-22', '2026-10-26']) {
      expect(texto(calcularDeuda({ listados: [cuota1], comprasSinListar: [], cuotasSinListar: cuotas.slice(1), tedMora: tedMoraMaria, hoy }))).toBe('261.07');
    }
  });

  const listadoLuis = { total: d('228.42'), totalCapital: d('223.62'), fechaPago: '2026-09-26' };

  it('Luis al 22/09: listado no vencido y compra sin listar suman capital: 244.92', () => {
    expect(texto(calcularDeuda({ listados: [listadoLuis], comprasSinListar: [d('21.30')], cuotasSinListar: [], tedMora: tedMoraLuis, hoy: '2026-09-22' }))).toBe('244.92');
  });

  it('Luis al 01/10: 228.42 + 0.30 + 21.30 = 250.02', () => {
    expect(texto(calcularDeuda({ listados: [listadoLuis], comprasSinListar: [d('21.30')], cuotasSinListar: [], tedMora: tedMoraLuis, hoy: '2026-10-01' }))).toBe('250.02');
  });

  it('sin nada pendiente, 0.00', () => {
    expect(texto(calcularDeuda({ listados: [], comprasSinListar: [], cuotasSinListar: [], tedMora: tedMoraLuis, hoy: '2026-10-01' }))).toBe('0.00');
  });
});
