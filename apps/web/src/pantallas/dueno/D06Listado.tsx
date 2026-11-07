import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/api';
import type { ListadoDetalle } from '../../api/tipos';
import {
  tasaConEtiqueta,
  formatearFecha,
  formatearFechaHora,
  formatearMonto,
  formatearTasa,
  formatearTasaResumida,
} from '../../lib/formato';
import { enlaceWhatsApp, mensajeListado } from '../../lib/whatsapp';
import { useSesion } from '../../sesion/Sesion';
import {
  Boton,
  Campo,
  Cargando,
  Celda,
  claseEntrada,
  Dato,
  Franja,
  Insignia,
  mensajeError,
  PanelError,
  Tabla,
  Tarjeta,
  Vacio,
} from '../../ui/base';
import { TablaListado } from './TablaListado';

export function D06Lista() {
  const { sesion } = useSesion();
  const tienda = sesion?.tienda?.id;
  const [clienteId, setClienteId] = useState('');
  const [estado, setEstado] = useState('');
  const listados = useQuery({
    queryKey: ['listados', tienda, clienteId],
    queryFn: () => api.listados({ clienteId }),
  });
  const clientes = useQuery({ queryKey: ['clientes', tienda, ''], queryFn: () => api.clientes() });
  const cliente = (id: string) => clientes.data?.items.find((c) => c.id === id);
  // Sobre el estado efectivo: con el reloj de la demo, un listado vencido sigue EMITIDO en la columna.
  const filas = listados.data?.items.filter((l) => !estado || l.estadoEfectivo === estado) ?? [];
  return (
    <>
      <h1 className="text-2xl font-bold text-vecino-oscuro">Listados de pago</h1>
      <Tarjeta>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <select
            aria-label="Filtrar por cliente"
            className={claseEntrada}
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Todos los clientes</option>
            {clientes.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombres} {c.apellidos}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por estado"
            className={claseEntrada}
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {['EMITIDO', 'VENCIDO', 'PAGADO'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        {listados.isLoading && <Cargando />}
        {listados.error && <PanelError error={listados.error} reintentar={listados.refetch} />}
        {listados.data && !filas.length && <Vacio texto="No hay listados con ese criterio." />}
        {filas.length > 0 && (
          <Tabla columnas={['Número', 'Cliente', 'Corte', 'Pago', 'Total', 'Estado']}>
            {filas.map((l) => {
              const c = cliente(l.clienteId);
              return (
                <tr key={l.id}>
                  <Celda>
                    <Link
                      className="font-medium text-vecino-oscuro underline"
                      to={`/dueno/listados/${l.id}`}
                    >
                      {l.numero}
                    </Link>
                  </Celda>
                  <Celda>{c ? `${c.nombres} ${c.apellidos}` : '—'}</Celda>
                  <Celda>{formatearFecha(l.fechaCorte)}</Celda>
                  <Celda>{formatearFecha(l.fechaPago)}</Celda>
                  <Celda derecha>{c ? formatearMonto(l.total, c.moneda) : '—'}</Celda>
                  <Celda>
                    <Insignia estado={l.estadoEfectivo} />
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

/** Solo si no está pagado. T8, T14 y T17: cuánto valdría pagar antes de la fecha de pago. */
function ValorDeHoy({ listado: l }: { listado: ListadoDetalle }) {
  const [fecha, setFecha] = useState('');
  const { data, error } = useQuery({
    queryKey: ['valor-hoy', l.id, fecha],
    queryFn: () => api.valorHoy(l.id, fecha || undefined),
  });
  const m = (x: string) => formatearMonto(x, l.moneda);
  return (
    <Tarjeta titulo="Valor de hoy de esta cobranza">
      <p className="mb-3 text-sm text-gray-600">
        Lo que vale hoy para la tienda el total que cobrará en la fecha de pago. Te sirve si
        necesitas liquidez. No cambia lo que debe el cliente: el listado se paga completo.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo
          etiqueta="Fecha"
          ayuda="La fecha a la que quieres valorar la cobranza, no posterior a la fecha de pago. Por defecto, hoy. Ejemplo: 16/09/2026."
        >
          {(id) => (
            <input
              id={id}
              type="date"
              className={claseEntrada}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          )}
        </Campo>
      </div>
      {error && (
        <div className="mt-2">
          <Franja tipo="error">{mensajeError(error)}</Franja>
        </div>
      )}
      {data && (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Dato etiqueta="Días hasta la fecha de pago">{data.td}</Dato>
          <Dato etiqueta="Tasa descontada (d)">{formatearTasa(data.d)}</Dato>
          <Dato etiqueta="Descuento">{m(data.descuento)}</Dato>
          <Dato etiqueta="Valor neto">{m(data.neto)}</Dato>
        </dl>
      )}
    </Tarjeta>
  );
}

function descargarPdf(numero: string) {
  const titulo = document.title;
  document.title = numero;
  window.print();
  document.title = titulo;
}

export function D06Detalle() {
  const { id = '' } = useParams();
  const { sesion } = useSesion();
  const tienda = sesion?.tienda?.id;
  const {
    data: l,
    error,
    isLoading,
    refetch,
  } = useQuery({ queryKey: ['listado', tienda, id], queryFn: () => api.listado(id) });
  const cliente = useQuery({
    queryKey: ['cliente', tienda, l?.clienteId],
    queryFn: () => api.cliente(l?.clienteId as string),
    enabled: !!l,
  });
  if (isLoading) return <Cargando />;
  if (error || !l) return <PanelError error={error} reintentar={refetch} />;
  const m = (x: string) => formatearMonto(x, l.moneda);
  const c = cliente.data;
  const enlace = enlaceWhatsApp(
    c?.celular,
    mensajeListado(sesion?.tienda?.nombreComercial ?? 'VecinoPay', l),
  );
  const hayPosterior = l.items.some((i) => i.posteriorAlCorte);
  const primera = l.items.find((i) => i.tipo === 'COMPRA');
  return (
    <div className="space-y-4">
      <div data-sin-imprimir>
        <Link to="/dueno/listados" className="text-sm text-vecino-oscuro underline">
          ← Listados
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-vecino-oscuro">Listado {l.numero}</h1>
        <div data-sin-imprimir className="flex flex-wrap gap-2">
          <Boton variante="secundario" onClick={() => descargarPdf(l.numero)}>
            Descargar PDF
          </Boton>
          {enlace ? (
            <a
              className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold hover:bg-gray-50"
              href={enlace}
              target="_blank"
              rel="noopener noreferrer"
            >
              Enviar por WhatsApp
            </a>
          ) : (
            <Boton variante="secundario" disabled title="Este cliente no tiene celular registrado.">
              Enviar por WhatsApp
            </Boton>
          )}
          {l.estado !== 'PAGADO' && (
            <Link
              className="inline-flex min-h-10 items-center rounded-lg bg-vecino px-4 text-sm font-semibold text-white"
              to={`/dueno/listados/${l.id}/pago`}
            >
              Registrar pago
            </Link>
          )}
        </div>
      </div>
      <Tarjeta>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Dato etiqueta="Cliente">{l.cliente}</Dato>
          <Dato etiqueta="Corte">
            {formatearFecha(l.fechaCorte)} {l.horaCorte}
          </Dato>
          <Dato etiqueta="Fecha de pago">{formatearFecha(l.fechaPago)}</Dato>
          <Dato etiqueta="Estado">
            <Insignia estado={l.estadoEfectivo} />
          </Dato>
          {c && (
            <Dato etiqueta="Tasa">
              {tasaConEtiqueta(c.tipoTasa, c.valorTasa, c.plazoTasa, c.capitalizacion)}
            </Dato>
          )}
          {l.fechaPagoReal && <Dato etiqueta="Pagado el">{formatearFecha(l.fechaPagoReal)}</Dato>}
        </dl>
      </Tarjeta>
      <Tarjeta>
        <TablaListado listado={l} />
        {hayPosterior && (
          <p className="mt-2 text-xs text-gray-500">
            * Registrada después de las 17:00: cuenta como del día siguiente.
          </p>
        )}
      </Tarjeta>
      {l.comprasPosteriores.map((p) => (
        <Franja key={p.ticket} tipo="exito">
          La compra {p.ticket} del {formatearFechaHora(p.fechaHora)} por {m(p.monto)} no está en
          este listado: se hizo después del corte, cuenta como del{' '}
          {formatearFecha(p.fechaOperativa)} y se paga el {formatearFecha(p.fechaPago)}.
        </Franja>
      ))}
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Si se paga con atraso">
          <p className="text-sm text-gray-700">
            Por cada día de atraso se agrega interés moratorio sobre el total: Mora = Total × [(1 +
            TED<sub>m</sub>)<sup>días</sup> − 1].
            {c && (
              <>
                {' '}
                Tasa moratoria {formatearTasaResumida(c.valorTasaMora)}; TED<sub>m</sub>{' '}
                {formatearTasa(c.tedMora)}.
              </>
            )}
          </p>
          {l.moraALaFecha && l.moraALaFecha.diasMora > 0 && (
            <div className="mt-2">
              <Franja tipo="aviso">
                A la fecha: {l.moraALaFecha.diasMora} días de atraso, mora {m(l.moraALaFecha.mora)},
                total {m(l.moraALaFecha.totalALaFecha)}.
              </Franja>
            </div>
          )}
        </Tarjeta>
        <Tarjeta titulo="Cómo se calcula">
          <p className="text-sm text-gray-700">
            Interés de cada compra = Capital × [(1 + TED)<sup>días</sup> − 1], con los días exactos
            desde la fecha operativa hasta la fecha de pago, redondeado compra por compra.
          </p>
          {primera && c && (
            <p className="mt-2 text-sm text-gray-700">
              {primera.ticket}: {m(primera.capital)} × [(1 + {formatearTasa(c.ted)})
              <sup>{primera.dias}</sup> − 1] = {m(primera.interes)}
            </p>
          )}
        </Tarjeta>
      </div>
      {l.estado !== 'PAGADO' && (
        <div data-sin-imprimir>
          <ValorDeHoy listado={l} />
        </div>
      )}
    </div>
  );
}
