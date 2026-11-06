import { aDec, Entrada } from './decimal';
import { ErrorFinanciero } from './errores';

/** Lista cerrada de plazos y capitalizaciones en días (Tabla 6). */
export const PLAZOS_VALIDOS: readonly number[] = [1, 15, 30, 60, 90, 120, 180, 360];
const TEXTO_PLAZOS = '1, 15, 30, 60, 90, 120, 180 o 360';

export interface TasaPactada {
  tipo: 'EFECTIVA' | 'NOMINAL';
  valor: Entrada;
  plazo: number;
  /** Solo nominal. Si no se indica, capitalización diaria (6.3c). La BD la devuelve como null. */
  capitalizacion?: number | null;
}

/** Una tasa diaria guardada o calculada siempre es mayor que cero (Tabla 26). */
export function validarTasaDiaria(ted: Entrada): void {
  if (!aDec(ted).gt(0)) {
    throw new ErrorFinanciero('TASA_VALOR', 'La tasa debe ser mayor que cero.');
  }
}

export function validarDias(n: number, nombre: string): void {
  validarEntero(n, nombre);
  if (n < 0) {
    throw new ErrorFinanciero('ENTERO', `${nombre} no puede ser negativo.`);
  }
}

export function validarEntero(n: number, nombre: string): void {
  if (!Number.isInteger(n)) {
    throw new ErrorFinanciero('ENTERO', `${nombre} debe ser un número entero.`);
  }
}

export function validarTasa(t: TasaPactada): void {
  if (t.tipo !== 'EFECTIVA' && t.tipo !== 'NOMINAL') {
    throw new ErrorFinanciero('TASA_TIPO', 'El tipo de tasa debe ser efectiva o nominal.');
  }
  if (!aDec(t.valor).gt(0)) {
    throw new ErrorFinanciero('TASA_VALOR', 'La tasa debe ser mayor que cero.');
  }
  if (!PLAZOS_VALIDOS.includes(t.plazo)) {
    throw new ErrorFinanciero(
      'TASA_PLAZO',
      `El plazo de la tasa debe ser uno de estos días: ${TEXTO_PLAZOS}.`,
    );
  }
  if (t.capitalizacion === undefined || t.capitalizacion === null) return;
  if (t.tipo === 'EFECTIVA') {
    throw new ErrorFinanciero(
      'TASA_CAP_EFECTIVA',
      'La capitalización solo se indica cuando la tasa es nominal.',
    );
  }
  if (!PLAZOS_VALIDOS.includes(t.capitalizacion)) {
    throw new ErrorFinanciero(
      'TASA_CAP_LISTA',
      `La capitalización debe ser uno de estos días: ${TEXTO_PLAZOS}.`,
    );
  }
  if (t.capitalizacion > t.plazo) {
    throw new ErrorFinanciero(
      'TASA_CAP_MAYOR',
      'La capitalización no puede ser mayor que el plazo, porque la tasa debe capitalizar al menos una vez en su período.',
    );
  }
}

export function validarDiasCiclo(diaCorte: number, diaPago: number): void {
  for (const d of [diaCorte, diaPago]) {
    if (!Number.isInteger(d) || d < 1 || d > 28) {
      throw new ErrorFinanciero(
        'CICLO_DIA',
        'El día de corte y el día de pago deben estar entre 1 y 28 para que existan en todos los meses.',
      );
    }
  }
  if (diaCorte === diaPago) {
    throw new ErrorFinanciero(
      'CICLO_DIAS_IGUALES',
      'El día de pago debe ser distinto del día de corte para que el cliente tenga tiempo de pagar.',
    );
  }
}

export function validarMaxMeses(maxMeses: number): void {
  if (!Number.isInteger(maxMeses) || maxMeses < 1 || maxMeses > 12) {
    throw new ErrorFinanciero('MAX_MESES', 'El máximo de meses debe estar entre 1 y 12.');
  }
}

export function validarNumeroCuotas(n: number, maxMeses: number): void {
  validarMaxMeses(maxMeses);
  if (!Number.isInteger(n) || n < 1 || n > maxMeses) {
    throw new ErrorFinanciero(
      'CUOTAS_RANGO',
      `El número de cuotas debe estar entre 1 y ${maxMeses}, el máximo pactado con el cliente.`,
    );
  }
}

export function validarPrecios(contado: Entrada, lista: Entrada): void {
  if (!aDec(contado).gt(0)) {
    throw new ErrorFinanciero('PRECIO_CONTADO', 'El precio contado debe ser mayor que cero.');
  }
  if (aDec(lista).lt(aDec(contado))) {
    throw new ErrorFinanciero(
      'PRECIO_LISTA',
      'El precio de lista debe ser mayor o igual que el precio contado.',
    );
  }
}

export type Modalidad = 'FIN_MES' | 'CUOTAS';

/** 6.1.1: la modalidad solo puede elegirse si todos los productos la admiten. */
export function validarModalidad(
  modalidad: Modalidad,
  productos: { permiteFinMes: boolean; permiteCuotas: boolean }[],
): void {
  const admite = (p: { permiteFinMes: boolean; permiteCuotas: boolean }) =>
    modalidad === 'FIN_MES' ? p.permiteFinMes : p.permiteCuotas;
  if (!productos.every(admite)) {
    throw new ErrorFinanciero(
      'MODALIDAD',
      'La modalidad elegida debe estar permitida en todos los productos de la compra.',
    );
  }
}

export function validarMontoPositivo(x: Entrada, nombre: string): void {
  if (!aDec(x).gt(0)) {
    throw new ErrorFinanciero('MONTO', `${nombre} debe ser mayor que cero.`);
  }
}
