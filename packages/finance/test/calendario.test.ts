import {
  diasEntre,
  fechaOperativa,
  fechaOperativaLocal,
  partesLima,
  sumarDias,
  sumarMeses,
} from '../src/calendario';

// Lima es UTC-5 todo el año, así que '-05:00' fija la hora local sin ambigüedad.
const lima = (fechaHora: string) => new Date(`${fechaHora}-05:00`);

describe('Hora de corte 17:00 America/Lima (juego 1)', () => {
  it('T-000231: 22/08/2026 09:15 es del 22/08', () => {
    expect(fechaOperativa(lima('2026-08-22T09:15:00'))).toBe('2026-08-22');
  });
  it('T-000245: 29/08/2026 18:40 pasa al 30/08', () => {
    expect(fechaOperativa(lima('2026-08-29T18:40:00'))).toBe('2026-08-30');
  });
  it('T-000278: 12/09/2026 19:30 pasa al 13/09', () => {
    expect(fechaOperativa(lima('2026-09-12T19:30:00'))).toBe('2026-09-13');
  });
  it('17:00:00 exacto sigue siendo el mismo día', () => {
    expect(fechaOperativa(lima('2026-09-26T17:00:00'))).toBe('2026-09-26');
  });
  it('17:00:01 ya es el día siguiente', () => {
    expect(fechaOperativa(lima('2026-09-26T17:00:01'))).toBe('2026-09-27');
  });
  it('granularidad de segundo: 17:00:00.900 sigue siendo el mismo día (Figura 25)', () => {
    expect(fechaOperativa(lima('2026-09-26T17:00:00.900'))).toBe('2026-09-26');
  });
  it('fin de mes y fin de año', () => {
    expect(fechaOperativa(lima('2026-09-30T17:30:00'))).toBe('2026-10-01');
    expect(fechaOperativa(lima('2026-12-31T23:59:59'))).toBe('2027-01-01');
  });
  it('fechaOperativaLocal aplica la misma regla sin convertir zonas', () => {
    expect(fechaOperativaLocal('2026-09-26', '17:00:00')).toBe('2026-09-26');
    expect(fechaOperativaLocal('2026-09-26', '17:00:01')).toBe('2026-09-27');
    expect(() => fechaOperativaLocal('2026-09-26', '25:00:00')).toThrow('no es válida');
  });
});

describe('Días exactos (6.3e, Tablas 17 y 18)', () => {
  it.each([
    ['2026-09-15', '2026-09-26', 11],
    ['2026-08-22', '2026-09-26', 35],
    ['2026-08-30', '2026-09-26', 27],
    ['2026-09-26', '2026-10-01', 5],
    ['2026-09-26', '2026-10-26', 30],
    ['2026-10-26', '2026-11-26', 31],
    ['2026-11-26', '2026-12-26', 30],
    ['2028-02-28', '2028-03-01', 2],
    ['2026-02-28', '2026-03-01', 1],
  ])('%s a %s: %i días', (a, b, d) => {
    expect(diasEntre(a, b)).toBe(d);
  });

  it('rechaza fechas que no existen', () => {
    expect(() => diasEntre('2026-02-30', '2026-03-01')).toThrow('no es válida');
    expect(() => diasEntre('26/09/2026', '2026-10-01')).toThrow('no es válida');
  });

  /** Transcripción de SerialExacto (Figura 25), sin la rama de la hora. */
  function serialFigura25(d: number, m: number, a: number): number {
    let s =
      365 * (a - 1) +
      Math.trunc((a - 1) / 4) -
      Math.trunc((a - 1) / 100) +
      Math.trunc((a - 1) / 400) +
      d;
    for (let k = 1; k <= m - 1; k++) {
      if (k === 2) s += a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0) ? 29 : 28;
      else s += [4, 6, 9, 11].includes(k) ? 30 : 31;
    }
    return s;
  }

  it('coincide con SerialExacto de la Figura 25 para todos los días de 2024 a 2032', () => {
    const origen = '2024-01-01';
    const baseFigura = serialFigura25(1, 1, 2024);
    let fecha = origen;
    while (fecha < '2033-01-01') {
      const [a, m, d] = fecha.split('-').map(Number);
      expect(diasEntre(origen, fecha)).toBe(serialFigura25(d, m, a) - baseFigura);
      fecha = sumarDias(fecha, 1);
    }
  });
});

describe('Utilidades de calendario', () => {
  it('convierte un instante UTC a la hora de Lima', () => {
    expect(partesLima(new Date('2026-09-20T22:45:00Z'))).toEqual({
      fecha: '2026-09-20',
      hora: '17:45:00',
    });
  });
  it('suma días respetando febrero bisiesto', () => {
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('suma meses el mismo día, con cambio de año', () => {
    expect(sumarMeses('2026-09-26', 3)).toBe('2026-12-26');
    expect(sumarMeses('2026-12-26', 1)).toBe('2027-01-26');
    expect(sumarMeses('2026-09-26', 12)).toBe('2027-09-26');
  });
  it('sumar meses exige día de 1 a 28', () => {
    expect(() => sumarMeses('2026-08-31', 1)).toThrow('entre 1 y 28');
  });
});
