import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/api';
import { esMayor } from '../../lib/entrada';
import {
  tasaConEtiqueta,
  formatearFecha,
  formatearMonto,
  formatearPorcentajeApi,
} from '../../lib/formato';
import { aValorGrafico } from '../../lib/grafico';
import { BarraUso, Cargando, Dato, Franja, PanelError, Tarjeta, Titulo } from '../../ui/base';
import { GraficoBarras } from '../../ui/Graficos';

function textoDias(dias: number): string {
  if (dias < 0) return `${-dias} d de atraso`;
  if (dias === 0) return 'Vence hoy';
  return `Faltan ${dias} d`;
}

/** C03: lo que el cliente debe, cuándo y cuánto crédito le queda. Nunca muestra VAN ni COK (RF09). */
export default function C03InicioCliente() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mi-resumen'],
    queryFn: api.miResumen,
  });

  if (isLoading) return <Cargando />;
  if (error || !data) return <PanelError error={error} reintentar={() => void refetch()} />;

  const p = data.proximoPago;
  const c = data.credito;
  const m = (x: string) => formatearMonto(x, data.moneda);

  return (
    <div className="space-y-4">
      <Titulo>Mi cuenta</Titulo>

      <Tarjeta>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">
              {p?.proyectado ? 'Próximo pago estimado' : 'Total a pagar'}
            </p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-vecino-oscuro">
              {p ? m(p.totalALaFecha) : m('0.00')}
            </p>
          </div>
          {p && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                p.diasRestantes < 0
                  ? 'bg-red-100 text-red-800'
                  : p.diasRestantes === 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-green-100 text-green-800'
              }`}
            >
              {textoDias(p.diasRestantes)}
            </span>
          )}
        </div>
        {p ? (
          <dl className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-sm">
            <Dato etiqueta="Fecha de pago">{formatearFecha(p.fecha)}</Dato>
            <Dato etiqueta="Capital">{m(p.capital)}</Dato>
            <Dato etiqueta="Interés compensatorio">{m(p.interes)}</Dato>
            {esMayor(p.mora, '0') && <Dato etiqueta="Interés moratorio">{m(p.mora)}</Dato>}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-gray-500">No tienes pagos pendientes en este ciclo.</p>
        )}
      </Tarjeta>

      <Tarjeta>
        <p className="flex justify-between text-xs text-gray-500">
          <span>Crédito disponible</span>
          <span>Límite: {m(c.limite)}</span>
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-vecino">{m(c.disponible)}</p>
        <div className="mt-2">
          <BarraUso actual={c.usoPorcentaje} />
        </div>
        <p className="mt-2 flex justify-between text-xs text-gray-500">
          <span>Usado: {m(c.usado)}</span>
          <span>{formatearPorcentajeApi(c.usoPorcentaje)} del límite</span>
        </p>
      </Tarjeta>

      {data.comprasPorSemana.length > 0 && (
        <Tarjeta titulo="Mis compras por semana">
          <GraficoBarras
            datos={data.comprasPorSemana.map((s) => ({
              nombre: formatearFecha(s.semana).slice(0, 5),
              valor: aValorGrafico(s.monto),
              etiqueta: m(s.monto),
            }))}
          />
        </Tarjeta>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Tarjeta>
          <p className="text-xs text-gray-500">Compras del ciclo</p>
          <p className="mt-1 text-xl font-bold">{data.comprasDelCiclo}</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-xs text-gray-500">Tasa pactada</p>
          <p className="mt-1 text-base font-bold">
            {tasaConEtiqueta(
              data.tasa.tipo,
              data.tasa.valor,
              data.tasa.plazo,
              data.tasa.capitalizacion,
            )}
          </p>
        </Tarjeta>
      </div>

      {p?.proyectado && (
        <Franja tipo="aviso">
          El monto es una estimación: se confirma en el próximo corte, a las 17:00.
        </Franja>
      )}
    </div>
  );
}
