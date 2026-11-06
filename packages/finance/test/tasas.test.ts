import { cuantizarTasa, tasaDeDias, tasaEfectivaDiaria, tea, tem } from '../src';
import { fN } from './apoyo';

describe('Conversión a TED (6.3f, juegos 1 y 2)', () => {
  const nominal = { tipo: 'NOMINAL', valor: '0.42', plazo: 360, capitalizacion: 30 } as const;

  it('TEA 45 %: TED 0.0010326538', () => {
    expect(fN(tasaEfectivaDiaria({ tipo: 'EFECTIVA', valor: '0.45', plazo: 360 }), 10)).toBe(
      '0.0010326538',
    );
  });
  it('TEA 10 % moratoria: TED 0.0002647855', () => {
    expect(fN(tasaEfectivaDiaria({ tipo: 'EFECTIVA', valor: '0.10', plazo: 360 }), 10)).toBe(
      '0.0002647855',
    );
  });
  it('TNA 42 % capitalización mensual: TED 0.0011473720', () => {
    expect(fN(tasaEfectivaDiaria(nominal), 10)).toBe('0.0011473720');
  });
  it('COK 20 % TEA: TED 0.0005065770', () => {
    expect(fN(tasaEfectivaDiaria({ tipo: 'EFECTIVA', valor: '0.20', plazo: 360 }), 10)).toBe(
      '0.0005065770',
    );
  });
  it('TNA 42 %: TEM 3.5000000 % y TEA 51.1068657 %', () => {
    const ted = tasaEfectivaDiaria(nominal);
    expect(fN(tem(ted).times(100), 7)).toBe('3.5000000');
    expect(fN(tea(ted).times(100), 7)).toBe('51.1068657');
  });
  it('TNA 42 % con capitalización diaria: TEA 52.1589010 % y tasa del período 0.0011667', () => {
    const ted = tasaEfectivaDiaria({
      tipo: 'NOMINAL',
      valor: '0.42',
      plazo: 360,
      capitalizacion: 1,
    });
    expect(fN(tea(ted).times(100), 7)).toBe('52.1589010');
    expect(fN(ted, 7)).toBe('0.0011667');
  });
  it('nominal sin capitalización asume diaria (6.3c)', () => {
    const sinC = tasaEfectivaDiaria({ tipo: 'NOMINAL', valor: '0.42', plazo: 360 });
    const conC = tasaEfectivaDiaria({
      tipo: 'NOMINAL',
      valor: '0.42',
      plazo: 360,
      capitalizacion: 1,
    });
    expect(sinC.eq(conC)).toBe(true);
  });
  it('tasa de cada período con días reales (Tabla 18): 3.5000000 %, 3.6187530 % y 3.5000000 %', () => {
    const ted = tasaEfectivaDiaria(nominal);
    expect([30, 31, 30].map((d) => fN(tasaDeDias(ted, d).times(100), 7))).toEqual([
      '3.5000000',
      '3.6187530',
      '3.5000000',
    ]);
  });
  it('cuantizar deja 15 decimales exactos, como DECIMAL(18,15)', () => {
    const ted = cuantizarTasa(tasaEfectivaDiaria(nominal));
    expect(ted.decimalPlaces()).toBeLessThanOrEqual(15);
    expect(fN(ted, 10)).toBe('0.0011473720');
  });
  it('la TED de 15 decimales mantiene la TEM a 7 decimales', () => {
    expect(fN(tem(cuantizarTasa(tasaEfectivaDiaria(nominal))).times(100), 7)).toBe('3.5000000');
  });
});
