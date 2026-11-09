import { Link, Navigate } from 'react-router-dom';
import { inicioDe, useSesion } from '../../sesion/Sesion';
import { Cargando } from '../../ui/base';

const BENEFICIOS = [
  { titulo: 'Cuotas claras', texto: 'Sabes cuánto pagas, cuándo y por qué.' },
  {
    titulo: 'Todo en un solo lugar',
    texto: 'Saldo, cronograma y pagos desde tu celular.',
  },
  {
    titulo: 'Para tu tienda y para el vecino',
    texto: 'El comercio registra y el cliente consulta.',
  },
];

/** L01: página pública en «/». Sin formularios ni registro abierto (las cuentas las crea la tienda). */
export function Landing() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="mx-auto flex max-w-5xl items-center justify-between p-4">
        <span className="text-xl font-extrabold text-vecino-oscuro">VecinoPay</span>
        <Link
          to="/ingresar"
          className="inline-flex min-h-11 items-center rounded-lg bg-vecino-primario px-5 text-sm font-semibold text-white hover:bg-vecino-oscuro"
        >
          Ingresar
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-12">
        <section className="grid items-center gap-8 py-10 md:grid-cols-2 md:py-16">
          <div>
            <h1 className="text-3xl font-extrabold text-vecino-oscuro md:text-4xl">
              El cuaderno del fiado de tu barrio, ahora en digital.
            </h1>
            <p className="mt-4 text-gray-600">
              VecinoPay ayuda a las tiendas de barrio a llevar las compras al crédito de sus
              vecinos, con cuotas claras, cronograma y registro de pagos.
            </p>
            <p className="mt-6 text-sm">
              ¿Primera vez?{' '}
              <Link to="/m/activar" className="font-semibold text-vecino-primario underline">
                Activa tu cuenta
              </Link>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Tu tienda te entrega un código para activar tu cuenta.
            </p>
          </div>
          <div aria-hidden="true" className="rounded-2xl bg-vecino-oscuro p-8 text-white shadow-sm">
            <p className="text-sm uppercase tracking-wider text-white/70">Tu cuenta</p>
            <p className="mt-2 text-3xl font-extrabold">Al día, sin cuaderno</p>
            <p className="mt-2 text-white/80">Compras, cuotas y pagos en un solo lugar.</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {BENEFICIOS.map((b) => (
            <div key={b.titulo} className="rounded-2xl border border-gray-200 p-5">
              <h2 className="font-bold text-vecino-oscuro">{b.titulo}</h2>
              <p className="mt-1 text-sm text-gray-600">{b.texto}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-gray-100 p-4 text-center text-xs text-gray-500">
        VecinoPay · Trabajo parcial FIE 7651
      </footer>
    </div>
  );
}

/** «/»: con sesión va al inicio de su perfil; sin sesión muestra la landing. */
export function Inicio() {
  const { sesion, cargando } = useSesion();
  if (cargando) return <Cargando />;
  if (sesion) return <Navigate to={inicioDe(sesion.usuario.perfil)} replace />;
  return <Landing />;
}
