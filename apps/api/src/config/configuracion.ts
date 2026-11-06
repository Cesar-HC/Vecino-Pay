export interface Configuracion {
  entorno: 'development' | 'test' | 'production';
  puerto: number;
  jwtSecreto: string;
  relojFijo: string | null;
  corsOrigenes: string[];
  avisos: string[];
}

const SECRETOS_CONOCIDOS = ['cambia-este-secreto', 'secret', 'changeme', 'jwt-secret'];
const CLAVE_POR_DEFECTO = 'VecinoApp#2026';
const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export class ConfiguracionInvalida extends Error {
  constructor(public readonly problemas: string[]) {
    super(`Configuración inválida:\n- ${problemas.join('\n- ')}`);
  }
}

/** Valida todo el entorno de una vez. Si falta NODE_ENV o es otro valor, se trata como producción. */
export function cargarConfiguracion(env: Record<string, string | undefined>): Configuracion {
  const entorno =
    env.NODE_ENV === 'development' || env.NODE_ENV === 'test' ? env.NODE_ENV : ('production' as const);
  const produccion = entorno === 'production';
  const problemas: string[] = [];

  const jwt = env.JWT_SECRET ?? '';
  if (!jwt) problemas.push('Falta JWT_SECRET.');
  else if (produccion && (jwt.length < 32 || SECRETOS_CONOCIDOS.includes(jwt))) {
    problemas.push('JWT_SECRET en producción debe tener 32 o más caracteres y no ser un valor conocido.');
  }

  const relojFijo = env.RELOJ_FIJO ? env.RELOJ_FIJO : null;
  if (relojFijo) {
    if (produccion) problemas.push('RELOJ_FIJO no se permite en producción.');
    else if (!ISO_CON_ZONA.test(relojFijo)) {
      problemas.push('RELOJ_FIJO debe ser ISO 8601 con desplazamiento, por ejemplo 2026-09-22T12:00:00-05:00.');
    }
  }

  const url = env.DATABASE_URL ?? '';
  if (!url) problemas.push('Falta DATABASE_URL.');
  else {
    if (/(^|;)\s*(user|username|uid|user id)\s*=\s*sa\s*(;|$)/i.test(url)) problemas.push('DATABASE_URL no puede usar el usuario sa.');
    if (produccion && url.includes(CLAVE_POR_DEFECTO)) {
      problemas.push('DATABASE_URL en producción no puede usar la contraseña por defecto.');
    }
  }

  const cors = env.CORS_ORIGENES?.split(',').map((o) => o.trim()).filter(Boolean) ?? [];

  if (problemas.length) throw new ConfiguracionInvalida(problemas);
  const avisos = SECRETOS_CONOCIDOS.includes(jwt) ? ['JWT_SECRET es un valor conocido: úsalo solo en desarrollo.'] : [];
  return {
    entorno,
    puerto: Number(env.PORT ?? 3000),
    jwtSecreto: jwt,
    relojFijo,
    corsOrigenes: cors.length ? cors : ['http://localhost:5173', 'http://localhost:8080'],
    avisos,
  };
}
