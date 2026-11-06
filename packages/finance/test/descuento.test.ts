import {
  efectivaDesdeDescontada,
  valorHoy,
  valorPresenteEfectiva,
  valorPresenteSimple,
} from '../src';
import { f2, fN } from './apoyo';

describe('Tabla 14 y 6.3l: valor de hoy de S/ 228.42 con 10 días', () => {
  const r = valorHoy({ vn: '228.42', tea: '0.45', td: 10 });

  it('TE 1.0374657 % y d 1.0268129 %', () => {
    expect(fN(r.te.times(100), 7)).toBe('1.0374657');
    expect(fN(r.d.times(100), 7)).toBe('1.0268129');
  });
  it('tasa descontada: 2.35 y 226.07', () => {
    expect([f2(r.descuento), f2(r.neto)]).toEqual(['2.35', '226.07']);
  });
  it('valor presente con tasa efectiva: 2.35 y 226.07', () => {
    const v = valorPresenteEfectiva({ vn: '228.42', tea: '0.45', td: 10 });
    expect([f2(v.descuento), f2(v.neto)]).toEqual(['2.35', '226.07']);
  });
  it('valor presente con interés simple: 2.82 y 225.60', () => {
    const v = valorPresenteSimple({ vn: '228.42', tasa: '0.45', td: 10 });
    expect([f2(v.descuento), f2(v.neto)]).toEqual(['2.82', '225.60']);
  });
  it('el valor presente simple redondea el neto cuando la división no es exacta', () => {
    const v = valorPresenteSimple({ vn: '100.00', tasa: '0.45', td: 10 });
    expect([f2(v.descuento), f2(v.neto)]).toEqual(['1.23', '98.77']);
  });
  it('la relación inversa recupera la tasa efectiva', () => {
    expect(fN(efectivaDesdeDescontada(r.d), 12)).toBe(fN(r.te, 12));
  });
});
