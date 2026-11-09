import { NavLink, Outlet } from 'react-router-dom';
import { useSesion } from '../sesion/Sesion';
import { FranjaReloj } from './Plantilla';

interface ElementoMenu {
  a: string;
  texto: string;
  icono: string;
  fin?: boolean;
}

const MENU_INFERIOR: ElementoMenu[] = [
  { a: '/m', texto: 'Inicio', icono: '🏠', fin: true },
  { a: '/m/listado', texto: 'Compras', icono: '📄' },
  { a: '/m/cuotas', texto: 'Cuotas', icono: '📅' },
  { a: '/m/pagos', texto: 'Pagos', icono: '💵' },
  { a: '/m/menu', texto: 'Más', icono: '☰' },
];

export function PlantillaCliente() {
  const { sesion } = useSesion();

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <FranjaReloj />
      <header className="sticky top-0 z-30 bg-vecino-oscuro text-white shadow-sm">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div>
            <span className="text-xs uppercase tracking-wider text-emerald-300">
              {sesion?.tienda?.nombreComercial ?? 'VecinoPay'}
            </span>
            <h1 className="text-lg font-bold leading-tight">
              {sesion?.usuario?.nombres
                ? `Hola, ${sesion.usuario.nombres.split(' ')[0]}`
                : 'VecinoPay'}
            </h1>
          </div>
          {sesion?.cliente && (
            <span className="rounded-full bg-emerald-800/80 px-2.5 py-1 text-xs font-mono font-medium text-emerald-100">
              {sesion.cliente.numeroCuenta}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md p-4">
        <Outlet />
      </main>

      <nav
        aria-label="Navegación principal móvil"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-md justify-around py-1">
          {MENU_INFERIOR.map((item) => (
            <NavLink
              key={item.a}
              to={item.a}
              end={item.fin}
              className={({ isActive }) =>
                `flex min-h-12 min-w-16 flex-col items-center justify-center rounded-lg px-2 text-xs transition-colors ${
                  isActive ? 'font-bold text-vecino-primario' : 'text-gray-500 hover:text-gray-800'
                }`
              }
            >
              <span className="text-lg" aria-hidden="true">
                {item.icono}
              </span>
              <span>{item.texto}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
