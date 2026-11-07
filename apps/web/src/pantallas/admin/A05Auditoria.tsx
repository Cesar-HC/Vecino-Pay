import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/api';
import { formatearFechaHora } from '../../lib/formato';
import {
  Boton,
  Campo,
  Cargando,
  Celda,
  claseEntrada,
  Franja,
  PanelError,
  Tabla,
  Tarjeta,
  Vacio,
} from '../../ui/base';

const TAMANO = 25;

export default function A05Auditoria() {
  const [parametros] = useSearchParams();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tiendaId, setTiendaId] = useState(parametros.get('tiendaId') ?? '');
  const [usuarioId, setUsuarioId] = useState('');
  const [accion, setAccion] = useState('');
  const [pagina, setPagina] = useState(1);
  const tiendas = useQuery({ queryKey: ['tiendas', ''], queryFn: () => api.tiendas() });
  const usuarios = useQuery({ queryKey: ['usuarios-todos'], queryFn: () => api.usuarios() });
  // Comparar fechas AAAA-MM-DD como texto es válido: el orden alfabético es el cronológico.
  const rangoInvalido = !!desde && !!hasta && desde > hasta;
  const filtro = { desde, hasta, tiendaId, usuarioId, accion, pagina, tamano: TAMANO };
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['auditoria', filtro],
    queryFn: () => api.auditoria(filtro),
    enabled: !rangoInvalido,
    placeholderData: keepPreviousData,
  });
  const cambiar = (f: (v: string) => void) => (e: { target: { value: string } }) => {
    f(e.target.value);
    setPagina(1);
  };
  const paginas = data ? Math.max(Math.ceil(data.total / TAMANO), 1) : 1;
  return (
    <>
      <h1 className="text-2xl font-bold text-vecino-oscuro">Auditoría</h1>
      <Tarjeta>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Campo etiqueta="Fecha inicial" ayuda="Desde qué fecha buscar, en hora de Lima.">
            {(id) => (
              <input
                id={id}
                type="date"
                className={claseEntrada}
                value={desde}
                onChange={cambiar(setDesde)}
              />
            )}
          </Campo>
          <Campo etiqueta="Fecha final" ayuda="Hasta qué fecha buscar, incluida.">
            {(id) => (
              <input
                id={id}
                type="date"
                className={claseEntrada}
                value={hasta}
                onChange={cambiar(setHasta)}
              />
            )}
          </Campo>
          <Campo etiqueta="Tienda" ayuda="Solo las operaciones de esta tienda.">
            {(id) => (
              <select
                id={id}
                className={claseEntrada}
                value={tiendaId}
                onChange={cambiar(setTiendaId)}
              >
                <option value="">Todas</option>
                {tiendas.data?.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombreComercial}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo etiqueta="Usuario" ayuda="Solo las operaciones de este usuario.">
            {(id) => (
              <select
                id={id}
                className={claseEntrada}
                value={usuarioId}
                onChange={cambiar(setUsuarioId)}
              >
                <option value="">Todos</option>
                {usuarios.data?.items.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo
            etiqueta="Acción"
            ayuda="ALTA, BAJA, CAMBIO, LOGIN (inicio de sesión) o RECHAZO (operación no aceptada)."
          >
            {(id) => (
              <select id={id} className={claseEntrada} value={accion} onChange={cambiar(setAccion)}>
                <option value="">Todas</option>
                {['ALTA', 'BAJA', 'CAMBIO', 'LOGIN', 'RECHAZO'].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            )}
          </Campo>
        </div>
        {rangoInvalido && (
          <div className="mt-2">
            <Franja tipo="error">La fecha inicial no puede ser posterior a la final.</Franja>
          </div>
        )}
      </Tarjeta>
      <Tarjeta>
        {isLoading && <Cargando />}
        {error && <PanelError error={error} reintentar={refetch} />}
        {data && !data.items.length && <Vacio texto="No hay operaciones con esos filtros." />}
        {data && data.items.length > 0 && (
          <>
            <Tabla
              columnas={[
                'Fecha y hora',
                'Usuario',
                'Tienda',
                'Acción',
                'Tabla',
                'Registro',
                'Detalle',
              ]}
            >
              {data.items.map((f) => (
                <tr key={f.id}>
                  <Celda>{formatearFechaHora(f.fechaHora, true)}</Celda>
                  <Celda>{f.usuario ?? 'Sistema'}</Celda>
                  <Celda>{f.tienda ?? 'Plataforma'}</Celda>
                  <Celda>{f.accion}</Celda>
                  <Celda>{f.tabla}</Celda>
                  <Celda>{f.registroId ?? '—'}</Celda>
                  <Celda>{f.detalle}</Celda>
                </tr>
              ))}
            </Tabla>
            <div className="mt-3 flex items-center justify-between gap-2 text-sm text-gray-600">
              <span>
                {data.total} operaciones · página {pagina} de {paginas}
              </span>
              <span className="flex gap-2">
                <Boton
                  variante="secundario"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((n) => n - 1)}
                >
                  Anterior
                </Boton>
                <Boton
                  variante="secundario"
                  disabled={pagina >= paginas}
                  onClick={() => setPagina((n) => n + 1)}
                >
                  Siguiente
                </Boton>
              </span>
            </div>
          </>
        )}
      </Tarjeta>
    </>
  );
}
