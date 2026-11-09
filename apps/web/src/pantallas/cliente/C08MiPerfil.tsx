import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../../api/api';
import { etiquetaTasa, formatearMonto, formatearTasaResumida } from '../../lib/formato';
import {
  Boton,
  Campo,
  Cargando,
  claseEntrada,
  Franja,
  mensajeError,
  PanelError,
  Titulo,
} from '../../ui/base';

const esquemaClave = z
  .object({
    actual: z.string().min(1, 'Escribe tu contraseña actual.'),
    nueva: z.string().min(8, 'La nueva contraseña debe tener 8 o más caracteres.').max(72),
    confirmacion: z.string().min(1, 'Confirma tu nueva contraseña.'),
  })
  .refine((d) => d.nueva === d.confirmacion, {
    message: 'Las nuevas contraseñas no coinciden.',
    path: ['confirmacion'],
  });

type DatosClave = z.infer<typeof esquemaClave>;

export default function C08MiPerfil() {
  const [exitoClave, setExitoClave] = useState(false);

  const {
    data: perfil,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['mi-perfil'],
    queryFn: api.miPerfil,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DatosClave>({
    resolver: zodResolver(esquemaClave),
  });

  const cambiarClave = handleSubmit(async (d) => {
    setExitoClave(false);
    try {
      await api.cambiarContrasena({ actual: d.actual, nueva: d.nueva });
      setExitoClave(true);
      reset();
    } catch (e) {
      setError('root', { message: mensajeError(e) });
    }
  });

  if (isLoading) return <Cargando />;
  if (error || !perfil) return <PanelError error={error} reintentar={() => void refetch()} />;

  return (
    <div className="space-y-4">
      <Titulo>Mi perfil y condiciones</Titulo>

      {/* Datos personales */}
      <section className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Datos del titular
        </h2>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">Nombre completo:</span>
            <span className="font-semibold text-gray-900">
              {perfil.nombres} {perfil.apellidos}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">DNI:</span>
            <span className="font-mono text-gray-900">{perfil.dni}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">N° de cuenta:</span>
            <span className="font-mono font-medium text-vecino-primario">
              {perfil.numeroCuenta}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">Celular:</span>
            <span className="text-gray-900">{perfil.celular}</span>
          </div>
          {perfil.direccion && (
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Dirección:</span>
              <span className="text-gray-900 text-right">{perfil.direccion}</span>
            </div>
          )}
        </div>
      </section>

      {/* Condiciones de crédito pactadas con la tienda */}
      <section className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Condiciones de crédito
          </h2>
          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
            Pactadas con la tienda
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">Límite de crédito:</span>
            <span className="font-bold text-gray-900">
              {formatearMonto(perfil.limiteCredito, perfil.moneda)}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">Moneda:</span>
            <span className="font-medium text-gray-900">
              {perfil.moneda === 'USD' ? 'Dólares (USD)' : 'Soles (PEN)'}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">Tasa compensatoria:</span>
            <span className="font-medium text-gray-900">
              {etiquetaTasa(perfil.tasa.tipo, perfil.tasa.plazo, perfil.tasa.capitalizacion)}{' '}
              {formatearTasaResumida(perfil.tasa.valor)}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">Tasa moratoria:</span>
            <span className="font-medium text-gray-900">
              TEA {formatearTasaResumida(perfil.tasaMora.valor)}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">Día de corte del ciclo:</span>
            <span className="font-medium text-gray-900">Día {perfil.diaCorte} de cada mes</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">Hora de corte fija:</span>
            <span className="font-mono text-gray-900">{perfil.horaCorte}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <span className="text-gray-500">Día límite de pago:</span>
            <span className="font-medium text-vecino-primario">
              Día {perfil.diaPago} de cada mes
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-500">Plazo máximo en cuotas:</span>
            <span className="text-gray-900">{perfil.maxMeses} meses</span>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-400">
          Nota: Estas condiciones fueron acordadas con el dueño de la tienda y no pueden ser
          modificadas desde el portal del cliente.
        </p>
      </section>

      {/* Cambio de contraseña */}
      <section className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Seguridad: cambiar contraseña
        </h2>

        {exitoClave && (
          <div className="mb-3">
            <Franja tipo="exito">Tu contraseña se actualizó correctamente.</Franja>
          </div>
        )}
        {errors.root && (
          <div className="mb-3">
            <Franja tipo="error">{errors.root.message}</Franja>
          </div>
        )}

        <form onSubmit={cambiarClave} noValidate className="space-y-3">
          <Campo
            etiqueta="Contraseña actual"
            ayuda="La que usas hoy para entrar."
            error={errors.actual?.message}
          >
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="current-password"
                className={claseEntrada}
                {...register('actual')}
              />
            )}
          </Campo>

          <Campo
            etiqueta="Nueva contraseña (mínimo 8 caracteres)"
            ayuda="Elige una que no uses en otro sitio. Mínimo 8 caracteres."
            error={errors.nueva?.message}
          >
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="new-password"
                className={claseEntrada}
                {...register('nueva')}
              />
            )}
          </Campo>

          <Campo
            etiqueta="Confirmar nueva contraseña"
            ayuda="Repite la nueva contraseña para evitar errores."
            error={errors.confirmacion?.message}
          >
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="new-password"
                className={claseEntrada}
                {...register('confirmacion')}
              />
            )}
          </Campo>

          <Boton type="submit" variante="secundario" className="w-full" disabled={isSubmitting}>
            Actualizar contraseña
          </Boton>
        </form>
      </section>
    </div>
  );
}
