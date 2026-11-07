const CLAVE = 'vecinopay.token';

export const almacen = {
  leer(): string | null {
    try {
      return sessionStorage.getItem(CLAVE);
    } catch {
      return null;
    }
  },
  guardar(token: string) {
    try {
      sessionStorage.setItem(CLAVE, token);
    } catch {
      // Sin almacenamiento la sesión dura lo que dure la página.
    }
  },
  borrar() {
    try {
      sessionStorage.removeItem(CLAVE);
    } catch {
      // Nada que borrar.
    }
  },
};

export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalles: Record<string, unknown> = {},
  ) {
    super(mensaje);
  }
}

let alExpirar: () => void = () => undefined;
export const avisarSesionExpirada = (f: () => void) => {
  alExpirar = f;
};

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PATCH';
  cuerpo?: unknown;
}

export async function pedir<T>(
  ruta: string,
  { metodo = 'GET', cuerpo }: Opciones = {},
): Promise<T> {
  const cabeceras: Record<string, string> = {};
  const token = almacen.leer();
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'SIN_RED', 'No se pudo conectar con el servidor.');
  }
  if (res.status === 204) return undefined as T;

  let datos: { codigo?: string; mensaje?: string; detalles?: Record<string, unknown> } | null =
    null;
  try {
    datos = await res.json();
  } catch {
    datos = null;
  }
  if (res.ok) return datos as T;

  if (res.status === 401 && ruta !== '/auth/login') {
    almacen.borrar();
    alExpirar();
  }
  const respaldo =
    res.status >= 500 ? 'No se pudo completar la operación.' : 'La operación no se pudo realizar.';
  throw new ErrorApi(
    res.status,
    datos?.codigo ?? 'ERROR',
    datos?.mensaje ?? respaldo,
    datos?.detalles ?? {},
  );
}

/** Convierte un objeto en ?a=1&b=2, sin los valores vacíos. */
export function consulta(parametros: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(parametros)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const texto = q.toString();
  return texto ? `?${texto}` : '';
}
