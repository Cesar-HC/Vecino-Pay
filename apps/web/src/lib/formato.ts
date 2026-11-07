import Decimal from 'decimal.js';
import type { Moneda, Monto, Tasa } from '../api/tipos';

const MONTO = /^-?\d+\.\d{2}$/;

/** "228.42" → "S/ 228.42". Solo manipula el texto: una cifra rara falla a la vista en vez de mostrarse mal. */
export function formatearMonto(m: Monto, moneda: Moneda = 'PEN'): string {
  if (!MONTO.test(m)) throw new Error(`Monto inválido: ${m}`);
  const negativo = m.startsWith('-');
  const [enteros, decimales] = (negativo ? m.slice(1) : m).split('.');
  const conComas = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negativo ? '−' : ''}${moneda === 'USD' ? 'US$' : 'S/'} ${conComas}.${decimales}`;
}

/** Porcentaje que la API ya calculó: "51.09" → "51.09 %". */
export const formatearPorcentajeApi = (p: string): string => `${p} %`;

/** "0.034999999999986" → "3.5000000 %". Redondea, no corta: cortar daría 3.4999999 %. */
export function formatearTasa(t: Tasa, decimales = 7): string {
  return `${new Decimal(t).times(100).toFixed(decimales, Decimal.ROUND_HALF_UP)} %`;
}

/** "0.450000000" → "45 %". */
export function formatearTasaResumida(t: Tasa): string {
  return `${new Decimal(t).times(100).toString()} %`;
}

/** "0.001147371952051" → "0.1147372 % (0.0011473720)". T9 y 6.3f la escriben de las dos formas. */
export function formatearTasaDiaria(t: Tasa): string {
  return `${formatearTasa(t)} (${new Decimal(t).toFixed(10, Decimal.ROUND_HALF_UP)})`;
}

const SIGLA: Record<number, string> = {
  1: 'D',
  15: 'Q',
  30: 'M',
  60: 'B',
  90: 'T',
  120: 'C',
  180: 'S',
  360: 'A',
};
const PERIODO: Record<number, string> = {
  1: 'diaria',
  15: 'quincenal',
  30: 'mensual',
  60: 'bimestral',
  90: 'trimestral',
  120: 'cuatrimestral',
  180: 'semestral',
  360: 'anual',
};

/** TEA, TEM, TNA y similares, con la capitalización si es nominal. */
export function etiquetaTasa(tipo: string, plazo: number, capitalizacion?: number | null): string {
  const sigla = `T${tipo === 'NOMINAL' ? 'N' : 'E'}${SIGLA[plazo] ?? ''}`;
  if (tipo !== 'NOMINAL' || !capitalizacion) return sigla;
  return `${sigla}, capitalización ${PERIODO[capitalizacion] ?? capitalizacion}`;
}

/** "TEA 45 %" o "TNA 42 %, capitalización mensual". */
export function tasaConEtiqueta(
  tipo: string,
  valor: Tasa,
  plazo: number,
  capitalizacion?: number | null,
): string {
  const [sigla, resto] = etiquetaTasa(tipo, plazo, capitalizacion).split(', ');
  return `${sigla} ${formatearTasaResumida(valor)}${resto ? `, ${resto}` : ''}`;
}

/** "2026-09-26" → "26/09/2026". Sin Date: no se corre un día por zona horaria. */
export function formatearFecha(f: string): string {
  const [a, m, d] = f.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** "2026-08-29T18:40:00" → "29/08/2026 18:40". */
export function formatearFechaHora(fh: string, conSegundos = false): string {
  const [fecha, hora] = fh.split('T');
  return `${formatearFecha(fecha)} ${conSegundos ? hora : hora.slice(0, 5)}`;
}
