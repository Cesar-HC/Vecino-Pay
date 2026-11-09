import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
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

/** C01: formulario de ingreso del cliente (DNI y contraseña). Va dentro de `Ingreso`. */
export default function FormularioCliente() {
  const { entrar } = useSesion();
  const navegar = useNavigate();
  const [mensajeRecuperacion, setMensajeRecuperacion] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) });

  const enviar = handleSubmit(async (d) => {
    try {
      const s = await entrar({ username: d.dni, password: d.password, perfil: 'CLIENTE' });
      navegar(inicioDe(s.usuario.perfil), { replace: true });
    } catch (e) {
      setError('root', { message: mensajeError(e) });
    }
  });

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {mensajeRecuperacion && (
        <Franja tipo="aviso">
          Para restablecer tu contraseña, comunícate con el dueño de tu tienda habitual para que te
          entregue una clave temporal.
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

      <div className="text-xs">
        <button
          type="button"
          onClick={() => setMensajeRecuperacion((v) => !v)}
          className="text-vecino-primario underline hover:text-vecino-oscuro"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      {errors.root && <Franja tipo="error">{errors.root.message}</Franja>}

      <Boton type="submit" variante="primario" className="w-full" disabled={isSubmitting}>
        Ingresar
      </Boton>
    </form>
  );
}
