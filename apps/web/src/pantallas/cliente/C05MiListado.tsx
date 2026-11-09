import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../api/api';
import { formatearFecha, formatearMonto } from '../../lib/formato';
import { Cargando, PanelError, Titulo } from '../../ui/base';

export default function C05MiListado() {
  const [listadoId, setListadoId] = useState<string | null>(null);

  const {
    data: lista,
    isLoading: cargandoLista,
    error: errorLista,
    refetch,
  } = useQuery({
    queryKey: ['mi-listados'],
    queryFn: api.miListados,
  });

  const idActivo = listadoId ?? lista?.items[0]?.id;

  const {
    data: detalle,
    isLoading: cargandoDetalle,
    error: errorDetalle,
  } = useQuery({
    queryKey: ['mi-listado', idActivo],
    queryFn: () => (idActivo ? api.miListado(idActivo) : Promise.resolve(null)),
    enabled: Boolean(idActivo),
  });

  if (cargandoLista) return <Cargando />;
  if (errorLista) return <PanelError error={errorLista} reintentar={() => void refetch()} />;

  if (!lista || lista.items.length === 0) {
    return (
      <div className="space-y-4">
        <Titulo>Mi listado de pago</Titulo>
        <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm border border-gray-100">
          Aún no tienes listados de pago emitidos por tu tienda.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Titulo>Mi listado de pago</Titulo>
        {lista.items.length > 1 && (
          <select
            aria-label="Elegir listado"
            value={idActivo ?? ''}
            onChange={(e) => setListadoId(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
          >
            {lista.items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.numero} ({formatearFecha(it.fechaCorte)})
              </option>
            ))}
          </select>
        )}
      </div>

      {cargandoDetalle && <Cargando />}
      {errorDetalle && <PanelError error={errorDetalle} />}

      {detalle && (
        <>
          {/* Cabecera del Listado */}
          <section className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider">Comprobante</span>
                <div className="font-mono text-base font-bold text-vecino-oscuro">
                  {detalle.numero}
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  detalle.estado === 'PAGADO'
                    ? 'bg-emerald-100 text-emerald-800'
                    : detalle.estadoEfectivo === 'VENCIDO'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {detalle.estado === 'PAGADO'
                  ? 'Pagado'
                  : detalle.estadoEfectivo === 'VENCIDO'
                    ? 'Vencido'
                    : 'Pendiente'}
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <span className="text-gray-400">Fecha de corte:</span>{' '}
                <span className="font-medium text-gray-800">
                  {formatearFecha(detalle.fechaCorte)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-gray-400">Fecha límite:</span>{' '}
                <span className="font-semibold text-vecino-primario">
                  {formatearFecha(detalle.fechaPago)}
                </span>
              </div>
            </div>
          </section>

          {/* Compras en formato de lista (2 líneas por compra) */}
          <section className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Compras incluidas en este ciclo
            </h2>

            <div className="divide-y divide-gray-100">
              {detalle.items.map((i) => (
                <div key={i.orden} className="py-2.5 first:pt-0 last:pb-0">
                  {/* Línea 1: Fecha y ticket a la izquierda, Total a la derecha */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-900">
                      {formatearFecha(i.fecha)}{' '}
                      <span className="font-mono text-gray-500">({i.ticket ?? '—'})</span>
                      {i.posteriorAlCorte && (
                        <span
                          className="ml-1 text-amber-600 font-bold"
                          title="Compra posterior a las 17:00"
                        >
                          *<span className="sr-only"> compra posterior a las 17:00</span>
                        </span>
                      )}
                    </span>
                    <span className="font-bold text-gray-900">
                      {formatearMonto(i.total, detalle.moneda)}
                    </span>
                  </div>

                  {/* Línea 2: Capital, interés y días que lo generaron */}
                  <div className="mt-0.5 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      Cap: {formatearMonto(i.capital, detalle.moneda)} + Int:{' '}
                      {formatearMonto(i.interes, detalle.moneda)} ({i.dias} d)
                      {i.tipo === 'CUOTA' && ` • Cuota #${i.cuotaNumero}`}
                      {i.tipo === 'MORA' && ` • Mora`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-gray-500">
              * Compra registrada después de las 17:00: cuenta desde el día siguiente.
            </p>

            {/* Total a pagar */}
            <div className="mt-4 border-t border-gray-200 pt-3">
              {detalle.moraALaFecha && detalle.estado !== 'PAGADO' && (
                <div className="mb-2 flex justify-between text-sm text-red-700">
                  <span>Interés moratorio ({detalle.moraALaFecha.diasMora} d)</span>
                  <span className="tabular-nums">
                    {formatearMonto(detalle.moraALaFecha.mora, detalle.moneda)}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-gray-800">Total a pagar</span>
                <span className="text-xl font-extrabold text-vecino-oscuro">
                  {formatearMonto(
                    detalle.moraALaFecha && detalle.estado !== 'PAGADO'
                      ? detalle.moraALaFecha.totalALaFecha
                      : detalle.total,
                    detalle.moneda,
                  )}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-gray-500">
                <span>Capital total: {formatearMonto(detalle.totalCapital, detalle.moneda)}</span>
                <span>Interés total: {formatearMonto(detalle.totalInteres, detalle.moneda)}</span>
              </div>
            </div>
          </section>

          {/* Franja verde de compras fuera de corte */}
          {detalle.comprasPosteriores && detalle.comprasPosteriores.length > 0 && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900">
              <span className="font-bold">Compras no incluidas en este listado:</span>
              <p className="mt-1 text-emerald-800">
                {detalle.comprasPosteriores.map((cp) => (
                  <span key={cp.ticket} className="block">
                    • Tu compra del {formatearFecha(cp.fechaHora.slice(0, 10))} a las{' '}
                    {cp.fechaHora.slice(11, 16)} ({formatearMonto(cp.monto, detalle.moneda)}) fue
                    después del corte. La pagarás el {formatearFecha(cp.fechaPago)}.
                  </span>
                ))}
              </p>
            </div>
          )}

          {/* Nota de advertencia de mora */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            <span className="font-semibold">Nota:</span> Pagar después de la fecha límite (
            {formatearFecha(detalle.fechaPago)}) genera intereses moratorios diarios según la tasa
            moratoria pactada.
          </div>

          {/* Dónde se paga */}
          <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
            <span className="font-semibold">¿Cómo pago?</span> El pago se hace en la tienda. Tu
            tienda lo registrará y lo verás en «Mis pagos».
          </div>
        </>
      )}
    </div>
  );
}
