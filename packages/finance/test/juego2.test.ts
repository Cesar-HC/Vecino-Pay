import {
  capitalCapitalizado,
  cuotaFrancesa,
  ErrorFinanciero,
  indicadoresVenta,
  listadoDePago,
  liquidarAFecha,
  planDeCuotas,
  registrarPago,
  simularVentaEnCuotas,
  tirDiaria,
} from '../src';
import { f2, fN, VARIANTES_TED } from './apoyo';

const COMPRA = { p: '257.80', n: 3, fechaOperativa: '2026-09-15', fechaPago: '2026-09-26' };
const COK = '0.20';

describe.each(VARIANTES_TED)('Juego 2, María Huamán, con %s', (_n, t) => {
  const plan = planDeCuotas({ ...COMPRA, ted: t.tedMaria });
  const flujos = plan.filas.map((f) => ({ monto: f.cuota, t: f.t }));

  describe('Tabla 18: variables intermedias', () => {
    it('g = 11 y factor de gracia 1.0126937', () => {
      expect(plan.g).toBe(11);
      expect(fN(t.tedMaria.plus(1).pow(11), 7)).toBe('1.0126937');
    });
    it("P' = 261.07, desde 261.0724", () => {
      expect(fN(t.tedMaria.plus(1).pow(11).times('257.80'), 4)).toBe('261.0724');
      expect(f2(plan.capitalCapitalizado)).toBe('261.07');
    });
    it('suma de factores 2.7995334 y R = 93.25', () => {
      expect(fN(plan.sumaFactores, 7)).toBe('2.7995334');
      expect(f2(plan.cuotaFija)).toBe('93.25');
    });
    it('T_k = 30, 61 y 91; t_k = 41, 72 y 102', () => {
      expect(plan.filas.map((f) => f.T)).toEqual([30, 61, 91]);
      expect(plan.filas.map((f) => f.t)).toEqual([41, 72, 102]);
    });
    it('si todos los meses tuvieran 30 días la cuota sería 93.18 (6.4)', () => {
      expect(f2(cuotaFrancesa('261.07', t.tedMaria, [30, 60, 90]).cuota)).toBe('93.18');
    });
  });

  describe('Tabla 19: cronograma', () => {
    it('las 3 filas al céntimo', () => {
      expect(
        plan.filas.map((f) => [
          f.k,
          f.vence,
          f.diasPeriodo,
          f2(f.saldoInicial),
          f2(f.interes),
          f2(f.amortizacion),
          f2(f.cuota),
          f2(f.saldoFinal),
        ]),
      ).toEqual([
        [1, '2026-10-26', 30, '261.07', '9.14', '84.11', '93.25', '176.96'],
        [2, '2026-11-26', 31, '176.96', '6.40', '86.85', '93.25', '90.11'],
        [3, '2026-12-26', 30, '90.11', '3.15', '90.11', '93.26', '0.00'],
      ]);
    });
    it('totales: interés 18.69, amortización 261.07, cuotas 279.76', () => {
      expect(f2(plan.totalInteresCuotas)).toBe('18.69');
      expect(f2(plan.totalAmortizacion)).toBe('261.07');
      expect(f2(plan.totalCuotas)).toBe('279.76');
      expect(f2(plan.ultimaCuota)).toBe('93.26');
    });
    it('cada fila cumple monto = interés + amortización (Tabla 29)', () => {
      for (const f of plan.filas) expect(f2(f.interes.plus(f.amortizacion))).toBe(f2(f.cuota));
    });
    it('el interés usa días reales, no la TEM (6.3j, Tabla 19)', () => {
      expect(f2(plan.filas[1].interes)).toBe('6.40');
      expect(fN(plan.filas[1].saldoInicial.times('0.035'), 2)).toBe('6.19');
    });
  });

  describe('Listado con cuotas (6.3h, Tabla 31)', () => {
    const f = plan.filas[0];
    const cuotaUno = { capital: f.amortizacion, interes: f.interes, dias: f.diasPeriodo };

    it('solo la cuota 1 de María el 26/10: total 93.25', () => {
      const r = listadoDePago({
        compras: [],
        cuotas: [{ ref: 'T-000284-1', ...cuotaUno }],
        fechaPago: f.vence,
        ted: t.tedMaria,
      });
      expect(r.items).toHaveLength(1);
      expect(r.items[0].tipo).toBe('CUOTA');
      expect(r.items[0].fecha).toBe('2026-10-26');
      expect(r.items[0].dias).toBe(30);
      expect([f2(r.totalCapital), f2(r.totalInteres), f2(r.total)]).toEqual([
        '84.11',
        '9.14',
        '93.25',
      ]);
    });
    it('mezcla compras y cuotas: primero las compras por fecha y luego las cuotas por ref', () => {
      const r = listadoDePago({
        compras: [
          { ref: 'C2', fechaOperativa: '2026-10-10', capital: '10.00' },
          { ref: 'C1', fechaOperativa: '2026-10-01', capital: '20.00' },
        ],
        cuotas: [
          { ref: 'Q2', ...cuotaUno },
          { ref: 'Q1', ...cuotaUno },
        ],
        fechaPago: '2026-10-26',
        ted: t.tedMaria,
      });
      expect(r.items.map((i) => i.ref)).toEqual(['C1', 'C2', 'Q1', 'Q2']);
      expect(r.items.map((i) => i.orden)).toEqual([1, 2, 3, 4]);
      const interesCompras = r.items[0].interes.plus(r.items[1].interes);
      expect(f2(r.totalCapital)).toBe('198.22');
      expect(f2(r.totalInteres)).toBe(f2(interesCompras.plus('18.28')));
      expect(f2(r.total)).toBe(f2(r.totalCapital.plus(r.totalInteres)));
    });
  });

  describe('Tabla 20: salidas', () => {
    it('intereses totales 21.96: 3.27 de gracia y 18.69 de cuotas', () => {
      expect(f2(plan.interesGracia)).toBe('3.27');
      expect(f2(plan.interesesTotales)).toBe('21.96');
    });
    it('TIR diaria 0.0011469966 y TCEA 51.09 %', () => {
      const r = indicadoresVenta({ p: '257.80', pContado: '249.80', flujos, cok: COK });
      expect(fN(r.tirDiaria, 10)).toBe('0.0011469966');
      expect(fN(r.tcea.times(100), 2)).toBe('51.09');
    });
    it('VAN 20.01 con COK 20 %', () => {
      expect(f2(indicadoresVenta({ p: '257.80', pContado: '249.80', flujos, cok: COK }).van)).toBe(
        '20.01',
      );
    });
    it('la TCEA usa el precio de lista y el VAN el contado', () => {
      const conContadoIgual = indicadoresVenta({
        p: '257.80',
        pContado: '257.80',
        flujos,
        cok: COK,
      });
      expect(fN(conContadoIgual.tcea.times(100), 2)).toBe('51.09');
      expect(f2(conContadoIgual.van)).toBe('12.01');
    });
    it('mora de la cuota 2 el 30/11: 4 días, 0.12, total 93.37', () => {
      const r = liquidarAFecha({
        total: '93.25',
        tedMora: t.tedmMaria,
        fechaPago: '2026-11-26',
        fechaOperativaPago: '2026-11-30',
      });
      expect(r.diasMora).toBe(4);
      expect(f2(r.mora)).toBe('0.12');
      expect(f2(r.totalALaFecha)).toBe('93.37');
    });
    it('imputación de la cuota 2 con mora: 0.12, 6.40 y 86.85', () => {
      const fila = plan.filas[1];
      const r = registrarPago({
        total: fila.cuota,
        interes: fila.interes,
        capital: fila.amortizacion,
        tedMora: t.tedmMaria,
        fechaPago: fila.vence,
        fechaOperativaPago: '2026-11-30',
        montoPagado: '93.37',
      });
      if (!r.aceptado) throw new Error('debía aceptarse');
      expect([f2(r.imputacion.mora), f2(r.imputacion.interes), f2(r.imputacion.capital)]).toEqual([
        '0.12',
        '6.40',
        '86.85',
      ]);
    });
  });

  describe('Simulador de D04 (Figura 23)', () => {
    it('reproduce ciclo, cuota, TCEA y VAN', () => {
      const s = simularVentaEnCuotas({
        p: '257.80',
        pContado: '249.80',
        ted: t.tedMaria,
        n: 3,
        maxMeses: 3,
        cok: COK,
        fechaOperativa: '2026-09-15',
        diaCorte: 20,
        diaPago: 26,
      });
      expect(s.ciclo.fechaPago).toBe('2026-09-26');
      expect(f2(s.plan.cuotaFija)).toBe('93.25');
      expect(fN(s.indicadores.tcea.times(100), 2)).toBe('51.09');
      expect(f2(s.indicadores.van)).toBe('20.01');
    });
    it('rechaza más cuotas que el máximo pactado', () => {
      expect(() =>
        simularVentaEnCuotas({
          p: '257.80',
          pContado: '249.80',
          ted: t.tedMaria,
          n: 4,
          maxMeses: 3,
          cok: COK,
          fechaOperativa: '2026-09-15',
          diaCorte: 20,
          diaPago: 26,
        }),
      ).toThrow('entre 1 y 3');
    });
  });

  describe('Casos límite del cronograma', () => {
    it('n = 1: la única cuota es saldo más interés', () => {
      const r = planDeCuotas({ ...COMPRA, n: 1, ted: t.tedMaria });
      expect(r.filas).toHaveLength(1);
      expect(f2(r.filas[0].saldoFinal)).toBe('0.00');
      expect(f2(r.filas[0].amortizacion)).toBe('261.07');
      expect(f2(r.filas[0].cuota)).toBe('270.21');
    });
    it('n = 2 termina en saldo 0', () => {
      const r = planDeCuotas({ ...COMPRA, n: 2, ted: t.tedMaria });
      expect(f2(r.filas[1].saldoFinal)).toBe('0.00');
    });
    it('n = 12 cruza el año, usa días reales y termina en saldo 0', () => {
      const r = planDeCuotas({ ...COMPRA, n: 12, ted: t.tedMaria });
      expect(r.filas[3].vence).toBe('2027-01-26');
      expect(r.filas[11].vence).toBe('2027-09-26');
      expect(r.filas[11].T).toBe(365);
      expect(f2(r.filas[11].saldoFinal)).toBe('0.00');
      expect(f2(r.totalAmortizacion)).toBe('261.07');
    });
    it("compra el mismo día de pago: g = 0 y P' = P", () => {
      const r = planDeCuotas({ ...COMPRA, fechaOperativa: '2026-09-26', ted: t.tedMaria });
      expect(r.g).toBe(0);
      expect(f2(r.capitalCapitalizado)).toBe('257.80');
    });
    it('fecha de compra posterior a la de pago lanza error', () => {
      expect(() =>
        planDeCuotas({ ...COMPRA, fechaOperativa: '2026-09-27', ted: t.tedMaria }),
      ).toThrow('no puede ser posterior');
    });
    it('capitalCapitalizado usa los días de gracia', () => {
      expect(f2(capitalCapitalizado('257.80', t.tedMaria, 0))).toBe('257.80');
    });
  });
});

describe('TirDiaria (Figura 39): casos sin raíz', () => {
  it('cuotas que suman menos que el monto', () => {
    expect(() => tirDiaria('100.00', [{ monto: '50.00', t: 30 }])).toThrow(ErrorFinanciero);
  });
  it('tasa diaria mayor que 1 %', () => {
    expect(() => tirDiaria('100.00', [{ monto: '500.00', t: 30 }])).toThrow('entre 0 % y 1 %');
  });
});
