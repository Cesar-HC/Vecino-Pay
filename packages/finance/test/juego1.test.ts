import {
  asignarCiclo,
  creditoDisponible,
  Dec,
  evaluarLimite,
  fechaOperativaLocal,
  interesCompra,
  listadoDePago,
  liquidarAFecha,
  registrarPago,
  tasaDeDias,
  tea,
  valorHoy,
} from '../src';
import { f2, fN, VARIANTES_TED } from './apoyo';
import { ErrorFinanciero as ErrorFinancieroMora } from '../src/errores';
import { itemMora } from '../src/listado';

const COMPRAS = [
  { ref: 'T-000231', fecha: '2026-08-22', hora: '09:15:00', capital: '44.20' },
  { ref: 'T-000245', fecha: '2026-08-29', hora: '18:40:00', capital: '32.80' },
  { ref: 'T-000262', fecha: '2026-09-05', hora: '11:05:00', capital: '63.82' },
  { ref: 'T-000278', fecha: '2026-09-12', hora: '19:30:00', capital: '30.50' },
  { ref: 'T-000290', fecha: '2026-09-18', hora: '08:50:00', capital: '52.30' },
];
const FECHA_PAGO = '2026-09-26';
const entrada = COMPRAS.map((c) => ({
  ref: c.ref,
  capital: c.capital,
  fechaOperativa: fechaOperativaLocal(c.fecha, c.hora),
}));

describe.each(VARIANTES_TED)('Juego 1, Luis Quispe, con %s', (_n, t) => {
  describe('Tabla 16: compras del ciclo', () => {
    const listado = listadoDePago({ compras: entrada, fechaPago: FECHA_PAGO, ted: t.tedLuis });

    it('días 35, 27, 21, 13 y 8', () => {
      expect(listado.items.map((i) => i.dias)).toEqual([35, 27, 21, 13, 8]);
    });
    it('factores de interés', () => {
      expect(listado.items.map((i) => fN(tasaDeDias(t.tedLuis, i.dias), 7))).toEqual([
        '0.0367846',
        '0.0282592',
        '0.0219111',
        '0.0135080',
        '0.0082912',
      ]);
    });
    it('intereses 1.63, 0.93, 1.40, 0.41 y 0.43', () => {
      expect(listado.items.map((i) => f2(i.interes))).toEqual([
        '1.63',
        '0.93',
        '1.40',
        '0.41',
        '0.43',
      ]);
    });
    it('totales 45.83, 33.73, 65.22, 30.91 y 52.73', () => {
      expect(listado.items.map((i) => f2(i.total))).toEqual([
        '45.83',
        '33.73',
        '65.22',
        '30.91',
        '52.73',
      ]);
    });
    it('listado: capital 223.62, interés 4.80, total 228.42', () => {
      expect(f2(listado.totalCapital)).toBe('223.62');
      expect(f2(listado.totalInteres)).toBe('4.80');
      expect(f2(listado.total)).toBe('228.42');
    });
    it('verificación de T-000231: 1.6259 sin redondear y 1.63 redondeado', () => {
      expect(fN(tasaDeDias(t.tedLuis, 35).times('44.20'), 4)).toBe('1.6259');
      expect(f2(interesCompra('44.20', t.tedLuis, 35))).toBe('1.63');
    });
    it('el interés se redondea compra por compra antes de sumar', () => {
      const sinRedondear = listado.items.reduce(
        (s, i) => s.plus(i.capital.times(tasaDeDias(t.tedLuis, i.dias))),
        new Dec(0),
      );
      expect(fN(sinRedondear, 4)).toBe('4.7968');
      expect(listado.totalInteres.toString()).toBe('4.8');
    });
    it('una entrada desordenada sale ordenada por fecha operativa', () => {
      const desordenada = listadoDePago({
        compras: [...entrada].reverse(),
        fechaPago: FECHA_PAGO,
        ted: t.tedLuis,
      });
      expect(desordenada.items.map((i) => i.ref)).toEqual(COMPRAS.map((c) => c.ref));
      expect(desordenada.items.map((i) => i.orden)).toEqual([1, 2, 3, 4, 5]);
      expect(f2(desordenada.total)).toBe('228.42');
    });
    it('compras de la misma fecha operativa conservan su orden', () => {
      const r = listadoDePago({
        compras: [
          { ref: 'B', fechaOperativa: '2026-09-05', capital: '1.00' },
          { ref: 'A', fechaOperativa: '2026-09-05', capital: '1.00' },
        ],
        fechaPago: FECHA_PAGO,
        ted: t.tedLuis,
      });
      expect(r.items.map((i) => i.ref)).toEqual(['B', 'A']);
    });
  });

  describe('Tabla 17: escenarios', () => {
    const base = {
      total: '228.42',
      interes: '4.80',
      capital: '223.62',
      tedMora: t.tedmLuis,
      fechaPago: FECHA_PAGO,
    };

    it('compra del 20/09 a las 17:45: operativa 21/09 y pago 26/10', () => {
      const fechaOperativa = fechaOperativaLocal('2026-09-20', '17:45:00');
      expect(fechaOperativa).toBe('2026-09-21');
      expect(asignarCiclo({ fechaOperativa, diaCorte: 20, diaPago: 26 }).fechaPago).toBe(
        '2026-10-26',
      );
    });
    it('compra de 999.00 rechazada, con 276.38 disponibles', () => {
      const r = evaluarLimite({ monto: '999.00', limite: '500.00', su: '223.62' });
      expect(r.aceptada).toBe(false);
      expect(f2(r.disponible)).toBe('276.38');
      expect(r.mensaje).toBe('Compra rechazada: supera el crédito disponible de S/ 276.38.');
    });
    it('una compra igual al disponible se acepta y un céntimo más se rechaza', () => {
      expect(evaluarLimite({ monto: '276.38', limite: '500.00', su: '223.62' }).aceptada).toBe(
        true,
      );
      expect(evaluarLimite({ monto: '276.39', limite: '500.00', su: '223.62' }).aceptada).toBe(
        false,
      );
    });
    it('pago puntual el 26/09 a las 17:00:00: sin mora, total 228.42', () => {
      const r = liquidarAFecha({
        ...base,
        fechaOperativaPago: fechaOperativaLocal(FECHA_PAGO, '17:00:00'),
      });
      expect(r.diasMora).toBe(0);
      expect(f2(r.mora)).toBe('0.00');
      expect(f2(r.totalALaFecha)).toBe('228.42');
    });
    it('pago anticipado: sin mora', () => {
      const r = liquidarAFecha({ ...base, fechaOperativaPago: '2026-09-20' });
      expect(r.diasMora).toBe(0);
      expect(f2(r.totalALaFecha)).toBe('228.42');
    });
    it('pago el 26/09 a las 17:30: 1 día, mora 0.06, total 228.48', () => {
      const r = liquidarAFecha({
        ...base,
        fechaOperativaPago: fechaOperativaLocal(FECHA_PAGO, '17:30:00'),
      });
      expect(r.diasMora).toBe(1);
      expect(f2(r.mora)).toBe('0.06');
      expect(f2(r.totalALaFecha)).toBe('228.48');
    });
    it('pago el 01/10: 5 días, mora 0.30, total 228.72, imputación 0.30, 4.80 y 223.62', () => {
      const r = registrarPago({ ...base, fechaOperativaPago: '2026-10-01', montoPagado: '228.72' });
      expect(r.aceptado).toBe(true);
      expect(r.diasMora).toBe(5);
      expect(f2(r.mora)).toBe('0.30');
      expect(f2(r.totalALaFecha)).toBe('228.72');
      if (!r.aceptado) throw new Error('debía aceptarse');
      expect(f2(r.imputacion.mora)).toBe('0.30');
      expect(f2(r.imputacion.interes)).toBe('4.80');
      expect(f2(r.imputacion.capital)).toBe('223.62');
      expect(f2(r.imputacion.mora.plus(r.imputacion.interes).plus(r.imputacion.capital))).toBe(
        '228.72',
      );
    });
    it('pago parcial de 200.00 rechazado, con el importe correcto en el mensaje', () => {
      const r = registrarPago({ ...base, fechaOperativaPago: '2026-10-01', montoPagado: '200.00' });
      expect(r.aceptado).toBe(false);
      if (r.aceptado) throw new Error('debía rechazarse');
      expect(r.mensaje).toBe(
        'Pago rechazado: debe pagar el total de S/ 228.72. No se aceptan pagos parciales ni mayores.',
      );
    });
    it('pago mayor de 228.73 también rechazado', () => {
      const r = registrarPago({ ...base, fechaOperativaPago: '2026-10-01', montoPagado: '228.73' });
      expect(r.aceptado).toBe(false);
      if (r.aceptado) throw new Error('debía rechazarse');
      expect(r.mensaje).toContain('228.72');
    });
    it('crédito disponible después del pago: 478.70', () => {
      expect(f2(creditoDisponible('500.00', '21.30'))).toBe('478.70');
    });
    it('valor de hoy el 16/09: 10 días, d 1.0268129 %, descuento 2.35, neto 226.07', () => {
      const r = valorHoy({ vn: '228.42', tea: tea(t.tedLuis), td: 10 });
      expect(fN(r.te.times(100), 7)).toBe('1.0374657');
      expect(fN(r.d.times(100), 7)).toBe('1.0268129');
      expect(f2(r.descuento)).toBe('2.35');
      expect(f2(r.neto)).toBe('226.07');
    });
  });
});

describe('Moneda en los mensajes de rechazo', () => {
  it('usa US$ con clientes en dólares', () => {
    const r = evaluarLimite({ monto: '10.00', limite: '5.00', su: '0', moneda: 'USD' });
    expect(r.mensaje).toContain('US$ 5.00');
  });
});

describe('ítem de mora (6.3i, T31)', () => {
  it('pago del 26/09 a las 17:30: orden 6, fecha 27/09, 1 día, 0.06', () => {
    const i = itemMora({ ultimoOrden: 5, fechaOperativaPago: '2026-09-27', diasMora: 1, mora: '0.06' });
    expect([i.orden, i.tipo, i.fecha, i.dias]).toEqual([6, 'MORA', '2026-09-27', 1]);
    expect([i.capital.toFixed(2), i.interes.toFixed(2), i.mora.toFixed(2), i.total.toFixed(2)]).toEqual(['0.00', '0.00', '0.06', '0.06']);
  });

  it('sin días de mora no hay ítem', () => {
    expect(() => itemMora({ ultimoOrden: 5, fechaOperativaPago: '2026-09-26', diasMora: 0, mora: '0.00' })).toThrow(ErrorFinancieroMora);
  });
});
