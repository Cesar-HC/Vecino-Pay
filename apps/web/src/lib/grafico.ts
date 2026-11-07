import type { Monto } from '../api/tipos';

/**
 * Único punto con un número a partir de un monto: Recharts solo admite números para dibujar.
 * Se usa solo como alto de barra o porción de círculo. Las etiquetas muestran siempre el texto de la API.
 */
export const aValorGrafico = (m: Monto): number => Number(m);
