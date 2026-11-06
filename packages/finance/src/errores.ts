export type CodigoError =
  | 'ENTRADA_NO_DECIMAL'
  | 'ENTRADA_INVALIDA'
  | 'ENTERO'
  | 'FECHA'
  | 'TASA_TIPO'
  | 'TASA_VALOR'
  | 'TASA_PLAZO'
  | 'TASA_CAP_LISTA'
  | 'TASA_CAP_MAYOR'
  | 'TASA_CAP_EFECTIVA'
  | 'CICLO_DIA'
  | 'CICLO_DIAS_IGUALES'
  | 'MAX_MESES'
  | 'CUOTAS_RANGO'
  | 'PRECIO_CONTADO'
  | 'PRECIO_LISTA'
  | 'MODALIDAD'
  | 'FECHA_ORDEN'
  | 'MONTO'
  | 'TIR_SIN_RAIZ';

/** Entrada inválida: el mensaje explica en español la regla que no se cumple. */
export class ErrorFinanciero extends Error {
  constructor(
    public readonly codigo: CodigoError,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorFinanciero';
  }
}
