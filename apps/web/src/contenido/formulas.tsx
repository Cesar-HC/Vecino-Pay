// Ayuda de D08 (RF13): explicación, fórmula, leyenda de términos y un caso resuelto paso a paso.
// Son datos de texto para que el buscador los recorra. Las cifras se copian del informe (6.3, 6.4 y sus tablas):
// aquí no se calcula nada.
export interface Tema {
  id: string;
  titulo: string;
  explicacion: string;
  formulas: string[];
  leyenda: [string, string][];
  /** Título del caso resuelto y sus pasos. */
  caso?: { titulo: string; pasos: string[] };
}

export const TEMAS: Tema[] = [
  {
    id: 'tasas',
    titulo: 'Conversión de tasas',
    explicacion:
      'La tasa que pactas con el cliente se convierte a una tasa efectiva diaria (TED), porque el sistema cuenta días exactos.',
    formulas: [
      'Efectiva: TED = (1 + TE)^(1/p) − 1',
      'Nominal: TED = (1 + TN/m)^(1/c) − 1, con m = p/c',
      'TEM = (1 + TED)^30 − 1',
      'TEA = (1 + TED)^360 − 1',
    ],
    leyenda: [
      ['TE', 'tasa efectiva pactada'],
      ['TN', 'tasa nominal pactada'],
      ['p', 'plazo de la tasa, en días'],
      ['c', 'días de capitalización'],
      ['m', 'veces que capitaliza dentro del plazo'],
      ['TED, TEM, TEA', 'tasa efectiva diaria, mensual y anual'],
    ],
    caso: {
      titulo: 'TNA 42 % con capitalización mensual',
      pasos: [
        'p = 360 y c = 30, así que m = 360 / 30 = 12.',
        'Tasa del período: 0.42 / 12 = 0.035.',
        'TED = (1.035)^(1/30) − 1 = 0.0011473720.',
        'TEM = (1 + TED)^30 − 1 = 3.5000000 %.',
        'TEA = (1 + TED)^360 − 1 = 51.1068657 %.',
      ],
    },
  },
  {
    id: 'ciclo',
    titulo: 'Ciclo de corte y pago',
    explicacion:
      'El corte cierra el ciclo a las 17:00 y genera el listado. Lo registrado después de esa hora cuenta como del día siguiente: esa es su fecha operativa. La fecha de pago es el primer día de pago después del corte. Son reglas de calendario, con meses reales y años bisiestos.',
    formulas: [],
    leyenda: [
      ['Fecha operativa', 'la del día, o la del día siguiente si fue después de las 17:00:00'],
      ['Día de corte', 'el día del mes en que se cierra el ciclo; en el ejemplo, el 20'],
      ['Día de pago', 'el día del mes en que vence el listado; en el ejemplo, el 26'],
    ],
    caso: {
      titulo: 'Compra del 20/09 a las 17:45',
      pasos: [
        'Es después de las 17:00, así que cuenta como del 21/09.',
        'El día 21 es posterior al corte del 20: entra al corte del 20/10.',
        'El día de pago 26 es posterior al corte: se paga el 26/10.',
      ],
    },
  },
  {
    id: 'interes',
    titulo: 'Interés a fin de mes',
    explicacion:
      'Cada compra paga interés por sus días exactos, desde su fecha operativa hasta la fecha de pago. Se redondea compra por compra.',
    formulas: ['I = Red(P × [(1 + TED)^d − 1])'],
    leyenda: [
      ['I', 'interés de la compra'],
      ['P', 'capital de la compra, a precio de lista'],
      ['TED', 'tasa efectiva diaria del cliente'],
      ['d', 'días exactos desde la fecha operativa hasta la fecha de pago'],
      ['Red', 'redondeo al céntimo'],
    ],
    caso: {
      titulo: 'Compra T-000231 de Luis',
      pasos: [
        'P = 44.20; TED = 0.0010326538.',
        'Del 22/08 al 26/09 hay d = 35 días.',
        'Factor: (1 + TED)^35 − 1 = 0.0367846.',
        'I = Red(44.20 × 0.0367846) = 1.63; total de la compra, 45.83.',
        'El listado de Luis suma 223.62 de capital, 4.80 de interés y 228.42 en total.',
      ],
    },
  },
  {
    id: 'mora',
    titulo: 'Mora y prelación',
    explicacion:
      'Si el pago llega después de la fecha de pago, se cobra interés moratorio sobre el total. Solo se acepta el total exacto a la fecha, y se imputa en orden: mora, interés y capital.',
    formulas: ['Mora = Red(T × [(1 + TEDm)^dm − 1])', 'Total a la fecha = T + Mora'],
    leyenda: [
      ['T', 'total del listado que debió pagarse'],
      ['TEDm', 'tasa moratoria efectiva diaria'],
      ['dm', 'días de atraso desde la fecha de pago'],
    ],
    caso: {
      titulo: 'Luis paga el 01/10 un listado que vencía el 26/09',
      pasos: [
        'T = 228.42; TEDm = 0.0002647855; dm = 5 días.',
        'Factor: (1 + TEDm)^5 − 1 = 0.0013246.',
        'Mora = Red(228.42 × 0.0013246) = 0.30.',
        'Total a la fecha: 228.42 + 0.30 = 228.72. Un pago de 200.00 se rechaza.',
        'Imputación: 0.30 a mora, 4.80 a interés y 223.62 a capital.',
      ],
    },
  },
  {
    id: 'cuotas',
    titulo: 'Cuotas con gracia',
    explicacion:
      'En cuotas, el cliente no paga nada hasta la fecha de pago del ciclo. El interés de esos días se suma a la deuda, y luego se aplica el método francés con días exactos. La última cuota es el saldo más su interés.',
    formulas: [
      "P' = Red(P × (1 + TED)^g)",
      "R = Red(P' / Σ (1 + TED)^(−Tk))",
      'Interés k = Red(saldo × [(1 + TED)^días − 1])',
      'Amortización k = R − Interés k; saldo final = saldo − Amortización k',
    ],
    leyenda: [
      ['P', 'monto de la compra, a precio de lista'],
      ["P'", 'capital con el interés de la gracia'],
      ['g', 'días de gracia, desde la compra hasta la fecha de pago'],
      ['R', 'cuota fija'],
      ['Tk', 'días desde la fecha de pago hasta la cuota k'],
      ['días', 'días reales del período de cada cuota'],
    ],
    caso: {
      titulo: 'María compra S/ 257.80 el 15/09 en 3 cuotas',
      pasos: [
        'Del 15/09 al 26/09 hay g = 11 días.',
        "P' = Red(257.80 × (1 + 0.0011473720)^11) = 261.07; la gracia cuesta 3.27.",
        'Tk = 30, 61 y 91 días; la suma de factores es 2.7995334.',
        'R = Red(261.07 / 2.7995334) = 93.25.',
        'Cuota 1: interés 9.14, amortización 84.11, saldo 176.96.',
        'Cuota 3: saldo 90.11 más interés 3.15 = 93.26, y el saldo queda en 0.00.',
      ],
    },
  },
  {
    id: 'tcea-van',
    titulo: 'TCEA y VAN',
    explicacion:
      'La TCEA es el costo anual real para el cliente, a partir de la TIR de sus cuotas. El VAN es lo que gana la tienda frente a cobrar al contado, descontando con su COK.',
    formulas: [
      'P = Σ Cuota k / (1 + TIR)^tk',
      'TCEA = (1 + TIR)^360 − 1',
      'TEDcok = (1 + COK)^(1/360) − 1',
      'VAN = Σ Cuota k / (1 + TEDcok)^tk − contado',
    ],
    leyenda: [
      ['P', 'monto de la compra, a precio de lista'],
      ['Cuota k', 'importe de la cuota k'],
      ['tk', 'días desde la compra hasta la cuota k'],
      ['TIR', 'tasa interna de retorno diaria'],
      ['COK', 'costo de oportunidad del capital de la tienda, anual'],
      ['TEDcok', 'el COK expresado por día'],
      ['contado', 'lo que la tienda recibiría si cobrara al contado'],
    ],
    caso: {
      titulo: 'La venta a María',
      pasos: [
        'Cuotas 93.25, 93.25 y 93.26 en tk = 41, 72 y 102 días.',
        'La TIR que iguala las cuotas con 257.80 es 0.0011469966.',
        'TCEA = (1 + TIR)^360 − 1 = 51.09 %.',
        'Con COK de 20 %, TEDcok = 0.0005065770.',
        'Valores actuales: 91.33, 89.91 y 88.56; su suma sin redondear da 269.81.',
        'VAN = 269.81 − 249.80 = 20.01.',
      ],
    },
  },
  {
    id: 'descontada',
    titulo: 'Tasa descontada',
    explicacion:
      'Si necesitas liquidez antes de la fecha de pago, la tasa descontada te dice cuánto vale hoy el total que cobrarás después. Es una valoración para la tienda: el cliente sigue debiendo el total, porque solo se acepta el pago completo.',
    formulas: [
      'TE = (1 + TEA)^(td/360) − 1',
      'd = TE / (1 + TE)',
      'Descuento = Red(VN × d)',
      'Valor neto = VN − Descuento',
    ],
    leyenda: [
      ['VN', 'valor nominal: el total del listado'],
      ['TEA', 'tasa efectiva anual del cliente'],
      ['td', 'días que faltan hasta la fecha de pago'],
      ['TE', 'tasa efectiva de esos días'],
      ['d', 'tasa descontada'],
    ],
    caso: {
      titulo: 'El listado de Luis, valorado el 16/09, 10 días antes de la fecha de pago',
      pasos: [
        'VN = 228.42; TEA = 45 %; td = 10.',
        'TE = (1.45)^(10/360) − 1 = 1.0374657 %.',
        'd = TE / (1 + TE) = 1.0268129 %.',
        'Descuento = Red(228.42 × d) = 2.35.',
        'Valor neto = 228.42 − 2.35 = 226.07. Luis sigue debiendo 228.42.',
      ],
    },
  },
  {
    id: 'glosario',
    titulo: 'Glosario',
    explicacion: 'Los términos que verás en las pantallas.',
    formulas: [],
    leyenda: [
      ['TED', 'tasa efectiva diaria: lo que crece la deuda en un día'],
      [
        'COK',
        'costo de oportunidad del capital: lo que la tienda ganaría con su dinero en otro uso',
      ],
      [
        'Capital pendiente',
        'lo que el cliente aún debe de capital, sin intereses; es lo que consume su límite',
      ],
      [
        'Fecha operativa',
        'la fecha con la que cuenta una operación: la del día, o la del día siguiente si fue después de las 17:00',
      ],
      [
        'Gracia',
        'días entre la compra y la fecha de pago del ciclo, en los que no se paga nada pero corre el interés',
      ],
      ['Prelación', 'el orden en que se aplica un pago: mora, interés y capital'],
    ],
  },
];

/** Sin acentos ni mayúsculas. */
export const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Todo el contenido del tema: el buscador lo recorre completo. */
export const textoDelTema = (t: Tema) =>
  [
    t.titulo,
    t.explicacion,
    ...t.formulas,
    ...t.leyenda.flat(),
    t.caso?.titulo ?? '',
    ...(t.caso?.pasos ?? []),
  ].join(' ');
