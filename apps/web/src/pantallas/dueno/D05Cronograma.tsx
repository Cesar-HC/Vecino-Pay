import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/api';
import type { Cronograma, Moneda } from '../../api/tipos';
import {
  formatearFecha,
  formatearFechaHora,
  formatearMonto,
  formatearPorcentajeApi,
  formatearTasa,
} from '../../lib/formato';
import { useSesion } from '../../sesion/Sesion';
import {
  Ayuda,
  Cargando,
  Celda,
  Dato,
  Franja,
  Insignia,
  PanelError,
  Tabla,
  Tarjeta,
  Vacio,
} from '../../ui/base';

/** El total sale de la API: las filas redondeadas suman 269.80 y el total correcto es 269.81 (T20). */
export function FlujoCaja({ flujo, moneda }: { flujo: Cronograma['flujoCaja']; moneda: Moneda }) {
  const m = (x: string) => formatearMonto(x, moneda);
  return (
    <>
      <p className="mb-2 text-sm text-gray-600">
        Valor actual al COK de la tienda: {formatearTasa(flujo.cokTea, 2)} TEA.
        <Ayuda texto="Cada cuota traída al día de la compra con el COK: cuota / (1 + TEDcok)^t. Ejemplo: 93.25 en el día 41 vale 91.33." />
      </p>
      <Tabla
        columnas={['Momento', 'Día', 'Flujo', 'Valor actual']}
        pie={
          <>
            <tr>
              <Celda colSpan={3}>Suma de los valores actuales de las cuotas</Celda>
              <Celda derecha>{m(flujo.sumaValorActual)}</Celda>
            </tr>
            <tr>
              <Celda colSpan={3}>VAN</Celda>
              <Celda derecha>{m(flujo.van)}</Celda>
            </tr>
          </>
        }
      >
        {flujo.filas.map((f) => (
          <tr key={f.momento}>
            <Celda>{f.momento === 0 ? 'Entrega al contado' : `Cuota ${f.momento}`}</Celda>
            <Celda derecha>{f.t}</Celda>
            <Celda derecha>{m(f.flujo)}</Celda>
            <Celda derecha>{m(f.valorActual)}</Celda>
          </tr>
        ))}
      </Tabla>
      <p className="mt-2 text-xs text-gray-500">
        La suma se acumula sin redondear y se redondea al final; por eso puede diferir en un céntimo
        de sumar las filas.
      </p>
    </>
  );
}

export function D05Lista() {
  const { sesion } = useSesion();
  const tienda = sesion?.tienda?.id;
  const compras = useQuery({
    queryKey: ['compras', tienda, 'CUOTAS'],
    queryFn: () => api.compras({ modalidad: 'CUOTAS' }),
  });
  const clientes = useQuery({ queryKey: ['clientes', tienda, ''], queryFn: () => api.clientes() });
  if (compras.isLoading) return <Cargando />;
  if (compras.error) return <PanelError error={compras.error} reintentar={compras.refetch} />;
  const cliente = (id: string) => clientes.data?.items.find((c) => c.id === id);
  return (
    <>
      <h1 className="text-2xl font-bold text-vecino-oscuro">Cronogramas</h1>
      <Tarjeta>
        {!compras.data?.items.length && <Vacio texto="Aún no hay compras en cuotas." />}
        {!!compras.data?.items.length && (
          <Tabla
            columnas={['Ticket', 'Cliente', 'Fecha', 'Monto', 'Cuotas', 'Cuota', 'TCEA', 'Estado']}
          >
            {compras.data.items.map((c) => {
              const dueno = cliente(c.clienteId);
              return (
                <tr key={c.id}>
                  <Celda>
                    <Link
                      className="font-medium text-vecino-oscuro underline"
                      to={`/dueno/cronogramas/${c.id}`}
                    >
                      {c.ticket}
                    </Link>
                  </Celda>
                  <Celda>{dueno ? `${dueno.nombres} ${dueno.apellidos}` : '—'}</Celda>
                  <Celda>{formatearFechaHora(c.fechaHora)}</Celda>
                  <Celda derecha>{dueno ? formatearMonto(c.montoLista, dueno.moneda) : '—'}</Celda>
                  <Celda derecha>{c.numCuotas}</Celda>
                  <Celda derecha>
                    {c.cuotaFija && dueno ? formatearMonto(c.cuotaFija, dueno.moneda) : '—'}
                  </Celda>
                  <Celda derecha>
                    {c.tceaPorcentaje ? formatearPorcentajeApi(c.tceaPorcentaje) : '—'}
                  </Celda>
                  <Celda>
                    <Insignia estado={c.estado} />
                  </Celda>
                </tr>
              );
            })}
          </Tabla>
        )}
      </Tarjeta>
    </>
  );
}

export function D05Detalle() {
  const { compraId = '' } = useParams();
  const { sesion } = useSesion();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['cronograma', sesion?.tienda?.id, compraId],
    queryFn: () => api.cronograma(compraId),
  });
  if (isLoading) return <Cargando />;
  if (error || !data) return <PanelError error={error} reintentar={refetch} />;
  const moneda = data.compra.moneda;
  const m = (x: string) => formatearMonto(x, moneda);
  return (
    <>
      <div>
        <Link to="/dueno/cronogramas" className="text-sm text-vecino-oscuro underline">
          ← Cronogramas
        </Link>
        <h1 className="text-2xl font-bold text-vecino-oscuro">Cronograma {data.compra.ticket}</h1>
        <p className="text-sm text-gray-500">
          {data.compra.cliente} · {formatearFechaHora(data.compra.fechaHora)} · pago del ciclo{' '}
          {formatearFecha(data.compra.fechaPago)}
        </p>
      </div>
      <Tarjeta titulo="Resumen">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Dato
            etiqueta="Monto del crédito"
            ayuda="Lo que el cliente compró, a precio de lista. Ejemplo: S/ 257.80."
          >
            {m(data.resumen.montoCredito)}
          </Dato>
          <Dato
            etiqueta="Días de gracia"
            ayuda="Días desde la compra hasta la fecha de pago del ciclo, sin pagos pero con interés. Ejemplo: 11."
          >
            {data.resumen.diasGracia}
          </Dato>
          <Dato
            etiqueta="Interés de gracia"
            ayuda="Lo que suman los días de gracia a la deuda. Ejemplo: S/ 3.27."
          >
            {m(data.resumen.interesGracia)}
          </Dato>
          <Dato
            etiqueta="Interés de las cuotas"
            ayuda="Suma del interés de todas las cuotas. Ejemplo: S/ 18.69."
          >
            {m(data.resumen.interesCuotas)}
          </Dato>
          <Dato
            etiqueta="Intereses totales"
            ayuda="Interés de gracia más interés de las cuotas. Ejemplo: S/ 21.96."
          >
            {m(data.resumen.interesesTotales)}
          </Dato>
          <Dato
            etiqueta="Cuota fija"
            ayuda="Lo que se paga cada mes; la última se ajusta. Ejemplo: S/ 93.25."
          >
            {m(data.resumen.cuotaFija)}
          </Dato>
          <Dato etiqueta="TCEA" ayuda="Costo anual real para el cliente. Ejemplo: 51.09 %.">
            {formatearPorcentajeApi(data.resumen.tceaPorcentaje)}
          </Dato>
          <Dato
            etiqueta="TIR diaria"
            ayuda="Tasa diaria que iguala las cuotas con el monto del crédito. Ejemplo: 0.0011469966."
          >
            {data.resumen.tirDiaria}
          </Dato>
        </dl>
      </Tarjeta>
      <Tarjeta titulo="Cronograma">
        <Tabla
          columnas={[
            'Cuota',
            'Vence',
            'Días',
            'Saldo inicial',
            'Interés',
            'Amortización',
            'Cuota',
            'Saldo final',
            'Estado',
          ]}
          pie={
            <tr>
              <Celda colSpan={4}>Totales</Celda>
              <Celda derecha>{m(data.totales.interes)}</Celda>
              <Celda derecha>{m(data.totales.amortizacion)}</Celda>
              <Celda derecha>{m(data.totales.monto)}</Celda>
              <Celda colSpan={2} />
            </tr>
          }
        >
          {data.filas.map((f) => (
            <tr key={f.numero}>
              <Celda>{f.numero}</Celda>
              <Celda>{formatearFecha(f.vence)}</Celda>
              <Celda derecha>{f.diasPeriodo}</Celda>
              <Celda derecha>{m(f.saldoInicial)}</Celda>
              <Celda derecha>{m(f.interes)}</Celda>
              <Celda derecha>{m(f.amortizacion)}</Celda>
              <Celda derecha>{m(f.monto)}</Celda>
              <Celda derecha>{m(f.saldoFinal)}</Celda>
              <Celda>{f.estado && <Insignia estado={f.estado} />}</Celda>
            </tr>
          ))}
        </Tabla>
        <p className="mt-2 text-xs text-gray-500">
          Interés = Red(saldo inicial × [(1 + TED)^días − 1]), con los días reales del período.
          Amortización = cuota − interés. Saldo final = saldo inicial − amortización. La última
          cuota es el saldo más su interés, para que el saldo final sea cero.
        </p>
      </Tarjeta>
      <Tarjeta titulo="Flujo de caja de la tienda">
        {!data.flujoCaja.cokVigenteCoincide && (
          <div className="mb-2">
            <Franja tipo="aviso">
              El COK de la tienda cambió después de esta venta. La TCEA y el VAN son los guardados.
            </Franja>
          </div>
        )}
        <FlujoCaja flujo={data.flujoCaja} moneda={moneda} />
      </Tarjeta>
    </>
  );
}
