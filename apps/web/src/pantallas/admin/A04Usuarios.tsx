import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../../api/api';
import type { Usuario } from '../../api/tipos';
import { formatearFechaHora } from '../../lib/formato';
import {
  Boton,
  Campo,
  Cargando,
  Celda,
  claseEntrada,
  Confirmar,
  Franja,
  Insignia,
  mensajeError,
  Modal,
  PanelError,
  Tabla,
  Tarjeta,
  Vacio,
} from '../../ui/base';

const NOMBRES: Record<string, string> = {
  ADMIN_SISTEMA: 'Administrador del sistema',
  DUENO: 'Administrador del negocio',
  CLIENTE: 'Cliente',
};

const esquema = z.object({
  perfil: z.enum(['ADMIN_SISTEMA', 'DUENO']),
  username: z.string().trim().min(1, 'Escribe el usuario.').max(120),
  nombres: z.string().trim().min(1, 'Escribe el nombre.').max(160),
  tiendaId: z.string().optional(),
  claveTemporal: z.string().optional(),
});
type Datos = z.infer<typeof esquema>;
const VACIO: Datos = {
  perfil: 'DUENO',
  username: '',
  nombres: '',
  tiendaId: '',
  claveTemporal: '',
};

function Formulario({ usuario, alTerminar }: { usuario: Usuario | null; alTerminar: () => void }) {
  const cliente = useQueryClient();
  const tiendas = useQuery({ queryKey: ['tiendas', ''], queryFn: () => api.tiendas() });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Datos>({ resolver: zodResolver(esquema), defaultValues: VACIO });
  const [bajar, setBajar] = useState(false);
  const [restablecer, setRestablecer] = useState(false);
  const [clave, setClave] = useState('');
  const [hecho, setHecho] = useState<string | null>(null);

  useEffect(() => {
    setHecho(null);
    reset(
      usuario
        ? {
            perfil: usuario.perfil === 'ADMIN_SISTEMA' ? 'ADMIN_SISTEMA' : 'DUENO',
            username: usuario.username,
            nombres: usuario.nombres,
            tiendaId: usuario.tienda?.id ?? '',
            claveTemporal: '',
          }
        : VACIO,
    );
  }, [usuario, reset]);

  const baja = useMutation({
    mutationFn: () => api.estadoUsuario((usuario as Usuario).id, 'INACTIVO'),
    onSuccess: () => {
      cliente.invalidateQueries();
      setBajar(false);
      alTerminar();
    },
    onError: (e) => {
      setBajar(false);
      setError('root', { message: mensajeError(e) });
    },
  });
  const restablecerClave = useMutation({
    mutationFn: () => api.restablecerClave((usuario as Usuario).id, clave),
    onSuccess: () => {
      setRestablecer(false);
      setClave('');
      setHecho('Clave restablecida.');
    },
  });

  const esDueno = watch('perfil') === 'DUENO' && usuario?.perfil !== 'CLIENTE';
  const enviar = handleSubmit(async (d) => {
    try {
      if (usuario) {
        const cambios: Record<string, unknown> = {};
        if (dirtyFields.nombres) cambios.nombres = d.nombres;
        if (dirtyFields.tiendaId && d.tiendaId) cambios.tiendaId = d.tiendaId;
        if (!Object.keys(cambios).length) {
          setError('root', { message: 'No hay cambios que guardar.' });
          return;
        }
        await api.editarUsuario(usuario.id, cambios);
      } else {
        if (!d.claveTemporal || d.claveTemporal.length < 8) {
          setError('claveTemporal', {
            message: 'La clave temporal debe tener 8 caracteres o más.',
          });
          return;
        }
        if (d.perfil === 'DUENO' && !d.tiendaId) {
          setError('tiendaId', { message: 'Un dueño sin tienda no puede ingresar.' });
          return;
        }
        await api.crearUsuario({
          perfil: d.perfil,
          username: d.username,
          nombres: d.nombres,
          claveTemporal: d.claveTemporal,
          tiendaId: d.perfil === 'DUENO' ? d.tiendaId : undefined,
        });
      }
      cliente.invalidateQueries();
      reset(VACIO);
      alTerminar();
    } catch (e) {
      const c = (e as { codigo?: string }).codigo;
      if (c === 'USUARIO_DUPLICADO') setError('username', { message: mensajeError(e) });
      else setError('root', { message: mensajeError(e) });
    }
  });

  return (
    <>
      <form onSubmit={enviar} noValidate className="space-y-3">
        <Campo
          etiqueta="Perfil"
          ayuda="El perfil define qué pantallas ve la persona."
          error={errors.perfil?.message}
        >
          {(id) =>
            usuario?.perfil === 'CLIENTE' ? (
              <input id={id} disabled value="Cliente" className={claseEntrada} />
            ) : (
              <select id={id} disabled={!!usuario} className={claseEntrada} {...register('perfil')}>
                <option value="DUENO">Administrador del negocio</option>
                <option value="ADMIN_SISTEMA">Administrador del sistema</option>
              </select>
            )
          }
        </Campo>
        <Campo
          etiqueta="Usuario"
          ayuda="Correo con el que ingresa la persona. Una cuenta de cliente usa su DNI y solo nace al activarla."
          error={errors.username?.message}
        >
          {(id) => (
            <input
              id={id}
              disabled={!!usuario}
              className={claseEntrada}
              {...register('username')}
            />
          )}
        </Campo>
        <Campo
          etiqueta="Nombre"
          ayuda="Nombre completo de la persona, hasta 160 caracteres."
          error={errors.nombres?.message}
        >
          {(id) => <input id={id} className={claseEntrada} {...register('nombres')} />}
        </Campo>
        {esDueno && (
          <Campo
            etiqueta="Tienda asignada"
            ayuda="La tienda pasará a este usuario. Un dueño sin tienda no puede ingresar."
            error={errors.tiendaId?.message}
          >
            {(id) => (
              <select id={id} className={claseEntrada} {...register('tiendaId')}>
                <option value="">Elige una tienda</option>
                {tiendas.data?.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombreComercial}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        )}
        {!usuario && (
          <Campo
            etiqueta="Clave temporal"
            ayuda="Clave inicial, de 8 caracteres o más."
            error={errors.claveTemporal?.message}
          >
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="new-password"
                className={claseEntrada}
                {...register('claveTemporal')}
              />
            )}
          </Campo>
        )}
        {errors.root && <Franja tipo="error">{errors.root.message}</Franja>}
        {hecho && <Franja tipo="exito">{hecho}</Franja>}
        <div className="flex flex-wrap gap-2">
          <Boton type="submit" disabled={isSubmitting}>
            Guardar
          </Boton>
          {usuario && (
            <>
              <Boton variante="secundario" onClick={() => setRestablecer(true)}>
                Restablecer clave
              </Boton>
              <Boton
                variante="peligro"
                disabled={usuario.estado === 'INACTIVO'}
                onClick={() => setBajar(true)}
              >
                Dar de baja
              </Boton>
              <Boton variante="secundario" onClick={alTerminar}>
                Nuevo usuario
              </Boton>
            </>
          )}
        </div>
      </form>
      {bajar && usuario && (
        <Confirmar
          titulo="Dar de baja"
          texto={`${usuario.nombres} ya no podrá ingresar.`}
          accion="Dar de baja"
          ocupado={baja.isPending}
          alConfirmar={() => baja.mutate()}
          alCerrar={() => setBajar(false)}
        />
      )}
      {restablecer && usuario && (
        <Modal
          titulo={`Restablecer la clave de ${usuario.nombres}`}
          alCerrar={() => setRestablecer(false)}
        >
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (clave.length >= 8 && !restablecerClave.isPending) restablecerClave.mutate();
            }}
          >
            <Campo
              etiqueta="Clave temporal"
              ayuda="Nueva clave, de 8 caracteres o más. Compártela con la persona por un medio seguro."
              error={
                clave && clave.length < 8
                  ? 'La clave temporal debe tener 8 caracteres o más.'
                  : restablecerClave.error
                    ? mensajeError(restablecerClave.error)
                    : undefined
              }
            >
              {(id) => (
                <input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  className={claseEntrada}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                />
              )}
            </Campo>
            <div className="mt-3 flex justify-end">
              <Boton type="submit" disabled={clave.length < 8 || restablecerClave.isPending}>
                Restablecer
              </Boton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default function A04Usuarios() {
  const [texto, setTexto] = useState('');
  const [perfil, setPerfil] = useState('');
  const [tiendaId, setTiendaId] = useState('');
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const tiendas = useQuery({ queryKey: ['tiendas', ''], queryFn: () => api.tiendas() });
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['usuarios', texto, perfil, tiendaId],
    queryFn: () => api.usuarios({ texto, perfil, tiendaId }),
  });
  return (
    <>
      <h1 className="text-2xl font-bold text-vecino-oscuro">Usuarios</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <input
              aria-label="Buscar usuario"
              placeholder="Buscar por nombre o usuario"
              className={claseEntrada}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <select
              aria-label="Filtrar por perfil"
              className={claseEntrada}
              value={perfil}
              onChange={(e) => setPerfil(e.target.value)}
            >
              <option value="">Todos los perfiles</option>
              {Object.entries(NOMBRES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por tienda"
              className={claseEntrada}
              value={tiendaId}
              onChange={(e) => setTiendaId(e.target.value)}
            >
              <option value="">Todas las tiendas</option>
              {tiendas.data?.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombreComercial}
                </option>
              ))}
            </select>
          </div>
          {isLoading && <Cargando />}
          {error && <PanelError error={error} reintentar={refetch} />}
          {data && !data.items.length && <Vacio texto="No hay usuarios con ese criterio." />}
          {data && data.items.length > 0 && (
            <Tabla columnas={['Nombre y usuario', 'Perfil', 'Tiendas', 'Último acceso', 'Estado']}>
              {data.items.map((u) => (
                <tr key={u.id} className={elegido?.id === u.id ? 'bg-vecino/5' : ''}>
                  <Celda>
                    <button
                      type="button"
                      className="text-left font-medium text-vecino-oscuro underline"
                      onClick={() => setElegido(u)}
                    >
                      {u.nombres}
                    </button>
                    <p className="break-all text-xs text-gray-500">{u.username}</p>
                  </Celda>

                  <Celda>{NOMBRES[u.perfil]}</Celda>
                  <Celda>{u.tiendas.map((t) => t.nombreComercial).join(', ') || '—'}</Celda>
                  <Celda>{u.ultimoAcceso ? formatearFechaHora(u.ultimoAcceso) : '—'}</Celda>
                  <Celda>
                    <Insignia estado={u.estado} />
                  </Celda>
                </tr>
              ))}
            </Tabla>
          )}
        </Tarjeta>
        <Tarjeta titulo={elegido ? `Editar a ${elegido.nombres}` : 'Nuevo usuario'}>
          <Formulario usuario={elegido} alTerminar={() => setElegido(null)} />
        </Tarjeta>
      </div>
    </>
  );
}
