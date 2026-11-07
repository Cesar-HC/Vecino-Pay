import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../api/api';
import { aEntero } from '../../lib/entrada';
import { formatearFecha, formatearFechaHora } from '../../lib/formato';
import {
  Boton,
  Celda,
  Cargando,
  Confirmar,
  Franja,
  Kpi,
  mensajeError,
  PanelError,
  Tabla,
  Tarjeta,
  Vacio,
} from '../../ui/base';
import { GraficoBarras, GraficoCirculo } from '../../ui/Graficos';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreMes = (mes: string) => `${MESES[aEntero(mes.slice(5)) - 1]} ${mes.slice(2, 4)}`;

/** Solo con reloj fijo: sin cron no hay listados en la demo. Nunca muestra importes (6.2.1). */
function CorteDemo() {
  const cliente = useQueryClient();
  const salud = useQuery({ queryKey: ['salud'], queryFn: api.salud });
  const [confirmar, setConfirmar] = useState(false);
  const corte = useMutation({
    mutationFn: api.ejecutarCorte,
    onSuccess: () => cliente.invalidateQueries(),
    onSettled: () => setConfirmar(false),
  });
  if (!salud.data?.relojFijo) return null;
  return (
    <Tarjeta titulo="Demostración: corte del día">
      <p className="mb-2 text-sm text-gray-600">
        Con el reloj fijo no corre el corte automático. Solo procesa la fecha de hoy y después de
        las 17:00:00.
      </p>
      <Boton variante="secundario" onClick={() => setConfirmar(true)}>
        Ejecutar corte de hoy
      </Boton>
      {corte.error && (
        <div className="mt-2">
          <Franja tipo="error">{mensajeError(corte.error)}</Franja>
        </div>
      )}
      {corte.data && (
        <div className="mt-2">
          <Franja tipo="exito">
            Corte del {formatearFecha(corte.data.fecha)}: {corte.data.listadosEmitidos.length}{' '}
            listados emitidos
            {corte.data.listadosEmitidos.length > 0 &&
              ` (${corte.data.listadosEmitidos.map((l) => l.numero).join(', ')})`}
            , {corte.data.omitidos} clientes sin listado, {corte.data.vencidos} vencidos y{' '}
            {corte.data.errores.length} errores.
          </Franja>
        </div>
      )}
      {confirmar && (
        <Confirmar
          titulo="Ejecutar corte"
          texto="Se emitirán los listados de los clientes con corte hoy, en todas las tiendas."
          accion="Ejecutar"
          ocupado={corte.isPending}
          alConfirmar={() => corte.mutate()}
          alCerrar={() => setConfirmar(false)}
        />
      )}
    </Tarjeta>
  );
}

export default function A02Resumen() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['plataforma'],
    queryFn: api.resumenPlataforma,
  });
  if (isLoading) return <Cargando />;
  if (error || !data) return <PanelError error={error} reintentar={refetch} />;
  return (
    <>
      <h1 className="text-2xl font-bold text-vecino-oscuro">Resumen de la plataforma</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Tiendas activas" valor={data.tiendasActivas} />
        <Kpi titulo="Usuarios activos" valor={data.usuariosActivos} />
        <Kpi titulo="Clientes registrados" valor={data.clientesRegistrados} />
        <Kpi titulo="Operaciones de hoy" valor={data.operacionesHoy} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Tiendas dadas de alta por mes">
          {data.altasPorMes.length ? (
            <GraficoBarras
              datos={data.altasPorMes.map((a) => ({
                nombre: nombreMes(a.mes),
                valor: a.cantidad,
                etiqueta: String(a.cantidad),
              }))}
            />
          ) : (
            <Vacio texto="Aún no hay altas." />
          )}
        </Tarjeta>
        <Tarjeta titulo="Operaciones de los últimos 7 días">
          <GraficoBarras
            datos={data.operacionesPorDia.map((d) => ({
              nombre: formatearFecha(d.fecha).slice(0, 5),
              valor: d.cantidad,
              etiqueta: String(d.cantidad),
            }))}
          />
        </Tarjeta>
        <Tarjeta titulo="Tiendas por giro">
          <GraficoCirculo
            datos={data.tiendasPorGiro.map((g) => ({
              nombre: g.giro,
              valor: g.cantidad,
              etiqueta: String(g.cantidad),
            }))}
          />
        </Tarjeta>
      </div>
      <Tarjeta titulo="Últimas operaciones">
        <Tabla columnas={['Fecha y hora', 'Usuario', 'Tienda', 'Acción', 'Tabla']}>
          {data.ultimasOperaciones.map((o, i) => (
            <tr key={i}>
              <Celda>{formatearFechaHora(o.fechaHora, true)}</Celda>
              <Celda>{o.usuario ?? 'Sistema'}</Celda>
              <Celda>{o.tienda ?? 'Plataforma'}</Celda>
              <Celda>{o.accion}</Celda>
              <Celda>{o.tabla}</Celda>
            </tr>
          ))}
        </Tabla>
      </Tarjeta>
      <CorteDemo />
    </>
  );
}
