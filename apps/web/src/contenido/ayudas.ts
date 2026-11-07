// Textos literales de la Tabla 12 del informe: son los de los globos de D03 y D04.
export const T12 = {
  tipoTasa:
    'Efectiva: ya incluye la capitalización (TEA 45 %). Nominal: indica cada cuánto capitaliza (TNA 42 % con capitalización mensual).',
  valorTasa:
    'Porcentaje pactado con el cliente. No debe superar la tasa máxima vigente que publica el BCRP.',
  capitalizacion: 'Solo para tasas nominales. Si no la conoces, deja la opción diaria.',
  tasaMoratoria:
    'Se cobra por cada día de atraso sobre el total que debió pagarse y aparece como ítem aparte.',
  limiteCredito: 'Deuda máxima del cliente. Una compra que lo supere se rechaza.',
  fechaCortePago:
    'El corte cierra el ciclo a las 17:00 y genera el listado. Lo registrado después de esa hora cuenta como del día siguiente. La fecha de pago es el primer día de pago después del corte.',
  modalidad:
    'Fin de mes: un solo pago con interés por los días desde la compra. En cuotas: método francés con gracia total.',
  numeroCuotas: 'De 1 al máximo de meses pactado con el cliente.',
  interesEstimado:
    'Capital por [(1 + TED) elevado a los días, menos 1], con los días exactos hasta la fecha de pago.',
  tceaVan:
    'TCEA: costo anual real para el cliente. VAN: lo que gana la tienda frente a cobrar al contado, con su COK.',
};
