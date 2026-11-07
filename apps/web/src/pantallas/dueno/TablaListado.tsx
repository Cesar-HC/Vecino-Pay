import type { ListadoDetalle } from '../../api/tipos';
import { formatearFecha, formatearFechaHora, formatearMonto } from '../../lib/formato';
import { Celda, Tabla } from '../../ui/base';

/** No depende del perfil: C05 la reutiliza. Los totales salen de la API, nunca de sumar filas. */
export function TablaListado({ listado: l }: { listado: ListadoDetalle }) {
  const m = (x: string) => formatearMonto(x, l.moneda);
  const conMora = l.totalMora !== '0.00';
  return (
    <Tabla
      columnas={[
        'Ticket',
        'Registro',
        'Fecha',
        'Detalle',
        'Días',
        'Capital',
        'Interés',
        ...(conMora ? ['Mora'] : []),
        'Total',
      ]}
      pie={
        <tr>
          <Celda colSpan={5}>Total a pagar</Celda>
          <Celda derecha>{m(l.totalCapital)}</Celda>
          <Celda derecha>{m(l.totalInteres)}</Celda>
          {conMora && <Celda derecha>{m(l.totalMora)}</Celda>}
          <Celda derecha>{m(l.total)}</Celda>
        </tr>
      }
    >
      {l.items.map((i) => (
        <tr key={i.orden}>
          <Celda>
            <span className="whitespace-nowrap">{i.ticket ?? '—'}</span>
            {i.posteriorAlCorte && (
              <span title="Registrada después de las 17:00: cuenta como del día siguiente.">
                {' '}
                *
              </span>
            )}
          </Celda>
          <Celda>{i.fechaHoraRegistro ? formatearFechaHora(i.fechaHoraRegistro) : '—'}</Celda>
          <Celda>{formatearFecha(i.fecha)}</Celda>
          <Celda>
            {i.tipo === 'MORA' && `Interés moratorio, ${i.dias} días`}
            {i.tipo === 'CUOTA' && <span className="font-medium">Cuota {i.cuotaNumero}. </span>}
            {i.detalle.map((d) => `${d.nombre} × ${d.cantidad}`).join(', ')}
          </Celda>
          <Celda derecha>{i.dias}</Celda>
          <Celda derecha>{m(i.capital)}</Celda>
          <Celda derecha>{m(i.interes)}</Celda>
          {conMora && <Celda derecha>{m(i.mora)}</Celda>}
          <Celda derecha>{m(i.total)}</Celda>
        </tr>
      ))}
    </Tabla>
  );
}
