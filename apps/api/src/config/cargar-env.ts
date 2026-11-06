import { existsSync, readFileSync } from 'node:fs';

/**
 * Lee .env como lo hace docker compose: "#" solo inicia un comentario tras un espacio, porque las claves lo usan.
 * process.loadEnvFile cortaría VecinoPay#2026 en VecinoPay. No pisa lo que ya esté en el entorno.
 */
export function leerEnv(texto: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(linea);
    if (!m) continue;
    const crudo = m[2].trim();
    const comillas = /^(["'])(.*?)\1/.exec(crudo);
    salida[m[1]] = comillas ? comillas[2] : crudo.replace(/\s+#.*$/, '');
  }
  return salida;
}

export function cargarEnv(ruta: string, env: NodeJS.ProcessEnv = process.env) {
  if (!existsSync(ruta)) return;
  for (const [clave, valor] of Object.entries(leerEnv(readFileSync(ruta, 'utf8')))) {
    if (env[clave] === undefined) env[clave] = valor;
  }
}
