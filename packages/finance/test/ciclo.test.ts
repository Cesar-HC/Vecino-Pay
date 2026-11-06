import { asignarCiclo, fechaOperativaLocal, sumarDias, sumarMeses } from '../src';

describe('AsignarCiclo (Tabla 13)', () => {
  const ciclo = (fechaOperativa: string, diaCorte = 20, diaPago = 26) =>
    asignarCiclo({ fechaOperativa, diaCorte, diaPago });

  it.each([
    ['T-000231', '2026-08-22', '2026-09-20', '2026-09-26'],
    ['T-000245', '2026-08-30', '2026-09-20', '2026-09-26'],
    ['T-000262', '2026-09-05', '2026-09-20', '2026-09-26'],
    ['T-000278', '2026-09-13', '2026-09-20', '2026-09-26'],
    ['T-000284', '2026-09-15', '2026-09-20', '2026-09-26'],
    ['T-000290', '2026-09-18', '2026-09-20', '2026-09-26'],
    ['T-000301', '2026-09-21', '2026-10-20', '2026-10-26'],
  ])('%s', (_t, operativa, fechaCorte, fechaPago) => {
    expect(ciclo(operativa)).toEqual({ fechaCorte, fechaPago });
  });

  it('una compra el día de corte a las 17:00:00 entra al corte', () => {
    expect(ciclo(fechaOperativaLocal('2026-09-20', '17:00:00')).fechaPago).toBe('2026-09-26');
  });
  it('T-000301: el día de corte a las 17:45 pasa al ciclo siguiente', () => {
    expect(ciclo(fechaOperativaLocal('2026-09-20', '17:45:00')).fechaPago).toBe('2026-10-26');
  });
  it('corte 25 y pago 5: el pago cae al mes siguiente', () => {
    expect(ciclo('2026-09-10', 25, 5)).toEqual({
      fechaCorte: '2026-09-25',
      fechaPago: '2026-10-05',
    });
  });
  it('fin de año con 31/12 a las 18:00', () => {
    expect(ciclo(fechaOperativaLocal('2026-12-31', '18:00:00'))).toEqual({
      fechaCorte: '2027-01-20',
      fechaPago: '2027-01-26',
    });
  });
  it('corte en diciembre con pago en enero', () => {
    expect(ciclo('2026-12-20', 25, 5)).toEqual({
      fechaCorte: '2026-12-25',
      fechaPago: '2027-01-05',
    });
    expect(ciclo('2026-12-26', 25, 5)).toEqual({
      fechaCorte: '2027-01-25',
      fechaPago: '2027-02-05',
    });
  });

  /**
   * Transcripción de la Figura 31. Devuelve la fecha de pago y la de corte normalizada:
   * la figura deja el mes 13 solo internamente.
   */
  function figura31(fecha: string, hora: string, diaCorte: number, diaPago: number) {
    const [aC, mC, dC] = fecha.split('-').map(Number);
    let mCorte = mC;
    if (dC > diaCorte || (dC === diaCorte && hora > '17:00:00')) mCorte += 1;
    let mP = diaPago > diaCorte ? mCorte : mCorte + 1;
    let aP = aC;
    if (mP > 12) {
      mP -= 12;
      aP += 1;
    }
    const dd = (n: number) => String(n).padStart(2, '0');
    return {
      fechaCorte: sumarMeses(`${aC}-${dd(mC)}-${dd(diaCorte)}`, mCorte - mC),
      fechaPago: `${aP}-${dd(mP)}-${dd(diaPago)}`,
    };
  }

  it('equivale a la Figura 31 en cada día de 2027-12 a 2029-01, con 756 pares de corte y pago', () => {
    const horas = ['09:00:00', '17:00:00', '17:00:01', '23:59:59'];
    let revisados = 0;
    for (let f = '2027-12-01'; f <= '2029-01-31'; f = sumarDias(f, 1)) {
      for (const hora of horas) {
        const fechaOperativa = fechaOperativaLocal(f, hora);
        for (let diaCorte = 1; diaCorte <= 28; diaCorte++) {
          for (let diaPago = 1; diaPago <= 28; diaPago++) {
            if (diaCorte === diaPago) continue;
            const obtenido = asignarCiclo({ fechaOperativa, diaCorte, diaPago });
            const esperado = figura31(f, hora, diaCorte, diaPago);
            if (
              obtenido.fechaPago !== esperado.fechaPago ||
              obtenido.fechaCorte !== esperado.fechaCorte
            ) {
              throw new Error(`Difiere ${f} ${hora} corte ${diaCorte} pago ${diaPago}`);
            }
            revisados++;
          }
        }
      }
    }
    expect(revisados).toBe(428 * 4 * 756);
  }, 120_000);
});
