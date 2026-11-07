import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api/api';
import { formatearFecha } from '../lib/formato';
import { useSesion } from '../sesion/Sesion';
import { claseEntrada, Franja, mensajeError } from '../ui/base';

/** Solo con reloj fijo: las cifras dependen de la fecha y, en la demo, no es la hora real. */
export function FranjaReloj() {
  const { data } = useQuery({ queryKey: ['salud'], queryFn: api.salud, staleTime: 30000 });
  if (!data?.relojFijo) return null;
  return (
    <div data-sin-imprimir className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-950">
      Demostración: reloj fijo en {formatearFecha(data.fechaLima)} {data.horaLima} (hora de Lima).
      {data.fechaOperativa !== data.fechaLima &&
        ` Cuenta como del ${formatearFecha(data.fechaOperativa)}.`}
    </div>
  );
}

/** Solo con 2 tiendas o más (decisión de Adrián). */
export function SelectorTienda() {
  const { sesion, cambiarTienda } = useSesion();
  const navegar = useNavigate();
  const [error, setError] = useState<string | null>(null);
  if (!sesion || sesion.tiendas.length < 2) return null;
  return (
    <div>
      <label className="sr-only" htmlFor="selector-tienda">
        Tienda
      </label>
      <select
        id="selector-tienda"
        className={claseEntrada}
        value={sesion.tienda?.id ?? ''}
        onChange={(e) => {
          setError(null);
          cambiarTienda(e.target.value)
            .then(() => navegar('/dueno', { replace: true }))
            .catch((x) => setError(mensajeError(x)));
        }}
      >
        {sesion.tiendas.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombreComercial}
          </option>
        ))}
      </select>
      {error && <Franja tipo="error">{error}</Franja>}
    </div>
  );
}

const MENU_ADMIN = [
  { a: '/admin', texto: 'Resumen', fin: true },
  { a: '/admin/tiendas', texto: 'Tiendas' },
  { a: '/admin/usuarios', texto: 'Usuarios' },
  { a: '/admin/auditoria', texto: 'Auditoría' },
];
const MENU_DUENO = [
  { a: '/dueno', texto: 'Resumen', fin: true },
  { a: '/dueno/compras/nueva', texto: 'Compras' },
  { a: '/dueno/clientes', texto: 'Clientes' },
  { a: '/dueno/listados', texto: 'Listados' },
  { a: '/dueno/pagos', texto: 'Pagos' },
  { a: '/dueno/cronogramas', texto: 'Cronogramas' },
  { a: '/dueno/productos', texto: 'Catálogo' },
  { a: '/dueno/ayuda', texto: 'Ayuda' },
];

export function Plantilla({ tipo }: { tipo: 'admin' | 'dueno' }) {
  const { sesion, salir } = useSesion();
  const navegar = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const menu = tipo === 'admin' ? MENU_ADMIN : MENU_DUENO;
  return (
    <div className="min-h-screen bg-gray-100 lg:flex">
      <aside
        data-sin-imprimir
        className="bg-vecino-oscuro text-white lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:flex-none lg:overflow-y-auto"
      >
        <div className="flex items-center justify-between p-4">
          <span className="text-lg font-bold">VecinoPay</span>
          <button
            type="button"
            className="min-h-10 min-w-10 rounded border border-white/40 lg:hidden"
            aria-expanded={abierto}
            aria-label="Menú"
            onClick={() => setAbierto((v) => !v)}
          >
            ☰
          </button>
        </div>
        <nav className={`${abierto ? 'block' : 'hidden'} px-2 pb-3 lg:block`}>
          {menu.map((m) => (
            <NavLink
              key={m.a}
              to={m.a}
              end={m.fin}
              onClick={() => setAbierto(false)}
              className={({ isActive }) =>
                `mb-1 block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'}`
              }
            >
              {m.texto}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <FranjaReloj />
        <header
          data-sin-imprimir
          className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 shadow-sm"
        >
          <p className="min-w-0 text-sm text-gray-700">
            <span className="font-semibold">{sesion?.usuario.nombres}</span>
            {sesion?.tienda && sesion.tiendas.length < 2 && (
              <span className="text-gray-500"> · {sesion.tienda.nombreComercial}</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <SelectorTienda />
            <button
              type="button"
              className="min-h-10 rounded-lg px-3 text-sm text-vecino-oscuro underline"
              onClick={() => {
                salir();
                navegar('/login');
              }}
            >
              Salir
            </button>
          </div>
        </header>
        <main className="space-y-4 p-4">
          {/* La clave desmonta la pantalla al cambiar de tienda: no queda nada de la anterior. */}
          <Outlet key={sesion?.tienda?.id ?? 'plataforma'} />
        </main>
      </div>
    </div>
  );
}
