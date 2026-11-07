import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/api';
import type { Moneda, ResumenMoneda } from '../../api/tipos';
import { formatearFecha, formatearMonto, formatearPorcentajeApi } from '../../lib/formato';
import { esMayor } from '../../lib/entrada';
import { aValorGrafico } from '../../lib/grafico';
import { useSesion } from '../../sesion/Sesion';
import { BarraUso, Cargando, Celda, Kpi, PanelError, Tabla, Tarjeta, Vacio } from '../../ui/base';
import { GraficoBarras, GraficoCirculo } from '../../ui/Graficos';

const MODALIDAD: Record<string, string> = { FIN_MES: 'Fin de mes', CUOTAS: 'En cuotas' };

function Bloque({ moneda, r, multiple }: { moneda: Moneda; r: ResumenMoneda; multiple: boolean }) {
  const m = (x: string) => formatearMonto(x, moneda);
  // La semana con más ventas se destaca.
  const mayorSemana = r.ventasPorSemana.reduce<{ semana: string; monto: string } | null>(
    (a, b) => (!a || esMayor(b.monto, a.monto) ? b : a),
    null,
  );
  return (
    <>
      {multiple && (
        <h2 className="text-lg font-semibold text-vecino-oscuro">
          {moneda === 'USD' ? 'En dólares' : 'En soles'}
        </h2>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          titulo="Capital por cobrar"
          valor={m(r.capitalPorCobrar)}
          ayuda="Suma del capital pendiente de todos tus clientes, sin intereses."
        />
        <Kpi
          titulo="Próxima fecha de pago"
          valor={r.cobroProximo ? m(r.cobroProximo.total) : '—'}
          detalle={r.cobroProximo ? formatearFecha(r.cobroProximo.fecha) : 'Sin cobros por venir'}
          ayuda="Lo que se cobrará en la próxima fecha de pago."
        />
        <Kpi
          titulo="Intereses del ciclo"
          valor={m(r.interesesDelCiclo)}
          ayuda="Interés de los listados del último corte."
        />
        <Kpi
          titulo="Cartera en mora"
          valor={m(r.carteraEnMora)}
          ayuda="Total de los listados vencidos y sin pagar."
        />
        <Kpi
          titulo="VAN acumulado"
          valor={m(r.vanAcumulado)}
          ayuda="Lo que gana la tienda con sus ventas en cuotas frente a cobrar al contado, con su COK."
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Ventas por semana" className="lg:col-span-2">
          <GraficoBarras
            destacar={mayorSemana ? formatearFecha(mayorSemana.semana).slice(0, 5) : undefined}
            datos={r.ventasPorSemana.map((s) => ({
              nombre: formatearFecha(s.semana).slice(0, 5),
              valor: aValorGrafico(s.monto),
              etiqueta: m(s.monto),
            }))}
          />
        </Tarjeta>
        <Tarjeta titulo="Ventas por modalidad">
          <GraficoCirculo
            datos={r.ventasPorModalidad.map((x) => ({
              nombre: MODALIDAD[x.modalidad] ?? x.modalidad,
              valor: aValorGrafico(x.monto),
              etiqueta: m(x.monto),
            }))}
          />
        </Tarjeta>
        <Tarjeta titulo="Cobros por fecha de pago" className="lg:col-span-2">
          <GraficoBarras
            datos={r.cobrosPorFecha.map((c) => ({
              nombre: formatearFecha(c.fecha).slice(0, 5),
              valor: aValorGrafico(c.total),
              etiqueta: m(c.total),
            }))}
          />
          <ul className="mt-2 grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">
            {r.cobrosPorFecha.map((c) => (
              <li key={c.fecha}>
                <span className="text-gray-500">{formatearFecha(c.fecha)}:</span>{' '}
                <span className="font-medium tabular-nums">{m(c.total)}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Uso del límite">
          <ul className="space-y-3">
            {r.usoLimite.map((u) => (
              <li key={u.cliente} className="text-sm">
                <div className="mb-1 flex justify-between gap-2">
                  <span className="font-medium">{u.cliente}</span>
                  <span className="tabular-nums">{formatearPorcentajeApi(u.usoPorcentaje)}</span>
                </div>
                <BarraUso actual={u.usoPorcentaje} />
                <p className="mt-1 text-xs text-gray-500">
                  {m(u.su)} de {m(u.limite)}
                </p>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
      <Tarjeta titulo="Productos más vendidos">
        <Tabla columnas={['Código', 'Producto', 'Cantidad', 'Ventas']}>
          {r.productosMasVendidos.map((p) => (
            <tr key={p.codigo}>
              <Celda>{p.codigo}</Celda>
              <Celda>{p.nombre}</Celda>
              <Celda derecha>{p.cantidad}</Celda>
              <Celda derecha>{m(p.subtotal)}</Celda>
            </tr>
          ))}
        </Tabla>
      </Tarjeta>
    </>
  );
}

export default function D01Resumen() {
  const { sesion } = useSesion();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['negocio', sesion?.tienda?.id],
    queryFn: api.resumenNegocio,
  });
  if (isLoading) return <Cargando />;
  if (error || !data) return <PanelError error={error} reintentar={refetch} />;
  const monedas = Object.keys(data.porMoneda) as Moneda[];
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-vecino-oscuro">Resumen del negocio</h1>
        <p className="text-sm text-gray-500">Al {formatearFecha(data.fecha)}</p>
      </div>
      {!monedas.length && (
        <Tarjeta>
          <Vacio texto="Aún no tienes clientes." />
        </Tarjeta>
      )}
      {monedas.map((moneda) => (
        <Bloque
          key={moneda}
          moneda={moneda}
          r={data.porMoneda[moneda] as ResumenMoneda}
          multiple={monedas.length > 1}
        />
      ))}
    </>
  );
}
