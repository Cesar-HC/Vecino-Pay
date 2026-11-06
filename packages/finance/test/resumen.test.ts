import { capitalPorCobrar, creditoDisponible, deudaALaFecha, usoLimite } from '../src';
import { f2, VARIANTES_TED } from './apoyo';

describe('6.3m y C03: indicadores al 22/09/2026', () => {
  it('capital por cobrar 223.62 + 21.30 + 257.80 = 502.72', () => {
    expect(f2(capitalPorCobrar(['223.62', '21.30', '257.80']))).toBe('502.72');
  });
  it('uso del límite de Luis 49.0 % y de María 43.0 %', () => {
    expect(usoLimite('244.92', '500.00').toFixed(1)).toBe('49.0');
    expect(usoLimite('257.80', '600.00').toFixed(1)).toBe('43.0');
  });
  it('C03: Luis todavía puede comprar 255.08', () => {
    expect(f2(creditoDisponible('500.00', '244.92'))).toBe('255.08');
  });
});

describe.each(VARIANTES_TED)('6.3m: deuda a la fecha, con %s', (_n, t) => {
  it('con 5 días de atraso: 228.42 + 0.30 + saldo', () => {
    const d = deudaALaFecha({
      total: '228.42',
      tedMora: t.tedmLuis,
      fechaPago: '2026-09-26',
      hoy: '2026-10-01',
      saldoPendiente: '21.30',
    });
    expect(f2(d)).toBe('250.02');
  });
  it('antes de la fecha de pago no hay mora', () => {
    const d = deudaALaFecha({
      total: '228.42',
      tedMora: t.tedmLuis,
      fechaPago: '2026-09-26',
      hoy: '2026-09-22',
      saldoPendiente: '0',
    });
    expect(f2(d)).toBe('228.42');
  });
});
