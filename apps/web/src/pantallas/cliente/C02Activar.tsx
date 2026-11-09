import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../../api/api';
import { FranjaReloj } from '../../plantillas/Plantilla';
import { inicioDe, useSesion } from '../../sesion/Sesion';
import { Boton, Campo, claseEntrada, Franja, mensajeError } from '../../ui/base';

const esquema = z
  .object({
    dni: z
      .string()
      .trim()
      .regex(/^\d{8}$/, 'El DNI debe tener 8 dígitos numéricos.'),
    codigo: z
      .string()
      .trim()
      .min(1, 'Escribe el código de activación.')
      .max(10, 'El código no debe superar 10 caracteres.'),
    celular: z
      .string()
      .trim()
      .regex(/^\d{9,15}$/, 'El celular debe tener entre 9 y 15 dígitos numéricos.'),
    password: z.string().min(8, 'La contraseña debe tener 8 o más caracteres.').max(72),
    passwordConfirmacion: z.string().min(1, 'Confirma tu contraseña.'),
    aceptaDatos: z.literal(true, {
      errorMap: () => ({
        message: 'Debes aceptar el tratamiento de tus datos personales para activar tu cuenta.',
      }),
    }),
  })
  .refine((d) => d.password === d.passwordConfirmacion, {
    message: 'Las contraseñas no coinciden.',
    path: ['passwordConfirmacion'],
  });

type Datos = z.infer<typeof esquema>;

export default function C02Activar() {
  const { entrar } = useSesion();
  const navegar = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
  });

  const enviar = handleSubmit(async (d) => {
    try {
      await api.activar({
        dni: d.dni,
        codigo: d.codigo.toUpperCase(),
        celular: d.celular,
        password: d.password,
        passwordConfirmacion: d.passwordConfirmacion,
        aceptaDatos: d.aceptaDatos,
      });

      // Iniciamos sesión automáticamente tras la activación exitosa
      try {
        const s = await entrar({ username: d.dni, password: d.password, perfil: 'CLIENTE' });
        navegar(inicioDe(s.usuario.perfil), { replace: true });
      } catch {
        navegar('/m/login', { replace: true, state: { activada: true } });
      }
    } catch (e) {
      setError('root', { message: mensajeError(e) });
    }
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <FranjaReloj />
      <div className="mx-auto max-w-md p-4 sm:p-6">
        <header className="mb-6 text-center">
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-vecino-primario">
            Registro inicial
          </span>
          <h1 className="mt-2 text-2xl font-bold text-vecino-oscuro">Activa tu cuenta</h1>
          <p className="mt-1 text-xs text-gray-600">
            Ingresa el código que te entregó la tienda y crea tu clave personal.
          </p>
        </header>

        <form onSubmit={enviar} noValidate className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
          {errors.root && <Franja tipo="error">{errors.root.message}</Franja>}

          <Campo
            etiqueta="DNI"
            ayuda="Los 8 dígitos de tu documento de identidad con el que te registraron."
            error={errors.dni?.message}
          >
            {(id) => (
              <input
                id={id}
                type="text"
                inputMode="numeric"
                maxLength={8}
                className={claseEntrada}
                placeholder="Ejemplo: 40000002"
                {...register('dni')}
              />
            )}
          </Campo>

          <Campo
            etiqueta="Código de activación"
            ayuda="El código alfanumérico que te dio tu tienda (ejemplo: MDR-7K2Q)."
            error={errors.codigo?.message}
          >
            {(id) => (
              <input
                id={id}
                type="text"
                className={`${claseEntrada} uppercase font-mono`}
                placeholder="Ejemplo: MDR-7K2Q"
                {...register('codigo')}
              />
            )}
          </Campo>

          <Campo
            etiqueta="Teléfono celular"
            ayuda="Tu número de celular para contacto y avisos de corte."
            error={errors.celular?.message}
          >
            {(id) => (
              <input
                id={id}
                type="tel"
                inputMode="tel"
                className={claseEntrada}
                placeholder="Ejemplo: 987654321"
                {...register('celular')}
              />
            )}
          </Campo>

          <Campo
            etiqueta="Nueva contraseña"
            ayuda="Crea una contraseña segura de al menos 8 caracteres."
            error={errors.password?.message}
          >
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="new-password"
                className={claseEntrada}
                placeholder="Mínimo 8 caracteres"
                {...register('password')}
              />
            )}
          </Campo>

          <Campo
            etiqueta="Confirma tu contraseña"
            ayuda="Vuelve a escribir la misma contraseña."
            error={errors.passwordConfirmacion?.message}
          >
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="new-password"
                className={claseEntrada}
                placeholder="Repite tu contraseña"
                {...register('passwordConfirmacion')}
              />
            )}
          </Campo>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
            <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-vecino-primario focus:ring-vecino-primario"
                aria-invalid={errors.aceptaDatos ? true : undefined}
                {...register('aceptaDatos')}
              />
              <span>
                Acepto el tratamiento de mis datos personales para la gestión de compras y pagos en
                VecinoPay (Ley N° 29733).
              </span>
            </label>
            {errors.aceptaDatos?.message && (
              <p role="alert" className="mt-1.5 text-xs text-rose-700 font-medium">
                {errors.aceptaDatos.message}
              </p>
            )}
          </div>

          <Boton type="submit" variante="primario" className="w-full" disabled={isSubmitting}>
            Crear cuenta
          </Boton>
        </form>

        <footer className="mt-6 text-center text-xs text-gray-500">
          ¿Ya activaste tu cuenta?{' '}
          <Link to="/m/login" className="font-semibold text-vecino-primario hover:underline">
            Inicia sesión aquí
          </Link>
        </footer>
      </div>
    </div>
  );
}
