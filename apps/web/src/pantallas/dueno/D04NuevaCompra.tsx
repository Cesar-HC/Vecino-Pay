import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/api';
import { ErrorApi } from '../../api/cliente';
import type { CompraEntrada } from '../../api/tipos';
import { T12 } from '../../contenido/ayudas';
import { aEntero, CANTIDAD_DIGITADA, mayorQueCero } from '../../lib/entrada';
import {
  formatearFecha,
  formatearMonto,
  formatearPorcentajeApi,
  formatearTasa,
} from '../../lib/formato';
import { useSesion } from '../../sesion/Sesion';
import {
  Ayuda,
  BarraUso,
  Boton,
  Campo,
  Cargando,
  Celda,
  claseEntrada,
  Dato,
  Franja,
  mensajeError,
  PanelError,
  Tabla,
  Tarjeta,
  Vacio,
} from '../../ui/base';
import { useEspera } from '../../ui/useEspera';

interface Linea {
  clave: number;
  productoId: string;
  cantidad: string;
}

const cantidadValida = (c: string) => CANTIDAD_DIGITADA.test(c) && mayorQueCero(c);
let siguienteClave = 1;
const lineaVacia = (): Linea => ({ clave: siguienteClave++, productoId: '', cantidad: '1' });

export default function D04NuevaCompra() {
  const { sesion } = useSesion();
  const navegar = useNavigate();
  const consultas = useQueryClient();
  const tienda = sesion?.tienda?.id;
  const [clienteId, setClienteId] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([lineaVacia()]);
  const [modalidad, setModalidad] = useState<'FIN_MES' | 'CUOTAS'>('FIN_MES');
  const [numCuotas, setNumCuotas] = useState<number | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const clientes = useQuery({
    queryKey: ['clientes', tienda, 'activos'],
    queryFn: () => api.clientes({ estado: 'ACTIVO' }),
  });
  const productos = useQuery({
    queryKey: ['productos', tienda, 'activos'],
    queryFn: () => api.productos({ estado: 'ACTIVO' }),
  });
  const cliente = clientes.data?.items.find((c) => c.id === clienteId);
  const moneda = cliente?.moneda ?? 'PEN';
  const m = (x: string) => formatearMonto(x, moneda);

  const elegidos = useMemo(
    () => lineas.flatMap((l) => productos.data?.items.filter((p) => p.id === l.productoId) ?? []),
    [lineas, productos.data],
  );
  const admiteFinMes = elegidos.every((p) => p.permiteFinMes);
  const admiteCuotas = elegidos.every((p) => p.permiteCuotas);
  const cuotasPorDefecto = Math.min(3, cliente?.maxMeses ?? 3);
  const cuotas = numCuotas ?? cuotasPorDefecto;

  const listas = lineas.filter((l) => l.productoId && cantidadValida(l.cantidad));
  const entrada: CompraEntrada | null =
    clienteId && listas.length && listas.length === lineas.length
      ? {
          clienteId,
          modalidad,
          ...(modalidad === 'CUOTAS' ? { numCuotas: cuotas } : {}),
          items: listas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
        }
      : null;
  const enEspera = useEspera(entrada, 300);
  const simulacion = useQuery({
    queryKey: ['simular', tienda, enEspera],
    queryFn: () => api.simular(enEspera as CompraEntrada),
    enabled: !!enEspera,
    placeholderData: keepPreviousData,
    // La fecha y el ciclo dependen de la hora: se mantienen al día, también al cruzar las 17:00.
    refetchInterval: 60000,
  });
  // Si la simulación falló, no quedan a la vista las cifras de la anterior.
  const s = enEspera && !simulacion.error ? simulacion.data : undefined;
  // Confirmar exige que lo simulado sea lo que hay en pantalla. No mira el límite: el rechazo debe llegar a la API.
  const alDia =
    !!s &&
    !simulacion.isPlaceholderData &&
    !simulacion.isFetching &&
    JSON.stringify(enEspera) === JSON.stringify(entrada);

  const enviando = useRef(false);
  const registrar = useMutation({
    mutationFn: () => api.registrarCompra(entrada as CompraEntrada),
    onSettled: () => {
      enviando.current = false;
    },
    onSuccess: (compra) => {
      consultas.invalidateQueries();
      if (compra.modalidad === 'CUOTAS') {
        navegar(`/dueno/cronogramas/${compra.id}`);
        return;
      }
      setExito(
        `Compra registrada: ticket ${compra.ticket}, fecha de pago ${formatearFecha(compra.fechaPago)}.`,
      );
      setLineas([lineaVacia()]);
      setClienteId('');
      setNumCuotas(null);
    },
  });

  // Un rechazo anterior ya no aplica si cambió lo que se quiere registrar.
  const firma = JSON.stringify(entrada);
  const { reset: limpiarRegistro } = registrar;
  useEffect(() => {
    limpiarRegistro();
  }, [firma, limpiarRegistro]);

  const cambiarLinea = (clave: number, cambios: Partial<Linea>) => {
    setExito(null);
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));
  };

  if (clientes.isLoading || productos.isLoading) return <Cargando />;
  if (clientes.error || productos.error)
    return <PanelError error={clientes.error ?? productos.error} />;

  return (
    <>
      <h1 className="text-2xl font-bold text-vecino-oscuro">Nueva compra</h1>
      {exito && <Franja tipo="exito">{exito}</Franja>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Tarjeta>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                etiqueta="Cliente"
                ayuda="Quien compra. Define la moneda y el máximo de cuotas."
              >
                {(id) => (
                  <select
                    id={id}
                    className={claseEntrada}
                    value={clienteId}
                    onChange={(e) => {
                      setClienteId(e.target.value);
                      setNumCuotas(null);
                      setExito(null);
                    }}
                  >
                    <option value="">Elige un cliente</option>
                    {clientes.data?.items.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombres} {c.apellidos}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo etiqueta="Modalidad" ayuda={T12.modalidad}>
                {(id) => (
                  <select
                    id={id}
                    className={claseEntrada}
                    value={modalidad}
                    onChange={(e) => {
                      setModalidad(e.target.value as 'FIN_MES' | 'CUOTAS');
                    }}
                  >
                    <option value="FIN_MES" disabled={!admiteFinMes}>
                      A fin de mes
                    </option>
                    <option value="CUOTAS" disabled={!admiteCuotas}>
                      En cuotas
                    </option>
                  </select>
                )}
              </Campo>
              {modalidad === 'CUOTAS' && (
                <Campo etiqueta="Número de cuotas" ayuda={T12.numeroCuotas}>
                  {(id) => (
                    <select
                      id={id}
                      className={claseEntrada}
                      value={cuotas}
                      onChange={(e) => setNumCuotas(aEntero(e.target.value))}
                    >
                      {Array.from({ length: cliente?.maxMeses ?? 12 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
              )}
            </div>
          </Tarjeta>
          <Tarjeta titulo="Productos">
            {!productos.data?.items.length && (
              <Vacio texto="Aún no tienes productos activos en tu catálogo." />
            )}
            <div className="space-y-3">
              {lineas.map((l, i) => {
                const fila = s?.lineas[i];
                const producto = productos.data?.items.find((p) => p.id === l.productoId);
                return (
                  <div
                    key={l.clave}
                    className="grid items-start gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-[1fr_7rem_8rem_auto]"
                  >
                    <Campo
                      etiqueta="Producto"
                      ayuda="Del catálogo de tu tienda. El precio no se digita."
                    >
                      {(id) => (
                        <select
                          id={id}
                          className={claseEntrada}
                          value={l.productoId}
                          onChange={(e) => cambiarLinea(l.clave, { productoId: e.target.value })}
                        >
                          <option value="">Elige un producto</option>
                          {productos.data?.items.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.codigo} · {p.nombre}
                            </option>
                          ))}
                        </select>
                      )}
                    </Campo>
                    <Campo
                      etiqueta="Cantidad"
                      ayuda="Hasta 3 decimales, por ejemplo 2.350 kg."
                      error={
                        l.cantidad && !cantidadValida(l.cantidad)
                          ? 'Debe ser mayor que 0, con hasta 3 decimales.'
                          : undefined
                      }
                    >
                      {(id) => (
                        <input
                          id={id}
                          inputMode="decimal"
                          className={claseEntrada}
                          value={l.cantidad}
                          onChange={(e) => cambiarLinea(l.clave, { cantidad: e.target.value })}
                        />
                      )}
                    </Campo>
                    <div className="text-sm">
                      <p className="text-xs text-gray-500">Subtotal</p>
                      <p className="mt-2 font-medium tabular-nums">
                        {fila && alDia ? m(fila.subtotal) : '—'}
                      </p>
                      {producto && (
                        <p className="text-xs text-gray-500">
                          Lista {formatearMonto(producto.precioLista, moneda)} · Contado{' '}
                          {formatearMonto(producto.precioContado, moneda)}
                        </p>
                      )}
                    </div>
                    <Boton
                      variante="secundario"
                      className="sm:mt-6"
                      disabled={lineas.length === 1}
                      onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}
                    >
                      Quitar
                    </Boton>
                  </div>
                );
              })}
            </div>
            <Boton
              variante="secundario"
              className="mt-3"
              onClick={() => setLineas((ls) => [...ls, lineaVacia()])}
            >
              Agregar producto
            </Boton>
          </Tarjeta>
        </div>
        <div className="min-w-0 space-y-4">
          <Tarjeta titulo="Simulador">
            {!s && !simulacion.error && (
              <p className="text-sm text-gray-500">
                Elige cliente y productos para ver la simulación.
              </p>
            )}
            {simulacion.error && <Franja tipo="error">{mensajeError(simulacion.error)}</Franja>}
            {s && (
              <div className="space-y-3 text-sm">
                <dl className="grid grid-cols-2 gap-2">
                  <Dato
                    etiqueta="Total a precio de lista"
                    ayuda="Lo que suma la compra a precio de lista. Es lo que consume el límite del cliente."
                  >
                    {m(s.montoLista)}
                  </Dato>
                  <Dato
                    etiqueta="Total al contado"
                    ayuda="Lo que suma la compra al contado. Es la base del VAN de la tienda."
                  >
                    {m(s.montoContado)}
                  </Dato>
                  <Dato
                    etiqueta="Fecha de pago"
                    ayuda="El primer día de pago después del corte. Lo registrado después de las 17:00 cuenta como del día siguiente."
                  >
                    {formatearFecha(s.fechaPago)}
                  </Dato>
                  <Dato
                    etiqueta="Fecha operativa"
                    ayuda="La fecha con la que cuenta la compra: la de hoy, o la de mañana si es después de las 17:00."
                  >
                    {formatearFecha(s.fechaOperativa)}
                  </Dato>
                </dl>
                <div>
                  <p className="mb-1 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      Uso del límite: {formatearPorcentajeApi(s.limite.usoActualPorcentaje)} →{' '}
                      {formatearPorcentajeApi(s.limite.usoConCompraPorcentaje)}
                    </span>
                  </p>
                  <BarraUso
                    actual={s.limite.usoActualPorcentaje}
                    conCompra={s.limite.usoConCompraPorcentaje}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Disponible: {m(s.limite.disponible)} de {m(s.limite.limite)}
                  </p>
                </div>
                {!s.limite.aceptada && <Franja tipo="error">{s.limite.mensaje}</Franja>}
                {s.finMes && (
                  <dl className="grid grid-cols-2 gap-2 rounded-lg bg-vecino/5 p-3">
                    <div>
                      <dt className="flex items-center text-xs text-gray-500">
                        Interés estimado
                        <Ayuda texto={T12.interesEstimado} />
                      </dt>
                      <dd className="font-medium tabular-nums">{m(s.finMes.interes)}</dd>
                    </div>
                    <Dato etiqueta="Días">{s.finMes.dias}</Dato>
                    <Dato etiqueta="Total estimado">{m(s.finMes.total)}</Dato>
                  </dl>
                )}
                {s.cuotas && (
                  <>
                    <dl className="grid grid-cols-2 gap-2 rounded-lg bg-vecino/5 p-3">
                      <Dato
                        etiqueta="Días de gracia (g)"
                        ayuda="Días desde la compra hasta la fecha de pago del ciclo: no se paga nada, pero corre el interés. Ejemplo: 11."
                      >
                        {s.cuotas.g}
                      </Dato>
                      <Dato
                        etiqueta="Capital con gracia (P')"
                        ayuda="El monto con el interés de los días de gracia: P × (1 + TED)^g. Ejemplo: S/ 261.07."
                      >
                        {m(s.cuotas.capitalCapitalizado)}
                      </Dato>
                      <Dato
                        etiqueta="Interés de gracia"
                        ayuda="Lo que suman los días de gracia a la deuda. Ejemplo: S/ 3.27."
                      >
                        {m(s.cuotas.interesGracia)}
                      </Dato>
                      <Dato
                        etiqueta="Cuota (R)"
                        ayuda="Cuota fija del método francés, con días exactos. Ejemplo: S/ 93.25."
                      >
                        {m(s.cuotas.cuotaFija)}
                      </Dato>
                      <Dato
                        etiqueta="Última cuota"
                        ayuda="El saldo que queda más su interés; ajusta el redondeo. Ejemplo: S/ 93.26."
                      >
                        {m(s.cuotas.ultimaCuota)}
                      </Dato>
                      <Dato
                        etiqueta="Primera cuota"
                        ayuda="Un mes después de la fecha de pago del ciclo."
                      >
                        {formatearFecha(s.cuotas.primeraCuota)}
                      </Dato>
                      <div>
                        <dt className="flex items-center text-xs text-gray-500">
                          TCEA
                          <Ayuda texto={T12.tceaVan} />
                        </dt>
                        <dd className="font-medium tabular-nums">
                          {formatearPorcentajeApi(s.cuotas.tceaPorcentaje)}
                        </dd>
                      </div>
                      <div>
                        <dt className="flex items-center text-xs text-gray-500">
                          VAN
                          <Ayuda texto={T12.tceaVan} />
                        </dt>
                        <dd className="font-medium tabular-nums">{m(s.cuotas.van)}</dd>
                      </div>
                    </dl>
                    <div className="rounded-lg border border-gray-200 p-3 text-xs text-gray-700">
                      <p className="mb-1 font-semibold">
                        TCEA: tasa que iguala las cuotas con el monto a precio de lista
                      </p>
                      <p>
                        {m(s.montoLista)} = Σ Cuota<sub>k</sub> / (1 + TIR)
                        <sup>
                          t<sub>k</sub>
                        </sup>
                        ; TIR diaria = {s.cuotas.tirDiaria}
                      </p>
                      <p>
                        TCEA = (1 + TIR)<sup>360</sup> − 1 ={' '}
                        {formatearPorcentajeApi(s.cuotas.tceaPorcentaje)}
                      </p>
                      <p className="mb-1 mt-2 font-semibold">
                        VAN: con el COK de la tienda ({formatearTasa(s.cuotas.cokTea, 2)} TEA)
                      </p>
                      <p>
                        VAN = Σ Cuota<sub>k</sub> / (1 + TED<sub>COK</sub>)
                        <sup>
                          t<sub>k</sub>
                        </sup>{' '}
                        − contado = {m(s.cuotas.sumaValorActual)} − {m(s.montoContado)} ={' '}
                        {m(s.cuotas.van)}
                      </p>
                    </div>
                    <Tabla columnas={['Cuota', 'Vence', 't', 'Monto', 'Valor actual']}>
                      {s.cuotas.filas.map((f) => (
                        <tr key={f.numero}>
                          <Celda>{f.numero}</Celda>
                          <Celda>{formatearFecha(f.vence)}</Celda>
                          <Celda derecha>{f.t}</Celda>
                          <Celda derecha>{m(f.monto)}</Celda>
                          <Celda derecha>{m(f.valorActual as string)}</Celda>
                        </tr>
                      ))}
                    </Tabla>
                  </>
                )}
              </div>
            )}
            {registrar.error && (
              <div className="mt-3">
                <Franja tipo="error">
                  {mensajeError(registrar.error)}
                  {registrar.error instanceof ErrorApi &&
                    registrar.error.codigo === 'LIMITE_EXCEDIDO' &&
                    ' El intento quedó registrado en la auditoría.'}
                </Franja>
              </div>
            )}
            <Boton
              className="mt-3 w-full"
              disabled={!alDia || registrar.isPending}
              onClick={() => {
                if (enviando.current) return;
                enviando.current = true;
                registrar.mutate();
              }}
            >
              Confirmar compra
            </Boton>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
