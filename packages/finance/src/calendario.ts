/**
 * Calendario de VecinoPay.
 * - Zona fija America/Lima.
 * - Hora de corte fija 17:00:00: un registro hecho después de esa hora cuenta como del día siguiente.
 * - Fechas como texto ISO 'AAAA-MM-DD' para no arrastrar horas ni zonas en los cálculos de días.
 */

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
  const p: Record<string, string> = {};
  for (const parte of formatoLima.formatToParts(instante)) p[parte.type] = parte.value;
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}:${p.second}` };
}

/** Suma n días calendario a una fecha ISO. */
export function sumarDias(fechaIso: string, n: number): string {
  const [a, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Fecha operativa de un registro: hasta las 17:00:00 inclusive es el mismo día;
 * desde 17:00:01 es el día siguiente.
 */
export function fechaOperativa(instante: Date): string {
  const { fecha, hora } = partesLima(instante);
  return hora > HORA_CORTE ? sumarDias(fecha, 1) : fecha;
}
