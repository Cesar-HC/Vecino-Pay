import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { FranjaReloj } from '../../plantillas/Plantilla';
import { inicioDe, useSesion } from '../../sesion/Sesion';
import { Boton, Campo, claseEntrada, Franja, mensajeError } from '../../ui/base';

const esquema = z.object({
  dni: z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'El DNI debe tener 8 dígitos numéricos.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
});
type Datos = z.infer<typeof esquema>;

export default function C01LoginCliente() {
  const { sesion, entrar, aviso } = useSesion();
  const activada = (useLocation().state as { activada?: boolean } | null)?.activada;
  const navegar = useNavigate();
  const [mensajeRecuperacion, setMensajeRecuperacion] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
  });

  if (sesion) return <Navigate to={inicioDe(sesion.usuario.perfil)} replace />;

  const enviar = handleSubmit(async (d) => {
    try {
      const s = await entrar({ username: d.dni, password: d.password, perfil: 'CLIENTE' });
      navegar(inicioDe(s.usuario.perfil), { replace: true });
    } catch (e) {
      setError('root', { message: mensajeError(e) });
    }
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <FranjaReloj />
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md flex-col justify-between p-4 sm:p-6">
        <div className="space-y-6 pt-4">
          <header className="text-center">
            <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-vecino-primario">
              Portal del Cliente
            </span>
            <h1 className="mt-2 text-3xl font-extrabold text-vecino-oscuro">VecinoPay</h1>
            <p className="mt-1 text-sm text-gray-600">
              Revisa tu saldo, cuotas y pagos desde tu celular.
            </p>
          </header>

          <form
            onSubmit={enviar}
            noValidate
            className="space-y-4 rounded-2xl bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold text-gray-900">Iniciar sesión</h2>
            {aviso && <Franja tipo="aviso">{aviso}</Franja>}
            {activada && (
              <Franja tipo="exito">Cuenta creada. Ingresa con tu DNI y tu nueva contraseña.</Franja>
            )}
            {mensajeRecuperacion && (
              <Franja tipo="aviso">
                Para restablecer tu contraseña, comunícate con el dueño de tu tienda habitual para
                que te entregue una clave temporal.
              </Franja>
            )}

            <Campo
              etiqueta="DNI"
              ayuda="Los 8 dígitos de tu documento de identidad nacional."
              error={errors.dni?.message}
            >
              {(id) => (
                <input
                  id={id}
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  autoComplete="username"
                  className={claseEntrada}
                  placeholder="Ejemplo: 45872316"
                  {...register('dni')}
                />
              )}
            </Campo>

            <Campo
              etiqueta="Contraseña"
              ayuda="La contraseña que elegiste al activar tu cuenta."
              error={errors.password?.message}
            >
              {(id) => (
                <input
                  id={id}
                  type="password"
                  autoComplete="current-password"
                  className={claseEntrada}
                  placeholder="Tu contraseña"
                  {...register('password')}
                />
              )}
            </Campo>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setMensajeRecuperacion((v) => !v)}
                className="text-vecino-primario underline hover:text-vecino-oscuro"
              >
                ¿Olvidaste tu contraseña?
              </button>
              <Link to="/m/activar" className="font-semibold text-vecino-primario hover:underline">
                Activar cuenta
              </Link>
            </div>

            {errors.root && <Franja tipo="error">{errors.root.message}</Franja>}

            <Boton type="submit" variante="primario" className="w-full" disabled={isSubmitting}>
              Ingresar
            </Boton>
          </form>
        </div>

        <footer className="my-6 text-center text-xs text-gray-500">
          <p>
            Tu tienda de barrio te registra como cliente. Si es tu primera vez,{' '}
            <Link to="/m/activar" className="font-medium text-vecino-primario underline">
              activa tu cuenta con tu DNI
            </Link>
            .
          </p>
          <div className="mt-3">
            <Link to="/login" className="text-gray-400 hover:text-gray-600">
              ¿Eres dueño o administrador? Acceso web aquí
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
