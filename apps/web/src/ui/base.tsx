import {
  ButtonHTMLAttributes,
  ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ErrorApi } from '../api/cliente';

/** El globo de ayuda se abre con mouse, foco y toque (T11). */
export function Ayuda({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  const globo = useRef<HTMLSpanElement>(null);
  const [ajuste, setAjuste] = useState(0);
  // Se mide al abrir y se mueve lo justo para que entre en la ventana, en cualquier ancho.
  useLayoutEffect(() => {
    if (!abierto || !globo.current) return;
    const margen = 8;
    const { left, right } = globo.current.getBoundingClientRect();
    const ancho = document.documentElement.clientWidth;
    const exceso = right - ajuste - (ancho - margen);
    const disponible = left - ajuste - margen;
    setAjuste(exceso > 0 ? Math.max(-disponible, -exceso) : 0);
    // Solo al abrir: el ajuste nuevo no debe volver a medirse.
  }, [abierto]);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label={`Ayuda: ${texto}`}
        className="relative ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-vecino/10 text-xs font-bold text-vecino-oscuro after:absolute after:-inset-x-2.5 after:-bottom-1 after:-top-2.5 after:content-['']"
        onMouseEnter={() => setAbierto(true)}
        onMouseLeave={() => setAbierto(false)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        // Un toque dispara mouseenter, focus y click: alternar aquí lo cerraría al abrirlo.
        onClick={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAbierto(false);
        }}
      >
        ?
      </button>
      {abierto && (
        <span
          ref={globo}
          role="tooltip"
          style={{ transform: ajuste ? `translateX(${ajuste}px)` : undefined }}
          className="absolute left-0 z-30 mt-1 block w-64 max-w-[calc(100vw-1rem)] rounded-lg bg-gray-900 p-2 text-xs font-normal text-white shadow-lg"
        >
          {texto}
        </span>
      )}
    </span>
  );
}

interface PropsCampo {
  etiqueta: string;
  /** Obligatoria: un campo sin globo no compila (RF13). */
  ayuda: string;
  error?: string;
  children: (id: string) => ReactNode;
}

export function Campo({ etiqueta, ayuda, error, children }: PropsCampo) {
  const id = useId();
  return (
    <div>
      <div className="mb-1 flex items-center">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {etiqueta}
        </label>
        <Ayuda texto={ayuda} />
      </div>
      {children(id)}
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const claseEntrada =
  'w-full min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-vecino focus:outline-none focus:ring-1 focus:ring-vecino disabled:bg-gray-100 disabled:text-gray-500';

type Variante = 'primario' | 'secundario' | 'peligro';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-vecino text-white hover:bg-vecino-oscuro',
  secundario: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50',
  peligro: 'bg-red-700 text-white hover:bg-red-800',
};

export function Boton({
  variante = 'primario',
  className = '',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
      {...resto}
    />
  );
}

export function Tarjeta({
  titulo,
  children,
  className = '',
}: {
  titulo?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl bg-white p-4 shadow-sm ${className}`}>
      {titulo && <h2 className="mb-3 text-base font-semibold text-vecino-oscuro">{titulo}</h2>}
      {children}
    </section>
  );
}

/** Las tablas anchas se desplazan dentro de su contenedor: la página nunca lo hace. */
export function Tabla({
  columnas,
  children,
  pie,
}: {
  columnas: ReactNode[];
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
            {columnas.map((c, i) => (
              <th key={i} className="px-3 py-2 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
        {pie && <tfoot className="border-t-2 border-gray-300 font-semibold">{pie}</tfoot>}
      </table>
    </div>
  );
}

export const Celda = ({
  children,
  derecha = false,
  colSpan,
}: {
  children?: ReactNode;
  derecha?: boolean;
  colSpan?: number;
}) => (
  <td
    colSpan={colSpan}
    className={`px-3 py-2 ${derecha ? 'whitespace-nowrap text-right tabular-nums' : ''}`}
  >
    {children}
  </td>
);

export const Titulo = ({ children }: { children: ReactNode }) => (
  <h2 className="text-xl font-bold text-vecino-oscuro">{children}</h2>
);

export const Cargando = () => (
  <div role="status" aria-label="Cargando" className="space-y-3 p-2">
    <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
    <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
  </div>
);

export const Vacio = ({ texto }: { texto: string }) => (
  <p className="p-4 text-center text-sm text-gray-500">{texto}</p>
);

export const Franja = ({
  tipo,
  children,
}: {
  tipo: 'error' | 'exito' | 'aviso';
  children: ReactNode;
}) => {
  const clase = {
    error: 'bg-red-50 text-red-800 border-red-200',
    exito: 'bg-green-50 text-green-900 border-green-200',
    aviso: 'bg-amber-50 text-amber-900 border-amber-200',
  }[tipo];
  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2 text-sm ${clase}`}
    >
      {children}
    </div>
  );
};

export function mensajeError(e: unknown): string {
  if (e instanceof ErrorApi) {
    if (e.estado === 403) return 'No tienes permiso para esta acción.';
    if (e.estado === 404 && e.codigo === 'NO_EXISTE')
      return 'No existe o no pertenece a tu tienda.';
    return e.message;
  }
  return 'No se pudo completar la operación.';
}

export function PanelError({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  return (
    <div className="space-y-2">
      <Franja tipo="error">{mensajeError(error)}</Franja>
      {reintentar && (
        <Boton variante="secundario" onClick={reintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}

export function Kpi({
  titulo,
  valor,
  detalle,
  ayuda,
}: {
  titulo: string;
  valor: ReactNode;
  detalle?: ReactNode;
  ayuda?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="flex items-center text-xs font-medium uppercase text-gray-500">
        {titulo}
        {ayuda && <Ayuda texto={ayuda} />}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-vecino-oscuro">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-gray-500">{detalle}</p>}
    </div>
  );
}

export function Modal({
  titulo,
  children,
  alCerrar,
}: {
  titulo: string;
  children: ReactNode;
  alCerrar: () => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    caja.current?.focus();
  }, []);
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onKeyDown={(e) => {
        if (e.key === 'Escape') alCerrar();
      }}
    >
      <div
        ref={caja}
        tabIndex={-1}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl outline-none"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-vecino-oscuro">{titulo}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            className="min-h-10 min-w-10 text-xl text-gray-500"
            onClick={alCerrar}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirmar({
  titulo,
  texto,
  accion,
  alConfirmar,
  alCerrar,
  ocupado,
}: {
  titulo: string;
  texto: string;
  accion: string;
  alConfirmar: () => void;
  alCerrar: () => void;
  ocupado?: boolean;
}) {
  return (
    <Modal titulo={titulo} alCerrar={alCerrar}>
      <p className="mb-4 text-sm text-gray-700">{texto}</p>
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <Boton variante="peligro" disabled={ocupado} onClick={alConfirmar}>
          {accion}
        </Boton>
      </div>
    </Modal>
  );
}

const COLORES: Record<string, string> = {
  ACTIVO: 'bg-green-100 text-green-900',
  EMITIDO: 'bg-blue-100 text-blue-900',
  PENDIENTE: 'bg-blue-100 text-blue-900',
  PAGADO: 'bg-green-100 text-green-900',
  PAGADA: 'bg-green-100 text-green-900',
  VENCIDO: 'bg-red-100 text-red-900',
  INACTIVO: 'bg-gray-200 text-gray-800',
  BAJA: 'bg-red-100 text-red-900',
};

/** Muestra el estado tal cual; A03 pasa "BAJA" como etiqueta de INACTIVO. */
export function Insignia({ estado, etiqueta }: { estado: string; etiqueta?: string }) {
  const texto = etiqueta ?? estado;
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${COLORES[texto] ?? COLORES[estado] ?? 'bg-gray-100'}`}
    >
      {texto}
    </span>
  );
}

/** Porcentajes de la API, solo para el ancho: el texto muestra el valor real. */
export function BarraUso({ actual, conCompra }: { actual: string; conCompra?: string }) {
  const tope = (p: string) => `min(${p}%, 100%)`;
  return (
    <div
      className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200"
      aria-hidden="true"
    >
      {conCompra && (
        <div
          className="absolute inset-y-0 left-0 bg-orange-400"
          style={{ width: tope(conCompra) }}
        />
      )}
      <div className="absolute inset-y-0 left-0 bg-vecino" style={{ width: tope(actual) }} />
    </div>
  );
}

export const Dato = ({
  etiqueta,
  children,
  ayuda,
}: {
  etiqueta: string;
  children: ReactNode;
  ayuda?: string;
}) => (
  <div>
    <dt className="flex items-center text-xs text-gray-500">
      {etiqueta}
      {ayuda && <Ayuda texto={ayuda} />}
    </dt>
    <dd className="font-medium tabular-nums">{children}</dd>
  </div>
);
