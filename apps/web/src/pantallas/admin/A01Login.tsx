import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { inicioDe, useSesion } from '../../sesion/Sesion';
import { Boton, Campo, claseEntrada, Franja, mensajeError } from '../../ui/base';

const esquema = z.object({
  username: z.string().trim().min(1, 'Escribe tu correo o tu DNI.').max(120),
  password: z.string().min(1, 'Escribe tu contraseña.'),
  perfil: z.enum(['ADMIN_SISTEMA', 'DUENO'], { message: 'Elige tu perfil.' }),
});
type Datos = z.infer<typeof esquema>;

/** A01: formulario de ingreso del comercio (administrador del negocio o del sistema). Va dentro de `Ingreso`. */
export default function FormularioComercio() {
  const { entrar } = useSesion();
  const navegar = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { perfil: 'DUENO' },
  });

  const enviar = handleSubmit(async (d) => {
    try {
      const s = await entrar(d);
      navegar(inicioDe(s.usuario.perfil), { replace: true });
    } catch (e) {
      setError('root', { message: mensajeError(e) });
    }
  });

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <Campo
        etiqueta="Usuario"
        ayuda="Tu correo o tu DNI, el que te entregaron al darte de alta. Ejemplo: rosa@vecinopay.test"
        error={errors.username?.message}
      >
        {(id) => (
          <input
            id={id}
            autoComplete="username"
            className={claseEntrada}
            {...register('username')}
          />
        )}
      </Campo>
      <Campo
        etiqueta="Contraseña"
        ayuda="La clave de tu usuario. Tiene 8 caracteres o más y distingue mayúsculas."
        error={errors.password?.message}
      >
        {(id) => (
          <input
            id={id}
            type="password"
            autoComplete="current-password"
            className={claseEntrada}
            {...register('password')}
          />
        )}
      </Campo>
      <Campo
        etiqueta="Perfil"
        ayuda="El perfil define qué pantallas ves: la plataforma completa o tu negocio."
        error={errors.perfil?.message}
      >
        {(id) => (
          <select id={id} className={claseEntrada} {...register('perfil')}>
            <option value="DUENO">Administrador del negocio</option>
            <option value="ADMIN_SISTEMA">Administrador del sistema</option>
          </select>
        )}
      </Campo>
      {errors.root && <Franja tipo="error">{errors.root.message}</Franja>}
      <Boton type="submit" disabled={isSubmitting} className="w-full">
        Ingresar
      </Boton>
      <p className="text-xs text-gray-500">Cada inicio de sesión queda registrado.</p>
    </form>
  );
}
