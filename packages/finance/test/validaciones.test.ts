import {
  aDec,
  capitalCapitalizado,
  CodigoError,
  cuotaFrancesa,
  Dec,
  ErrorFinanciero,
  evaluarLimite,
  fechaOperativa,
  listadoDePago,
  liquidarAFecha,
  planDeCuotas,
  registrarPago,
  simularVentaEnCuotas,
  sumarDias,
  sumarMeses,
  tasaDeDias,
  tasaEfectivaDiaria,
  TasaPactada,
  tirDiaria,
  validarDiasCiclo,
  validarMaxMeses,
  validarModalidad,
  validarNumeroCuotas,
  validarPrecios,
  valorHoy,
} from '../src';

const plan = (p: string, n: number) =>
  planDeCuotas({
    p,
    ted: '0.0011473720',
    n,
    fechaOperativa: '2026-09-15',
    fechaPago: '2026-09-26',
  });

function codigoDe(fn: () => unknown): CodigoError {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErrorFinanciero) return e.codigo;
    throw e;
  }
  throw new Error('No lanzó ErrorFinanciero');
}

const tasa = (t: Partial<TasaPactada>): TasaPactada => ({
  tipo: 'NOMINAL',
  valor: '0.42',
  plazo: 360,
  ...t,
});

describe('Validaciones (Tablas 6 y 7): cada código explica la regla', () => {
  it.each<[CodigoError, () => unknown, string]>([
    [
      'TASA_TIPO',
      () => tasaEfectivaDiaria(tasa({ tipo: 'OTRA' as 'NOMINAL' })),
      'efectiva o nominal',
    ],
    ['TASA_VALOR', () => tasaEfectivaDiaria(tasa({ valor: '0' })), 'mayor que cero'],
    [
      'TASA_PLAZO',
      () => tasaEfectivaDiaria(tasa({ plazo: 45 })),
      '1, 15, 30, 60, 90, 120, 180 o 360',
    ],
    [
      'TASA_CAP_LISTA',
      () => tasaEfectivaDiaria(tasa({ capitalizacion: 7 })),
      '1, 15, 30, 60, 90, 120, 180 o 360',
    ],
    [
      'TASA_CAP_MAYOR',
      () => tasaEfectivaDiaria(tasa({ plazo: 30, capitalizacion: 60 })),
      'no puede ser mayor que el plazo',
    ],
    [
      'TASA_CAP_EFECTIVA',
      () => tasaEfectivaDiaria(tasa({ tipo: 'EFECTIVA', capitalizacion: 30 })),
      'solo se indica cuando la tasa es nominal',
    ],
    ['CICLO_DIA', () => validarDiasCiclo(29, 5), 'entre 1 y 28'],
    ['CICLO_DIA', () => validarDiasCiclo(20, 0), 'entre 1 y 28'],
    ['CICLO_DIAS_IGUALES', () => validarDiasCiclo(20, 20), 'distinto del día de corte'],
    ['MAX_MESES', () => validarMaxMeses(13), 'entre 1 y 12'],
    ['CUOTAS_RANGO', () => validarNumeroCuotas(4, 3), 'entre 1 y 3'],
    ['CUOTAS_RANGO', () => validarNumeroCuotas(0, 3), 'entre 1 y 3'],
    ['PRECIO_CONTADO', () => validarPrecios('0', '10'), 'mayor que cero'],
    ['PRECIO_LISTA', () => validarPrecios('10', '9.99'), 'mayor o igual que el precio contado'],
    [
      'MODALIDAD',
      () => validarModalidad('CUOTAS', [{ permiteFinMes: true, permiteCuotas: false }]),
      'todos los productos',
    ],
    [
      'MODALIDAD',
      () => validarModalidad('FIN_MES', [{ permiteFinMes: false, permiteCuotas: true }]),
      'todos los productos',
    ],
    [
      'FECHA_ORDEN',
      () =>
        listadoDePago({
          compras: [{ ref: 'X', fechaOperativa: '2026-09-27', capital: '1' }],
          fechaPago: '2026-09-26',
          ted: '0.001',
        }),
      'no puede ser posterior',
    ],
    ['TIR_SIN_RAIZ', () => tirDiaria('100', [{ monto: '50', t: 30 }]), 'entre 0 % y 1 %'],
    [
      'MONTO',
      () =>
        planDeCuotas({
          p: '0',
          ted: '0.001',
          n: 1,
          fechaOperativa: '2026-09-15',
          fechaPago: '2026-09-26',
        }),
      'mayor que cero',
    ],
    [
      'ENTERO',
      () =>
        planDeCuotas({
          p: '1',
          ted: '0.001',
          n: 1.5,
          fechaOperativa: '2026-09-15',
          fechaPago: '2026-09-26',
        }),
      'número entero',
    ],
    [
      'ENTRADA_NO_DECIMAL',
      () => tasaEfectivaDiaria(tasa({ valor: 0.42 as unknown as string })),
      'no como number',
    ],
    ['MONTO', () => evaluarLimite({ monto: '0', limite: '500', su: '0' }), 'mayor que cero'],
    ['MONTO', () => evaluarLimite({ monto: '-5', limite: '500', su: '0' }), 'mayor que cero'],
    [
      'MONTO',
      () =>
        registrarPago({
          total: '100.00',
          interes: '1.00',
          capital: '1.00',
          tedMora: '0.001',
          fechaPago: '2026-09-26',
          fechaOperativaPago: '2026-09-26',
          montoPagado: '100.00',
        }),
      'interés más el capital',
    ],
    ['MONTO', () => plan('0.02', 4), 'demasiado pequeño'],
    ['MONTO', () => plan('0.01', 3), 'demasiado pequeño'],
    ['TASA_VALOR', () => tasaDeDias('-2', 3), 'mayor que cero'],
    ['TASA_VALOR', () => capitalCapitalizado('10', '0', 3), 'mayor que cero'],
    ['TASA_VALOR', () => cuotaFrancesa('10', '-1', [30]), 'mayor que cero'],
    [
      'TASA_VALOR',
      () =>
        liquidarAFecha({
          total: '10',
          tedMora: '-0.5',
          fechaPago: '2026-09-26',
          fechaOperativaPago: '2026-09-27',
        }),
      'mayor que cero',
    ],
    ['ENTERO', () => tasaDeDias('0.001', -1), 'no puede ser negativo'],
    ['ENTERO', () => capitalCapitalizado('10', '0.001', -1), 'no puede ser negativo'],
    ['ENTERO', () => valorHoy({ vn: '10', tea: '0.45', td: -1 }), 'no puede ser negativo'],
    ['ENTERO', () => sumarDias('2026-09-26', 0.5), 'número entero'],
    ['ENTERO', () => sumarMeses('2026-09-26', 1.5), 'número entero'],
    ['CUOTAS_RANGO', () => cuotaFrancesa('10', '0.001', []), 'como mínimo 1'],
    ['FECHA', () => fechaOperativa(new Date('x')), 'no es una fecha válida'],
    ['FECHA', () => listadoDePago({ compras: [], fechaPago: 'xx', ted: '0.001' }), 'no es válida'],
    [
      'PRECIO_LISTA',
      () =>
        simularVentaEnCuotas({
          p: '10.00',
          pContado: '11.00',
          ted: '0.001',
          n: 1,
          maxMeses: 3,
          cok: '0.20',
          fechaOperativa: '2026-09-15',
          diaCorte: 20,
          diaPago: 26,
        }),
      'mayor o igual que el precio contado',
    ],
    [
      'MODALIDAD',
      () =>
        validarModalidad('CUOTAS', [
          { permiteFinMes: true, permiteCuotas: true },
          { permiteFinMes: true, permiteCuotas: false },
        ]),
      'todos los productos',
    ],
  ])('%s', (codigo, fn, texto) => {
    expect(codigoDe(fn)).toBe(codigo);
    expect(fn).toThrow(texto);
  });

  it.each(['NaN', 'Infinity', '-Infinity', '0x10', '1e3', '', 'abc', '1,5', ' 1'])(
    'rechaza el texto %j como monto',
    (valor) => {
      expect(codigoDe(() => aDec(valor))).toBe('ENTRADA_INVALIDA');
      expect(() => evaluarLimite({ monto: valor, limite: '500', su: '0' })).toThrow('no es válido');
    },
  );

  it('rechaza un Decimal no finito', () => {
    expect(codigoDe(() => aDec(new Dec(NaN)))).toBe('ENTRADA_INVALIDA');
    expect(codigoDe(() => aDec(new Dec(Infinity)))).toBe('ENTRADA_INVALIDA');
  });

  it('el rechazo de pago usa el símbolo de la moneda', () => {
    const r = registrarPago({
      total: '10.00',
      interes: '1.00',
      capital: '9.00',
      tedMora: '0.001',
      fechaPago: '2026-09-26',
      fechaOperativaPago: '2026-09-26',
      montoPagado: '1.00',
      moneda: 'USD',
    });
    expect(r.aceptado).toBe(false);
    if (r.aceptado) throw new Error('debía rechazarse');
    expect(r.mensaje).toContain('US$ 10.00');
  });

  it('capitalización null de la BD equivale a no indicarla', () => {
    const sinC = tasaEfectivaDiaria(tasa({ capitalizacion: undefined }));
    expect(tasaEfectivaDiaria(tasa({ capitalizacion: null })).eq(sinC)).toBe(true);
    expect(() =>
      tasaEfectivaDiaria({ tipo: 'EFECTIVA', valor: '0.45', plazo: 360, capitalizacion: null }),
    ).not.toThrow();
  });

  it('acepta lo que la regla permite', () => {
    expect(() => validarDiasCiclo(20, 26)).not.toThrow();
    expect(() => validarNumeroCuotas(3, 3)).not.toThrow();
    expect(() => validarPrecios('249.80', '249.80')).not.toThrow();
    expect(() => tasaEfectivaDiaria(tasa({ plazo: 30, capitalizacion: 30 }))).not.toThrow();
    expect(() =>
      validarModalidad('CUOTAS', [{ permiteFinMes: true, permiteCuotas: true }]),
    ).not.toThrow();
  });
});
