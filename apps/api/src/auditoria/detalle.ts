const SEPARADOR_DATOS = ' | datos=';

/** Texto legible (T33) y, si hace falta, datos en JSON (Tabla 1). */
export function armarDetalle(texto: string, datos?: Record<string, unknown>): string {
  return datos ? `${texto}${SEPARADOR_DATOS}${JSON.stringify(datos)}` : texto;
}

/** El administrador no ve montos de deuda ni tasas (6.2.1, A02). */
export function detalleParaAdmin(detalle: string | null): string | null {
  if (detalle === null) return null;
  const corte = detalle.indexOf(SEPARADOR_DATOS);
  const texto = corte >= 0 ? detalle.slice(0, corte) : detalle;
  return texto.replace(/(S\/|US\$)\s*\d[\d,]*(\.\d+)?/g, '$1 ***').replace(/\b\d[\d,]*\.\d+\b/g, '***');
}
