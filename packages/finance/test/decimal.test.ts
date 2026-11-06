import { aDec, red, soles } from '../src';

describe('Red (6.3e, Figura 27)', () => {
  it('ejemplo del informe: 1.5786 da 1.58', () => {
    expect(red('1.5786').toFixed(2)).toBe('1.58');
  });
  it('medio céntimo sube', () => {
    expect(red('2.345').toFixed(2)).toBe('2.35');
    expect(red('2.3449999').toFixed(2)).toBe('2.34');
  });
  it('con negativos usa piso, no trunc', () => {
    expect(red('-1.006').toFixed(2)).toBe('-1.01');
    expect(red('-1.234').toFixed(2)).toBe('-1.23');
  });
  it('no arrastra errores de float: 1.005 da 1.01', () => {
    expect(red('1.005').toFixed(2)).toBe('1.01');
  });
});

describe('Entradas', () => {
  it('rechaza number para evitar errores de float', () => {
    expect(() => aDec(1.5 as unknown as string)).toThrow('no como number');
  });
  it('soles muestra 2 decimales', () => {
    expect(soles('228.4')).toBe('228.40');
  });
});
