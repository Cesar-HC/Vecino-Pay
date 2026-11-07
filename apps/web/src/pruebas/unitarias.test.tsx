import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { consulta, ErrorApi, pedir } from '../api/cliente';
import type { Cronograma, ListadoDetalle } from '../api/tipos';
import { TEMAS, textoDelTema } from '../contenido/formulas';
import { porcentajeATantoPorUno, tantoPorUnoAPorcentaje } from '../lib/entrada';
import {
  etiquetaTasa,
  formatearFecha,
  formatearFechaHora,
  formatearMonto,
  formatearTasa,
  formatearTasaDiaria,
  formatearTasaResumida,
  tasaConEtiqueta,
} from '../lib/formato';
import { enlaceWhatsApp, mensajeListado } from '../lib/whatsapp';
import { FlujoCaja } from '../pantallas/dueno/D05Cronograma';
import { TablaListado } from '../pantallas/dueno/TablaListado';
import { Insignia } from '../ui/base';
import { renderToStaticMarkup } from 'react-dom/server';

const LISTADO: ListadoDetalle = {
  id: '1',
  numero: 'EC-202609-00001',
  clienteId: '1',
  fechaCorte: '2026-09-20',
  horaCorte: '17:00:00',
  fechaPago: '2026-09-26',
  totalCapital: '223.62',
  totalInteres: '4.80',
  totalMora: '0.00',
  total: '228.42',
  estado: 'EMITIDO',
  estadoEfectivo: 'EMITIDO',
  fechaPagoReal: null,
  diasMora: null,
  moneda: 'PEN',
  cliente: 'Luis Quispe',
  tasa: '0.001032653810255',
  items: [
    {
      orden: 1,
      tipo: 'COMPRA',
      ticket: 'T-000231',
      cuotaNumero: null,
      detalle: [
        {
          codigo: 'P001',
          nombre: 'Pollo',
          unidad: 'KG',
          cantidad: '2.350',
          precioLista: '9.00',
          subtotal: '21.15',
        },
      ],
      fechaHoraRegistro: '2026-08-22T09:15:00',
      fecha: '2026-08-22',
      posteriorAlCorte: false,
      dias: 35,
      capital: '44.20',
      interes: '1.63',
      mora: '0.00',
      total: '45.83',
    },
    {
      orden: 2,
      tipo: 'COMPRA',
      ticket: 'T-000245',
      cuotaNumero: null,
      detalle: [],
      fechaHoraRegistro: '2026-08-29T18:40:00',
      fecha: '2026-08-30',
      posteriorAlCorte: true,
      dias: 27,
      capital: '32.80',
      interes: '0.93',
      mora: '0.00',
      total: '33.73',
    },
  ],
  comprasPosteriores: [],
};

describe('formato', () => {
  it('montos con símbolo y miles, sin calcular', () => {
    expect(formatearMonto('228.42')).toBe('S/ 228.42');
    expect(formatearMonto('1234.50')).toBe('S/ 1,234.50');
    expect(formatearMonto('1234567.00')).toBe('S/ 1,234,567.00');
    expect(formatearMonto('93.25', 'USD')).toBe('US$ 93.25');
    expect(formatearMonto('-249.80')).toBe('−S/ 249.80');
  });
  it('un monto raro falla a la vista', () => {
    expect(() => formatearMonto('abc')).toThrow();
    expect(() => formatearMonto('228.4')).toThrow();
  });
  it('tasas: redondea, no corta', () => {
    expect(formatearTasa('0.034999999999986')).toBe('3.5000000 %');
    expect(formatearTasa('0.511068657')).toBe('51.1068657 %');
    expect(formatearTasaDiaria('0.001147371952051')).toBe('0.1147372 % (0.0011473720)');
    expect(formatearTasaDiaria('0.001032653810255')).toBe('0.1032654 % (0.0010326538)');
    expect(formatearTasaResumida('0.450000000')).toBe('45 %');
  });
  it('etiquetas de tasa', () => {
    expect(etiquetaTasa('EFECTIVA', 360)).toBe('TEA');
    expect(etiquetaTasa('EFECTIVA', 30)).toBe('TEM');
    expect(etiquetaTasa('NOMINAL', 360, 30)).toBe('TNA, capitalización mensual');
  });
  it('fechas sin Date: no se corren por la zona horaria', () => {
    expect(formatearFecha('2026-09-26')).toBe('26/09/2026');
    expect(formatearFechaHora('2026-08-29T18:40:00')).toBe('29/08/2026 18:40');
    expect(formatearFechaHora('2026-08-29T18:40:05', true)).toBe('29/08/2026 18:40:05');
  });
});

describe('etiqueta con tasa', () => {
  it('pone la capitalización al final', () => {
    expect(tasaConEtiqueta('NOMINAL', '0.420000000', 360, 30)).toBe(
      'TNA 42 %, capitalización mensual',
    );
    expect(tasaConEtiqueta('EFECTIVA', '0.450000000', 360, null)).toBe('TEA 45 %');
  });
});

describe('lo digitado', () => {
  it('porcentaje a tanto por uno sin errores binarios', () => {
    expect(porcentajeATantoPorUno('42')).toBe('0.42');
    expect(porcentajeATantoPorUno('51.1068657')).toBe('0.511068657');
    expect(porcentajeATantoPorUno('0.07')).toBe('0.0007');
    expect(() => porcentajeATantoPorUno('1.12345678')).toThrow();
    expect(tantoPorUnoAPorcentaje('0.450000000')).toBe('45');
  });
});

describe('WhatsApp', () => {
  it('mensaje exacto con cifras de la API', () => {
    expect(mensajeListado('Minimarket Doña Rosa', LISTADO)).toBe(
      [
        'Minimarket Doña Rosa: listado EC-202609-00001',
        'Luis Quispe',
        'Corte: 20/09/2026 17:00:00',
        'Fecha de pago: 26/09/2026',
        'Capital: S/ 223.62',
        'Interés: S/ 4.80',
        'Total a pagar: S/ 228.42',
        'Si pagas después de la fecha de pago se agrega interés moratorio.',
      ].join('\n'),
    );
  });
  it('con mora a la fecha la muestra', () => {
    const m = mensajeListado('T', {
      ...LISTADO,
      moraALaFecha: { diasMora: 5, mora: '0.30', totalALaFecha: '228.72' },
    });
    expect(m).toContain('Mora de 5 días: S/ 0.30');
    expect(m).toContain('Total a la fecha: S/ 228.72');
  });
  it('pagado con mora: la muestra y no avisa de un atraso futuro', () => {
    const m = mensajeListado('T', {
      ...LISTADO,
      estado: 'PAGADO',
      totalMora: '0.30',
      total: '228.72',
    });
    expect(m).toContain('Mora: S/ 0.30');
    expect(m).toContain('Total pagado: S/ 228.72');
    expect(m).not.toContain('Si pagas');
  });
  it('número con código de Perú; sin celular no hay enlace; acentos codificados', () => {
    const e = enlaceWhatsApp('951284736', 'Interés');
    expect(e).toBe('https://wa.me/51951284736?text=Inter%C3%A9s');
    expect(enlaceWhatsApp(null, 'x')).toBeNull();
    expect(enlaceWhatsApp('', 'x')).toBeNull();
  });
});

describe('cliente de la API', () => {
  const responder = (estado: number, cuerpo?: unknown) =>
    vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status: estado }),
      );

  it('convierte el error de la API con su código y detalles', async () => {
    responder(422, {
      codigo: 'PAGO_NO_EXACTO',
      mensaje: 'Pago rechazado',
      detalles: { totalALaFecha: '228.72' },
    });
    const e = (await pedir('/listados/1/pago', { metodo: 'POST', cuerpo: {} }).catch(
      (x) => x,
    )) as ErrorApi;
    expect(e).toBeInstanceOf(ErrorApi);
    expect([e.estado, e.codigo, e.message, e.detalles.totalALaFecha]).toEqual([
      422,
      'PAGO_NO_EXACTO',
      'Pago rechazado',
      '228.72',
    ]);
  });
  it('204 no intenta leer JSON', async () => {
    responder(204);
    await expect(pedir('/usuarios/1/restablecer-clave')).resolves.toBeUndefined();
  });
  it('sin red da un mensaje en español', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('x'));
    await expect(pedir('/salud')).rejects.toMatchObject({ codigo: 'SIN_RED' });
  });
  it('401 borra el token, salvo en el login', async () => {
    sessionStorage.setItem('vecinopay.token', 'x');
    responder(401, { codigo: 'CREDENCIALES', mensaje: 'no' });
    await pedir('/auth/login', { metodo: 'POST', cuerpo: {} }).catch(() => undefined);
    expect(sessionStorage.getItem('vecinopay.token')).toBe('x');
    responder(401, { codigo: 'SIN_SESION', mensaje: 'no' });
    await pedir('/clientes').catch(() => undefined);
    expect(sessionStorage.getItem('vecinopay.token')).toBeNull();
  });
  it('la consulta omite lo vacío', () => {
    expect(consulta({ a: 1, b: '', c: undefined, d: 'x y' })).toBe('?a=1&d=x+y');
    expect(consulta({})).toBe('');
  });
});

describe('la web no suma cifras', () => {
  it('flujo de caja: las filas suman 269.80 y muestra 269.81 de la API', () => {
    const flujo: Cronograma['flujoCaja'] = {
      cokTea: '0.200000000',
      filas: [
        { momento: 0, t: 0, flujo: '-249.80', valorActual: '-249.80' },
        { momento: 1, t: 41, flujo: '93.25', valorActual: '91.33' },
        { momento: 2, t: 72, flujo: '93.25', valorActual: '89.91' },
        { momento: 3, t: 102, flujo: '93.26', valorActual: '88.56' },
      ],
      sumaValorActual: '269.81',
      van: '20.01',
      cokVigenteCoincide: true,
    };
    render(<FlujoCaja flujo={flujo} moneda="PEN" />);
    expect(screen.getByText('S/ 269.81')).toBeInTheDocument();
    expect(screen.queryByText('S/ 269.80')).not.toBeInTheDocument();
    expect(screen.getByText('S/ 20.01')).toBeInTheDocument();
  });

  it('listado: el total es el de la API aunque las filas sumen otra cosa; asterisco y detalle', () => {
    render(<TablaListado listado={LISTADO} />);
    expect(screen.getByText('S/ 228.42')).toBeInTheDocument();
    expect(screen.getByText('S/ 223.62')).toBeInTheDocument();
    expect(screen.getByText(/Pollo × 2.350/)).toBeInTheDocument();
    expect(screen.getByText('*', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('Mora')).not.toBeInTheDocument();
  });

  it('listado con mora: columna y fila aparte', () => {
    const conMora: ListadoDetalle = {
      ...LISTADO,
      totalMora: '0.30',
      total: '228.72',
      items: [
        ...LISTADO.items,
        {
          orden: 3,
          tipo: 'MORA',
          ticket: null,
          cuotaNumero: null,
          detalle: [],
          fechaHoraRegistro: null,
          fecha: '2026-10-01',
          posteriorAlCorte: false,
          dias: 5,
          capital: '0.00',
          interes: '0.00',
          mora: '0.30',
          total: '0.30',
        },
      ],
    };
    render(<TablaListado listado={conMora} />);
    expect(screen.getByText('Interés moratorio, 5 días')).toBeInTheDocument();
    expect(screen.getByText('S/ 228.72')).toBeInTheDocument();
  });
});

describe('estado BAJA', () => {
  it('la etiqueta se muestra solo si la pantalla la pasa', () => {
    expect(renderToStaticMarkup(<Insignia estado="INACTIVO" etiqueta="BAJA" />)).toContain('BAJA');
    expect(renderToStaticMarkup(<Insignia estado="INACTIVO" />)).toContain('INACTIVO');
  });
});

describe('ayuda y fórmulas', () => {
  it('cada tema con fórmula trae su leyenda y un caso paso a paso (RF13)', () => {
    for (const t of TEMAS.filter((x) => x.id !== 'glosario')) {
      expect(t.leyenda.length).toBeGreaterThan(0);
      expect(t.caso?.pasos.length).toBeGreaterThan(1);
    }
  });

  it('tiene los 8 temas y las cifras del informe', () => {
    expect(TEMAS).toHaveLength(8);
    const texto = TEMAS.map(textoDelTema).join(' ');
    for (const cifra of [
      '51.1068657',
      '3.5000000',
      '0.0011473720',
      '228.72',
      '228.42',
      '93.26',
      '261.07',
      '51.09',
      '20.01',
      '0.0011469966',
      '1.0268129',
      '226.07',
      '2.35',
    ]) {
      expect(texto).toContain(cifra);
    }
  });
});
