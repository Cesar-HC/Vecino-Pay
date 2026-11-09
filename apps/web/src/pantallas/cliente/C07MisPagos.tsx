import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/api';
import { formatearFecha, formatearMonto } from '../../lib/formato';
import { Cargando, PanelError, Titulo } from '../../ui/base';

export default function C07MisPagos() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mi-pagos'],
    queryFn: api.miPagos,
  });

  if (isLoading) return <Cargando />;
  if (error || !data) return <PanelError error={error} reintentar={() => void refetch()} />;

  const { pagos, disponible } = data;
  const ultimoPago = pagos[0];
  const pagosAnteriores = pagos.slice(1);

  if (pagos.length === 0) {
    return (
      <div className="space-y-4">
        <Titulo>Mis pagos</Titulo>
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm border border-gray-100">
          Aún no registras pagos realizados en tu cuenta.
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 text-center">
          <span className="text-xs text-gray-500">Crédito disponible</span>
          <div className="text-xl font-bold text-vecino-primario">{formatearMonto(disponible)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Titulo>Mis pagos y recibos</Titulo>

      {/* Tarjeta del último pago realizado */}
      {ultimoPago && (
        <section className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Último pago registrado
            </span>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                Pagado
              </span>
              {ultimoPago.diasMora > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {ultimoPago.diasMora} d mora
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-xs text-gray-500">Importe cancelado</span>
              <div className="text-3xl font-extrabold text-vecino-oscuro">
                {formatearMonto(ultimoPago.monto)}
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <div>{formatearFecha(ultimoPago.fecha)}</div>
              <div className="font-medium text-gray-700 capitalize">
                {ultimoPago.medioPago.toLowerCase()}
              </div>
              {ultimoPago.numeroOperacion && (
                <div className="font-mono text-xs text-gray-400">
                  Op: {ultimoPago.numeroOperacion}
                </div>
              )}
            </div>
          </div>

          {/* Desglose de imputación (Mora -> Interés -> Capital) */}
          <div className="mt-4 rounded-xl bg-gray-50 p-3.5 border border-gray-100">
            <span className="text-xs font-bold text-gray-700 block mb-2">
              Imputación del pago (Orden de prelación):
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>1. Interés moratorio ({ultimoPago.diasMora} días):</span>
                <span className="font-mono font-medium">
                  {formatearMonto(ultimoPago.imputacion.mora)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>2. Interés compensatorio:</span>
                <span className="font-mono font-medium">
                  {formatearMonto(ultimoPago.imputacion.interes)}
                </span>
              </div>
              <div className="flex justify-between text-gray-900 font-semibold pt-1 border-t border-gray-200">
                <span>3. Amortización de capital:</span>
                <span className="font-mono">{formatearMonto(ultimoPago.imputacion.capital)}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Pagos anteriores */}
      {pagosAnteriores.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Pagos anteriores
          </h2>

          <div className="divide-y divide-gray-100">
            {pagosAnteriores.map((p) => (
              <div
                key={`${p.listadoNumero}-${p.fecha}-${p.monto}`}
                className="flex items-center justify-between py-2.5 text-xs"
              >
                <div>
                  <div className="font-medium text-gray-900">{formatearFecha(p.fecha)}</div>
                  <div className="text-xs text-gray-500">
                    {p.medioPago} {p.diasMora > 0 ? `• ${p.diasMora} d mora` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{formatearMonto(p.monto)}</div>
                  <div className="text-xs text-gray-400">Listado {p.listadoNumero}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Crédito disponible después del pago */}
      <section className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
        <span className="text-xs text-emerald-800 font-medium">Tu crédito disponible hoy es:</span>
        <div className="text-2xl font-bold text-vecino-primario mt-0.5">
          {formatearMonto(disponible)}
        </div>
      </section>
    </div>
  );
}
