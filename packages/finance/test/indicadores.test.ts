import { Dec, indicadoresVenta } from '../src';
import { f2, fN } from './apoyo';

const FLUJOS = [
  { monto: '93.25', t: 41 },
  { monto: '93.25', t: 72 },
  { monto: '93.26', t: 102 },
];
const r = indicadoresVenta({ p: '257.80', pContado: '249.80', flujos: FLUJOS, cok: '0.20' });

describe('Tabla 22: flujo de caja de la venta en cuotas', () => {
  it('TED del COK 0.0005065770', () => {
    expect(fN(r.tedCok, 10)).toBe('0.0005065770');
  });
  it('valores actuales 91.33, 89.91 y 88.56', () => {
    expect(r.valoresActuales.map(f2)).toEqual(['91.33', '89.91', '88.56']);
  });
  it('suma de valores actuales 269.81 y VAN 20.01', () => {
    expect(f2(r.sumaVa)).toBe('269.81');
    expect(f2(r.van)).toBe('20.01');
  });
  it('relación 269.81 / 249.80 = 1.08', () => {
    expect(fN(r.sumaVa.div('249.80'), 2)).toBe('1.08');
  });
});

describe('Decisiones de cálculo', () => {
  it('Figura 41: el VAN no usa los valores actuales redondeados, que sumarían 269.80', () => {
    const sumaRedondeados = r.valoresActuales.reduce((s, x) => s.plus(x), new Dec(0));
    expect(f2(sumaRedondeados)).toBe('269.80');
    expect(f2(sumaRedondeados.minus('249.80'))).toBe('20.00');
    expect(f2(r.van)).toBe('20.01');
  });
  it('6.3k y Figura 39: la tolerancia se aplica a VA − P', () => {
    expect(fN(r.tirDiaria, 10)).toBe('0.0011469966');
    const va = FLUJOS.reduce(
      (s, f) => s.plus(new Dec(f.monto).div(r.tirDiaria.plus(1).pow(f.t))),
      new Dec(0),
    );
    expect(va.minus('257.80').abs().lt('0.000001')).toBe(true);
  });
  it('VAN negativo se redondea con piso: -60.464056 da -60.46; trunc daría -60.45', () => {
    const alto = indicadoresVenta({ p: '257.80', pContado: '257.80', flujos: FLUJOS, cok: '5' });
    expect(f2(alto.van)).toBe('-60.46');
  });
});
