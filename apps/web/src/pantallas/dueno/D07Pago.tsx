import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/api';
import { ErrorApi } from '../../api/cliente';
import { MONTO_DIGITADO } from '../../lib/entrada';
import { formatearFecha, formatearMonto, formatearTasa } from '../../lib/formato';
import { useSesion } from '../../sesion/Sesion';
import {
  Ayuda,
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

export function D07Lista() {
  const { sesion } = useSesion();
  const tienda = sesion?.tienda?.id;
  const listados = useQuery({ queryKey: ['listados', tienda, ''], queryFn: () => api.listados() });
  const clientes = useQuery({ queryKey: ['clientes', tienda, ''], queryFn: () => api.clientes() });
  if (listados.isLoading) return <Cargando />;
  if (listados.error) return <PanelError error={listados.error} reintentar={listados.refetch} />;
  const pendientes = listados.data?.items.filter((l) => l.estadoEfectivo !== 'PAGADO') ?? [];
  const cliente = (id: string) => clientes.data?.items.find((c) => c.id === id);
  return (
    <>
      <h1 className="text-2xl font-bold text-vecino-oscuro">Registrar pago</h1>
      <Tarjeta>
        {!pendientes.length && <Vacio texto="No hay listados por cobrar." />}
        {pendientes.length > 0 && (
          <Tabla columnas={['Número', 'Cliente', 'Fecha de pago', 'Total', 'Estado', '']}>
            {pendientes.map((l) => {
              const c = cliente(l.clienteId);
              return (
                <tr key={l.id}>
                  <Celda>{l.numero}</Celda>
                  <Celda>{c ? `${c.nombres} ${c.apellidos}` : '—'}</Celda>
                  <Celda>{formatearFecha(l.fechaPago)}</Celda>
                  <Celda derecha>{c ? formatearMonto(l.total, c.moneda) : '—'}</Celda>
                  <Celda>
                    <Insignia estado={l.estadoEfectivo} />
                  </Celda>
                  <Celda>
                    <Link
                      className="font-medium text-vecino-oscuro underline"
                      to={`/dueno/listados/${l.id}/pago`}
                    >
                      Registrar
                    </Link>
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

const MEDIOS = ['Efectivo', 'Yape', 'Plin', 'Transferencia'];

export function D07Pago() {
  const { id = '' } = useParams();
  const { sesion } = useSesion();
  const tienda = sesion?.tienda?.id;
  const consultas = useQueryClient();
  const enviando = useRef(false);
  const listado = useQuery({ queryKey: ['listado', tienda, id], queryFn: () => api.listado(id) });
  const pagado = listado.data?.estado === 'PAGADO';
  // La fecha y la hora son siempre las del servidor (decisión de Adrián): cambian solas al cruzar las 17:00.
  const liquidacion = useQuery({
    queryKey: ['liquidacion', tienda, id],
    queryFn: () => api.liquidacion(id),
    enabled: !!listado.data && !pagado,
    refetchInterval: 60000,
  });
  const cliente = useQuery({
    queryKey: ['cliente', tienda, listado.data?.clienteId],
    queryFn: () => api.cliente(listado.data?.clienteId as string),
    enabled: !!listado.data,
  });

  const [monto, setMonto] = useState('');
  const [tocado, setTocado] = useState(false);
  const [medio, setMedio] = useState('Efectivo');
  const [operacion, setOperacion] = useState('');
  const total = liquidacion.data?.totalALaFecha;
  useEffect(() => {
    if (total && !tocado) setMonto(total);
  }, [total, tocado]);

  const pagar = useMutation({
    mutationFn: () =>
      api.pagar(id, {
        montoPagado: monto,
        medioPago: medio,
        ...(operacion ? { numeroOperacion: operacion } : {}),
      }),
    // La liquidación no se vuelve a pedir: el listado ya está pagado y respondería 409.
    onSuccess: () =>
      consultas.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'liquidacion' }),
    // Ya pagado desde otra pestaña: la pantalla debe enterarse.
    onError: () => {
      liquidacion.refetch();
      listado.refetch();
    },
    onSettled: () => {
      enviando.current = false;
    },
  });

  if (listado.isLoading) return <Cargando />;
  if (listado.error || !listado.data)
    return <PanelError error={listado.error} reintentar={listado.refetch} />;
  const l = listado.data;
  const m = (x: string) => formatearMonto(x, l.moneda);
  const atras = (
    <Link to="/dueno/pagos" className="text-sm text-vecino-oscuro underline">
      ← Listados por cobrar
    </Link>
  );

  if (pagar.data) {
    const r = pagar.data;
    return (
      <>
        {atras}
        <h1 className="text-2xl font-bold text-vecino-oscuro">Pago registrado</h1>
        <Franja tipo="exito">
          Se registró el pago de {m(r.pago.monto)} del listado {r.listado.numero}.
        </Franja>
        <Tarjeta titulo="Recibo">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Dato etiqueta="Fecha y hora">
              {formatearFecha(r.pago.fecha)} {r.pago.hora}
            </Dato>
            <Dato etiqueta="Medio">{r.pago.medioPago}</Dato>
            <Dato etiqueta="N.° de operación">{r.pago.numeroOperacion ?? '—'}</Dato>
            <Dato etiqueta="Días de mora">{r.pago.diasMora}</Dato>
            <Dato etiqueta="Imputado a mora">{m(r.imputacion.mora)}</Dato>
            <Dato etiqueta="Imputado a interés">{m(r.imputacion.interes)}</Dato>
            <Dato etiqueta="Imputado a capital">{m(r.imputacion.capital)}</Dato>
            <Dato etiqueta="Disponible del cliente">{m(r.disponible)}</Dato>
          </dl>
        </Tarjeta>
        <Link className="text-sm text-vecino-oscuro underline" to={`/dueno/listados/${l.id}`}>
          Ver el listado
        </Link>
      </>
    );
  }

  if (pagado) {
    return (
      <>
        {atras}
        <Franja tipo="aviso">
          Este listado ya está pagado.{' '}
          <Link className="underline" to={`/dueno/listados/${l.id}`}>
            Ver el listado
          </Link>
        </Franja>
      </>
    );
  }

  const q = liquidacion.data;
  const montoValido = MONTO_DIGITADO.test(monto);
  const rechazo =
    pagar.error instanceof ErrorApi && pagar.error.codigo === 'PAGO_NO_EXACTO' ? pagar.error : null;
  const correcto = rechazo?.detalles.totalALaFecha as string | undefined;
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!montoValido || enviando.current) return;
    enviando.current = true;
    pagar.mutate();
  };

  return (
    <>
      {atras}
      <h1 className="text-2xl font-bold text-vecino-oscuro">Registrar pago · {l.numero}</h1>
      <p className="text-sm text-gray-600">
        {l.cliente} · fecha de pago {formatearFecha(l.fechaPago)}
      </p>
      {pagar.error && <Franja tipo="error">{mensajeError(pagar.error)}</Franja>}
      {liquidacion.error && (
        <PanelError error={liquidacion.error} reintentar={liquidacion.refetch} />
      )}
      {liquidacion.isLoading && <Cargando />}
      {q && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Tarjeta titulo="Datos del pago">
            <form onSubmit={enviar} noValidate className="space-y-3">
              <div>
                <p className="flex items-center text-sm font-medium text-gray-700">
                  Fecha y hora real de pago
                  <Ayuda texto="La toma el servidor y no se puede editar. Después de las 17:00, el pago cuenta como del día siguiente. Ejemplo: 26/09/2026 17:30 cuenta como del 27/09/2026." />
                </p>
                <p className="tabular-nums">
                  {formatearFecha(q.fechaReal)} {q.horaReal}
                </p>
                {q.fechaOperativaPago !== q.fechaReal && (
                  <p className="text-xs text-amber-800">
                    Después de las 17:00: cuenta como del {formatearFecha(q.fechaOperativaPago)}.
                  </p>
                )}
              </div>
              <Campo
                etiqueta="Monto pagado"
                ayuda="Debe ser el total exacto a la fecha: no se aceptan pagos parciales ni mayores."
                error={
                  !monto
                    ? 'Escribe el monto pagado.'
                    : !montoValido
                      ? 'El monto admite hasta 2 decimales.'
                      : correcto
                        ? `Monto correcto: ${m(correcto)}`
                        : undefined
                }
              >
                {(cid) => (
                  <input
                    id={cid}
                    inputMode="decimal"
                    className={`${claseEntrada} ${rechazo ? 'border-red-600' : ''}`}
                    value={monto}
                    onChange={(e) => {
                      setTocado(true);
                      pagar.reset();
                      setMonto(e.target.value);
                    }}
                  />
                )}
              </Campo>
              <Campo
                etiqueta="Medio de pago"
                ayuda="Cómo pagó el cliente: Efectivo, Yape, Plin o Transferencia."
              >
                {(cid) => (
                  <select
                    id={cid}
                    className={claseEntrada}
                    value={medio}
                    onChange={(e) => setMedio(e.target.value)}
                  >
                    {MEDIOS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo
                etiqueta="Número de operación"
                ayuda="Opcional. El código de Yape, Plin o la transferencia, hasta 30 caracteres."
              >
                {(cid) => (
                  <input
                    id={cid}
                    maxLength={30}
                    className={claseEntrada}
                    value={operacion}
                    onChange={(e) => setOperacion(e.target.value)}
                  />
                )}
              </Campo>
              {/* Nunca se bloquea por el monto: el rechazo debe quedar en la auditoría. */}
              <Boton type="submit" disabled={pagar.isPending || !montoValido} className="w-full">
                Registrar pago
              </Boton>
            </form>
          </Tarjeta>
          <div className="space-y-4">
            <Tarjeta titulo="Total a la fecha">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Dato
                  etiqueta="Total del listado"
                  ayuda="Lo que debía pagarse en la fecha de pago, sin mora. Ejemplo: S/ 228.42."
                >
                  {m(l.total)}
                </Dato>
                <Dato
                  etiqueta="Días de mora"
                  ayuda="Días exactos desde la fecha de pago hasta hoy. Ejemplo: del 26/09 al 01/10 son 5."
                >
                  {q.diasMora}
                </Dato>
                <Dato
                  etiqueta="Mora"
                  ayuda="Se cobra por cada día de atraso sobre el total que debió pagarse. Ejemplo: S/ 0.30 por 5 días."
                >
                  {m(q.mora)}
                </Dato>
                <Dato
                  etiqueta="Total a pagar"
                  ayuda="Total del listado más la mora. Solo se acepta este monto exacto. Ejemplo: S/ 228.72."
                >
                  <span className="text-lg font-bold text-vecino-oscuro">{m(q.totalALaFecha)}</span>
                </Dato>
              </dl>
              {q.diasMora > 0 && cliente.data && (
                <p className="mt-2 text-xs text-gray-600">
                  Mora = {m(l.total)} × [(1 + {formatearTasa(cliente.data.tedMora)})
                  <sup>{q.diasMora}</sup> − 1] = {m(q.mora)}
                </p>
              )}
            </Tarjeta>
            <Tarjeta titulo="Imputación del pago">
              <p className="mb-2 flex items-center text-xs text-gray-600">
                Orden de prelación
                <Ayuda texto="El pago se aplica primero a la mora, luego al interés y al final al capital. Ejemplo: 0.30, 4.80 y 223.62." />
              </p>
              <Tabla
                columnas={['Orden', 'Concepto', 'Monto']}
                pie={
                  <tr>
                    <Celda colSpan={2}>Total</Celda>
                    <Celda derecha>{m(q.totalALaFecha)}</Celda>
                  </tr>
                }
              >
                <tr>
                  <Celda>1</Celda>
                  <Celda>Interés moratorio</Celda>
                  <Celda derecha>{m(q.imputacion.mora)}</Celda>
                </tr>
                <tr>
                  <Celda>2</Celda>
                  <Celda>Interés compensatorio</Celda>
                  <Celda derecha>{m(q.imputacion.interes)}</Celda>
                </tr>
                <tr>
                  <Celda>3</Celda>
                  <Celda>Capital</Celda>
                  <Celda derecha>{m(q.imputacion.capital)}</Celda>
                </tr>
              </Tabla>
              <p className="mt-2 text-sm text-gray-700">
                Disponible después del pago:{' '}
                <span className="font-semibold tabular-nums">{m(q.disponibleDespues)}</span>
              </p>
            </Tarjeta>
          </div>
        </div>
      )}
    </>
  );
}
