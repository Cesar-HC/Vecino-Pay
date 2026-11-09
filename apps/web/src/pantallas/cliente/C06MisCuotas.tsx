import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/api';
import { formatearFecha, formatearMonto, formatearPorcentajeApi } from '../../lib/formato';
import { Cargando, PanelError, Titulo } from '../../ui/base';

export default function C06MisCuotas() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mi-cuotas'],
    queryFn: api.miCuotas,
  });

  if (isLoading) return <Cargando />;
  if (error || !data) return <PanelError error={error} reintentar={() => void refetch()} />;

  const comprasCuotas = data.compras;

  if (comprasCuotas.length === 0) {
    return (
      <div className="space-y-4">
        <Titulo>Mis cuotas</Titulo>
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm border border-gray-100">
          No tienes compras activas en la modalidad de cuotas.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Titulo>Mis compras en cuotas</Titulo>

      {comprasCuotas.map((c) => (
        <div key={c.ticket} className="space-y-3">
          {/* Tarjeta superior: Cuota mensual, TCEA y próxima cuota */}
          <section className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <span className="text-xs font-mono font-medium text-gray-500">
                Compra {c.ticket} · {c.filas.length} cuotas
              </span>
              {c.tceaPorcentaje && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-vecino-primario">
                  TCEA: {formatearPorcentajeApi(c.tceaPorcentaje)}
                </span>
              )}
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">
                  Cuota mensual
                </span>
                <div className="text-2xl font-extrabold text-vecino-oscuro">
                  {c.cuotaFija ? formatearMonto(c.cuotaFija) : '—'}
                </div>
              </div>
              {c.proximaCuota && (
                <div className="text-right">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Próxima</span>
                  <div className="text-sm font-semibold text-vecino-primario">
                    {formatearFecha(c.proximaCuota.vence)}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Tarjeta central: Cronograma resumido de cuotas */}
          <section className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Cronograma de pagos
            </h2>

            <div className="divide-y divide-gray-100">
              {c.filas.map((q) => (
                <div key={q.numero} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-700 text-xs">
                      {q.numero}
                    </span>
                    <div>
                      <span className="font-medium text-gray-900">Cuota {q.numero}</span>
                      <div className="text-xs text-gray-400">Vence: {formatearFecha(q.vence)}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-gray-900">{formatearMonto(q.monto)}</div>
                    <span
                      className={`text-xs font-semibold uppercase ${
                        q.estado === 'PAGADO'
                          ? 'text-emerald-700'
                          : q.estado === 'VENCIDO'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                      }`}
                    >
                      {q.estado === 'PAGADO'
                        ? 'Pagada'
                        : q.estado === 'VENCIDO'
                          ? 'Vencida'
                          : 'Pendiente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tarjeta inferior pedagógica: Explicación de periodo de gracia */}
          {c.explicacion && c.explicacion.g > 0 && (
            <section className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-950">
              <div className="flex items-center gap-2 font-bold text-emerald-900 mb-1.5">
                <span aria-hidden="true">💡</span>
                <span>¿Por qué {c.explicacion.g} días de gracia?</span>
              </div>
              <p className="text-emerald-900 leading-relaxed">
                Compraste el <strong>{formatearFecha(c.explicacion.fechaCompra)}</strong> por un
                valor de lista de <strong>{formatearMonto(c.explicacion.montoLista)}</strong>. Hasta
                tu fecha de pago del <strong>{formatearFecha(c.explicacion.fechaPago)}</strong>{' '}
                pasaron <strong>{c.explicacion.g} días</strong> en los que no pagaste nada. El
                interés de esos días (<strong>{formatearMonto(c.explicacion.interesGracia)}</strong>
                ) se sumó a tu deuda, que empezó en{' '}
                <strong>{formatearMonto(c.explicacion.capitalCapitalizado)}</strong>, y de ahí salen
                tus cuotas iguales.
              </p>
            </section>
          )}
        </div>
      ))}
    </div>
  );
}
