import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { FranjaReloj } from '../../plantillas/Plantilla';
import { inicioDe, useSesion } from '../../sesion/Sesion';
import { Franja } from '../../ui/base';
import FormularioComercio from '../admin/A01Login';
import FormularioCliente from '../cliente/C01LoginCliente';

type Modo = 'cliente' | 'comercio';

const MODOS: { id: Modo; texto: string }[] = [
  { id: 'cliente', texto: 'Soy cliente' },
  { id: 'comercio', texto: 'Soy comercio' },
];

/** Ingreso único (A01 + C01): una sola pantalla para los tres perfiles. No hay registro abierto. */
export default function Ingreso({ modoInicial }: { modoInicial: Modo }) {
  const { sesion, aviso } = useSesion();
  const activada = (useLocation().state as { activada?: boolean } | null)?.activada;
  const [modo, setModo] = useState<Modo>(modoInicial);

  if (sesion) return <Navigate to={inicioDe(sesion.usuario.perfil)} replace />;

  return (
    <div className="min-h-screen bg-gray-100">
      <FranjaReloj />
      <div className="mx-auto grid max-w-4xl gap-6 p-4 md:grid-cols-2 md:p-10">
        <section className="flex flex-col justify-center rounded-2xl bg-vecino-oscuro p-6 text-white md:p-8">
          <h1 className="text-3xl font-bold">VecinoPay</h1>
          <p className="mt-2 text-white/90">
            El cuaderno del fiado de tu barrio, ahora en digital.
          </p>
        </section>

        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-vecino-oscuro">Inicia sesión</h2>

          <div
            role="tablist"
            aria-label="Tipo de ingreso"
            className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1"
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              const otro: Modo = modo === 'cliente' ? 'comercio' : 'cliente';
              setModo(otro);
              document.getElementById(`pestana-${otro}`)?.focus();
            }}
          >
            {MODOS.map((m) => (
              <button
                key={m.id}
                id={`pestana-${m.id}`}
                type="button"
                role="tab"
                aria-selected={modo === m.id}
                aria-controls="panel-ingreso"
                tabIndex={modo === m.id ? 0 : -1}
                onClick={() => setModo(m.id)}
                className={`min-h-11 rounded-lg px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-vecino-primario ${
                  modo === m.id ? 'bg-white text-vecino-oscuro shadow-sm' : 'text-gray-600'
                }`}
              >
                {m.texto}
              </button>
            ))}
          </div>

          {aviso && <Franja tipo="aviso">{aviso}</Franja>}
          {activada && modo === 'cliente' && (
            <Franja tipo="exito">Cuenta creada. Ingresa con tu DNI y tu nueva contraseña.</Franja>
          )}

          <div id="panel-ingreso" role="tabpanel" aria-labelledby={`pestana-${modo}`}>
            {modo === 'cliente' ? <FormularioCliente /> : <FormularioComercio />}
          </div>

          <div className="space-y-1 border-t border-gray-100 pt-3 text-center text-xs text-gray-600">
            <p>
              ¿Primera vez?{' '}
              <Link to="/m/activar" className="font-semibold text-vecino-primario hover:underline">
                Activa tu cuenta
              </Link>
            </p>
            <p>
              <Link to="/" className="text-gray-500 hover:text-gray-700">
                Volver al inicio
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
