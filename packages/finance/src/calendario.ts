/**
 * Calendario de VecinoPay (SerialExacto, 6.3e, Figura 25).
 * - Zona fija America/Lima.
 * - Hora de corte fija 17:00:00: un registro hecho después de esa hora cuenta como del día siguiente.
 * - Fechas como texto ISO 'AAAA-MM-DD' para no arrastrar horas ni zonas en los cálculos de días.
 */
import { ErrorFinanciero } from './errores';

export const ZONA_HORARIA = 'America/Lima';
export const HORA_CORTE = '17:00:00';

export interface PartesLima {
  /** Fecha calendario en Lima, 'AAAA-MM-DD'. */
  fecha: string;
  /** Hora en Lima, 'HH:MM:SS' (24 h). */
  hora: string;
}

const formatoLima = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Fecha y hora de Lima para un instante cualquiera. */
export function partesLima(instante: Date): PartesLima {
  if (Number.isNaN(instante.getTime())) {
    throw new ErrorFinanciero('FECHA', 'El instante recibido no es una fecha válida.');
  }
  const p: Record<string, string> = {};
  for (const parte of formatoLima.formatToParts(instante)) p[parte.type] = parte.value;
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}:${p.second}` };
}

const MS_POR_DIA = 86_400_000;

/** Número de serie de una fecha ISO válida. Rechaza fechas inexistentes, como el 31/02. */
function serial(fechaIso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso);
  if (m) {
    const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (new Date(ms).toISOString().slice(0, 10) === fechaIso) return ms / MS_POR_DIA;
  }
  throw new ErrorFinanciero(
    'FECHA',
    `La fecha ${fechaIso} no es válida: use el formato AAAA-MM-DD con un día que exista.`,
  );
}

/** Valida una fecha ISO y la devuelve. */
export function validarFecha(fechaIso: string): string {
  serial(fechaIso);
  return fechaIso;
}

function exigirEntero(n: number, nombre: string): void {
  if (!Number.isInteger(n)) {
    throw new ErrorFinanciero('ENTERO', `${nombre} debe ser un número entero.`);
  }
}

/** Suma n días calendario a una fecha ISO. */
export function sumarDias(fechaIso: string, n: number): string {
  exigirEntero(n, 'El número de días');
  return new Date((serial(fechaIso) + n) * MS_POR_DIA).toISOString().slice(0, 10);
}

/** D(t1, t2) de 6.3e: días exactos del calendario de 'desde' a 'hasta'. */
export function diasEntre(desde: string, hasta: string): number {
  return serial(hasta) - serial(desde);
}

/** Misma fecha k meses después (6.3j). Exige día <= 28, que existe en todos los meses. */
export function sumarMeses(fechaIso: string, k: number): string {
  validarFecha(fechaIso);
  exigirEntero(k, 'El número de meses');
  const [a, m, d] = fechaIso.split('-').map(Number);
  if (d > 28) {
    throw new ErrorFinanciero(
      'FECHA',
      'Para sumar meses el día debe estar entre 1 y 28, para que exista en todos los meses.',
    );
  }
  return new Date(Date.UTC(a, m - 1 + k, d)).toISOString().slice(0, 10);
}

/**
 * Fecha operativa a partir de la fecha y la hora locales de Lima ('HH:MM:SS'):
 * hasta las 17:00:00 inclusive es el mismo día; desde 17:00:01 es el día siguiente.
 */
export function fechaOperativaLocal(fecha: string, hora: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(hora)) {
    throw new ErrorFinanciero('FECHA', `La hora ${hora} no es válida: use el formato HH:MM:SS.`);
  }
  return sumarDias(fecha, hora > HORA_CORTE ? 1 : 0);
}

/** Fecha operativa de un instante real, convertido antes a la hora de Lima. */
export function fechaOperativa(instante: Date): string {
  const { fecha, hora } = partesLima(instante);
  return fechaOperativaLocal(fecha, hora);
}
