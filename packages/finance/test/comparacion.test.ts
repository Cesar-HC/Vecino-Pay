import { Dec, interesCompra, interesSimple, montoCompuesto, montoSimple } from '../src';
import { f2, VARIANTES_TED } from './apoyo';

const FILAS: [string, number, string, string][] = [
  ['44.20', 35, '1.63', '1.93'],
  ['32.80', 27, '0.93', '1.11'],
  ['63.82', 21, '1.40', '1.68'],
  ['30.50', 13, '0.41', '0.50'],
  ['52.30', 8, '0.43', '0.52'],
];

describe.each(VARIANTES_TED)('Tabla 15: compuesto frente a simple, con %s', (_n, t) => {
  it.each(FILAS)('P %s, %i días: compuesto %s, simple %s', (p, d, compuesto, simple) => {
    expect(f2(interesCompra(p, t.tedLuis, d))).toBe(compuesto);
    expect(f2(interesSimple(p, '0.45', d))).toBe(simple);
  });
  it('totales 4.80 y 5.74', () => {
    const total = (f: (p: string, d: number) => Dec) =>
      FILAS.reduce((s, [p, d]) => s.plus(f(p, d)), new Dec(0));
    expect(f2(total((p, d) => interesCompra(p, t.tedLuis, d)))).toBe('4.80');
    expect(f2(total((p, d) => interesSimple(p, '0.45', d)))).toBe('5.74');
  });
});

describe('Ejemplos de 6.3a y 6.3b', () => {
  it('simple: interés 1.93 y monto 46.13', () => {
    expect(f2(interesSimple('44.20', '0.45', 35))).toBe('1.93');
    expect(f2(montoSimple('44.20', '0.45', 35))).toBe('46.13');
  });
  it('compuesto: monto 45.83', () => {
    expect(f2(montoCompuesto('44.20', '0.45', 35))).toBe('45.83');
  });
});
