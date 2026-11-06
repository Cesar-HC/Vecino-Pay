import { fechaOperativa, partesLima, sumarDias } from '../src/calendario';

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
  it('fin de mes y fin de año', () => {
    expect(fechaOperativa(lima('2026-09-30T17:30:00'))).toBe('2026-10-01');
    expect(fechaOperativa(lima('2026-12-31T23:59:59'))).toBe('2027-01-01');
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
});
