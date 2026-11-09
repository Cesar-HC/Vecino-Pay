import { Link, useNavigate } from 'react-router-dom';
import { useSesion } from '../../sesion/Sesion';
import { Titulo } from '../../ui/base';

interface Destino {
  ruta: string;
  icono: string;
  titulo: string;
  descripcion: string;
}

const DESTINOS: Destino[] = [
  {
    ruta: '/m',
    icono: '🏠',
    titulo: 'Inicio',
    descripcion: 'Resumen de deuda, crédito disponible y compras',
  },
  {
    ruta: '/m/listado',
    icono: '📄',
    titulo: 'Mi listado de pago',
    descripcion: 'Detalle de compras y montos del ciclo actual',
  },
  {
    ruta: '/m/cuotas',
    icono: '📅',
    titulo: 'Mis cuotas',
    descripcion: 'Cronograma, TCEA y cuotas pendientes',
  },
  {
    ruta: '/m/pagos',
    icono: '💵',
    titulo: 'Mis pagos',
    descripcion: 'Historial de abonos e imputación de mora',
  },
  {
    ruta: '/m/perfil',
    icono: '👤',
    titulo: 'Mi perfil y condiciones',
    descripcion: 'Tasas pactadas, límites y cambio de clave',
  },
  {
    ruta: '/m/ayuda',
    icono: '❓',
    titulo: 'Ayuda y fórmulas',
    descripcion: 'Aprende cómo se calculan los intereses de tus compras',
  },
];

export default function C04MenuCliente() {
  const { sesion, salir } = useSesion();
  const navegar = useNavigate();

  const cerrarSesion = () => {
    salir();
    navegar('/m/login', { replace: true });
  };

  return (
    <div className="space-y-4">
      <Titulo>Menú principal</Titulo>

      <div className="divide-y divide-gray-100 rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        {DESTINOS.map((d) => (
          <Link
            key={d.ruta}
            to={d.ruta}
            className="flex items-center gap-3.5 p-4 hover:bg-gray-50 transition-colors"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gray-100 text-lg"
            >
              {d.icono}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">{d.titulo}</div>
              <div className="text-xs text-gray-500 truncate">{d.descripcion}</div>
            </div>
            <span className="text-gray-400 text-sm">›</span>
          </Link>
        ))}
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={cerrarSesion}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
        >
          <span>🚪</span>
          <span>Cerrar sesión</span>
        </button>
      </div>

      <footer className="pt-4 text-center text-xs text-gray-400">
        <p className="font-medium text-gray-600">{sesion?.usuario?.nombres}</p>
        <p>Cuenta: {sesion?.cliente?.numeroCuenta ?? '—'}</p>
        <p className="mt-1 text-xs">VecinoPay v0.1.0 • FIE 7651 (2026-20)</p>
      </footer>
    </div>
  );
}
