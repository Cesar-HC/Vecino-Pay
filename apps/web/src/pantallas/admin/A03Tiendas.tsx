import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../../api/api';
import type { Tienda } from '../../api/tipos';
import {
  mayorQueCero,
  PORCENTAJE_DIGITADO,
  porcentajeATantoPorUno,
  tantoPorUnoAPorcentaje,
} from '../../lib/entrada';
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
  PanelError,
  Tabla,
  Tarjeta,
  Vacio,
} from '../../ui/base';

const esquema = z.object({
  ruc: z.string().regex(/^\d{11}$/, 'El RUC debe tener 11 dígitos.'),
  razonSocial: z.string().trim().min(1, 'Escribe la razón social.').max(150),
  nombreComercial: z.string().trim().min(1, 'Escribe el nombre comercial.').max(100),
  giro: z.string().trim().min(1, 'Escribe el giro.').max(40),
  telefono: z.string().trim().max(15).optional(),
  direccion: z.string().trim().max(200).optional(),
  usuarioDueno: z.string().trim().max(120).optional(),
  claveTemporal: z.string().optional(),
  cok: z
    .string()
    .regex(PORCENTAJE_DIGITADO, 'Escribe el COK en porcentaje, con hasta 7 decimales.')
    .refine(mayorQueCero, 'El COK de la tienda debe ser mayor que cero.'),
});
type Datos = z.infer<typeof esquema>;

const VACIO: Datos = {
  ruc: '',
  razonSocial: '',
  nombreComercial: '',
  giro: '',
  telefono: '',
  direccion: '',
  usuarioDueno: '',
  claveTemporal: '',
  cok: '20',
};
const CAMPOS_ERROR: Record<string, keyof Datos> = {
  RUC_DUPLICADO: 'ruc',
  USUARIO_DUPLICADO: 'usuarioDueno',
  USUARIO_NO_ES_DUENO: 'usuarioDueno',
  CLAVE_REQUERIDA: 'claveTemporal',
  COK: 'cok',
};

function Formulario({ tienda, alTerminar }: { tienda: Tienda | null; alTerminar: () => void }) {
  const cliente = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Datos>({ resolver: zodResolver(esquema), defaultValues: VACIO });
  const [bajar, setBajar] = useState(false);

  useEffect(() => {
    reset(
      tienda
        ? {
            ruc: tienda.ruc,
            razonSocial: tienda.razonSocial,
            nombreComercial: tienda.nombreComercial,
            giro: tienda.giro,
            telefono: tienda.telefono ?? '',
            direccion: tienda.direccion ?? '',
            usuarioDueno: tienda.duenio.username,
            claveTemporal: '',
            cok: tantoPorUnoAPorcentaje(tienda.cokTea),
          }
        : VACIO,
    );
  }, [tienda, reset]);

  const baja = useMutation({
    mutationFn: () => api.estadoTienda((tienda as Tienda).id, 'INACTIVO'),
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

  const enviar = handleSubmit(async (d) => {
    try {
      if (tienda) {
        const cambios: Record<string, unknown> = {};
        if (dirtyFields.ruc) cambios.ruc = d.ruc;
        if (dirtyFields.razonSocial) cambios.razonSocial = d.razonSocial;
        if (dirtyFields.nombreComercial) cambios.nombreComercial = d.nombreComercial;
        if (dirtyFields.giro) cambios.giro = d.giro;
        if (dirtyFields.telefono) cambios.telefono = d.telefono ?? '';
        if (dirtyFields.direccion) cambios.direccion = d.direccion ?? '';
        if (dirtyFields.cok) cambios.cokTea = porcentajeATantoPorUno(d.cok);
        if (!Object.keys(cambios).length) {
          setError('root', { message: 'No hay cambios que guardar.' });
          return;
        }
        await api.editarTienda(tienda.id, cambios);
      } else {
        if (!d.usuarioDueno) {
          setError('usuarioDueno', { message: 'Escribe el usuario del dueño.' });
          return;
        }
        if (d.claveTemporal && d.claveTemporal.length < 8) {
          setError('claveTemporal', {
            message: 'La clave temporal debe tener 8 caracteres o más.',
          });
          return;
        }
        await api.crearTienda({
          ruc: d.ruc,
          razonSocial: d.razonSocial,
          nombreComercial: d.nombreComercial,
          giro: d.giro,
          telefono: d.telefono || undefined,
          direccion: d.direccion || undefined,
          usuarioDueno: d.usuarioDueno,
          claveTemporal: d.claveTemporal || undefined,
          cokTea: porcentajeATantoPorUno(d.cok),
        });
      }
      cliente.invalidateQueries();
      reset(VACIO);
      alTerminar();
    } catch (e) {
      const c = (e as { codigo?: string }).codigo;
      const campo = c ? CAMPOS_ERROR[c] : undefined;
      if (campo) setError(campo, { message: mensajeError(e) });
      else setError('root', { message: mensajeError(e) });
    }
  });

  const deBaja = tienda?.estado === 'INACTIVO';
  return (
    <form onSubmit={enviar} noValidate className="space-y-3">
      <Campo
        etiqueta="RUC"
        ayuda="Registro Único de Contribuyentes: 11 dígitos, sin espacios. Ejemplo: 10412587369."
        error={errors.ruc?.message}
      >
        {(id) => (
          <input id={id} inputMode="numeric" className={claseEntrada} {...register('ruc')} />
        )}
      </Campo>
      <Campo
        etiqueta="Razón social"
        ayuda="Nombre legal de la tienda, como figura en SUNAT."
        error={errors.razonSocial?.message}
      >
        {(id) => <input id={id} className={claseEntrada} {...register('razonSocial')} />}
      </Campo>
      <Campo
        etiqueta="Nombre comercial"
        ayuda="El nombre que ven los clientes. Ejemplo: Minimarket Doña Rosa."
        error={errors.nombreComercial?.message}
      >
        {(id) => <input id={id} className={claseEntrada} {...register('nombreComercial')} />}
      </Campo>
      <Campo
        etiqueta="Giro"
        ayuda="A qué se dedica la tienda. Alimenta el gráfico de tiendas por giro del resumen."
        error={errors.giro?.message}
      >
        {(id) => (
          <>
            <input id={id} list="giros" className={claseEntrada} {...register('giro')} />
            <datalist id="giros">
              {['Bodega', 'Minimarket', 'Panadería', 'Peluquería', 'Pollería'].map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </>
        )}
      </Campo>
      <Campo
        etiqueta="Teléfono"
        ayuda="Opcional. Hasta 15 caracteres."
        error={errors.telefono?.message}
      >
        {(id) => <input id={id} className={claseEntrada} {...register('telefono')} />}
      </Campo>
      <Campo
        etiqueta="Dirección"
        ayuda="Opcional. Hasta 200 caracteres."
        error={errors.direccion?.message}
      >
        {(id) => <input id={id} className={claseEntrada} {...register('direccion')} />}
      </Campo>
      <Campo
        etiqueta="Usuario del dueño"
        ayuda="Correo con el que el dueño ingresa. Si ya existe un dueño con ese usuario, se le asigna esta tienda."
        error={errors.usuarioDueno?.message}
      >
        {(id) => (
          <input
            id={id}
            disabled={!!tienda}
            className={claseEntrada}
            {...register('usuarioDueno')}
          />
        )}
      </Campo>
      {!tienda && (
        <Campo
          etiqueta="Clave temporal"
          ayuda="Clave inicial del dueño nuevo, de 8 caracteres o más. No se pide si el dueño ya existe."
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
      <Campo
        etiqueta="COK de la tienda (TEA, %)"
        ayuda="Costo de oportunidad del capital: lo que la tienda ganaría con su dinero en otro uso. Se usa para el VAN. Por defecto, 20 %."
        error={errors.cok?.message}
      >
        {(id) => (
          <input id={id} inputMode="decimal" className={claseEntrada} {...register('cok')} />
        )}
      </Campo>
      {errors.root && <Franja tipo="error">{errors.root.message}</Franja>}
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" disabled={isSubmitting}>
          Guardar
        </Boton>
        {tienda && (
          <>
            <Boton variante="peligro" disabled={deBaja} onClick={() => setBajar(true)}>
              Dar de baja
            </Boton>
            <Boton variante="secundario" onClick={alTerminar}>
              Nueva tienda
            </Boton>
          </>
        )}
      </div>
      {bajar && tienda && (
        <Confirmar
          titulo="Dar de baja"
          texto={`${tienda.nombreComercial} no podrá operar. Su historial se conserva.`}
          accion="Dar de baja"
          ocupado={baja.isPending}
          alConfirmar={() => baja.mutate()}
          alCerrar={() => setBajar(false)}
        />
      )}
    </form>
  );
}

export default function A03Tiendas() {
  const [texto, setTexto] = useState('');
  const [elegida, setElegida] = useState<Tienda | null>(null);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['tiendas', texto],
    queryFn: () => api.tiendas({ texto }),
  });
  return (
    <>
      <h1 className="text-2xl font-bold text-vecino-oscuro">Tiendas</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <input
            aria-label="Buscar tienda"
            placeholder="Buscar por nombre o RUC"
            className={`${claseEntrada} mb-3`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          {isLoading && <Cargando />}
          {error && <PanelError error={error} reintentar={refetch} />}
          {data && !data.items.length && <Vacio texto="No hay tiendas con ese criterio." />}
          {data && data.items.length > 0 && (
            <Tabla columnas={['RUC', 'Nombre comercial', 'Giro', 'Dueño', 'Estado', '']}>
              {data.items.map((t) => (
                <tr key={t.id} className={elegida?.id === t.id ? 'bg-vecino/5' : ''}>
                  <Celda>{t.ruc}</Celda>
                  <Celda>
                    <button
                      type="button"
                      className="text-left font-medium text-vecino-oscuro underline"
                      onClick={() => setElegida(t)}
                    >
                      {t.nombreComercial}
                    </button>
                  </Celda>
                  <Celda>{t.giro}</Celda>
                  <Celda>{t.duenio.nombres}</Celda>
                  <Celda>
                    {/* Se guarda INACTIVO; esta pantalla lo muestra como BAJA (decisión de Adrián). */}
                    <Insignia
                      estado={t.estado}
                      etiqueta={t.estado === 'INACTIVO' ? 'BAJA' : undefined}
                    />
                  </Celda>
                  <Celda>
                    <Link
                      className="text-sm text-vecino-oscuro underline"
                      to={`/admin/auditoria?tiendaId=${t.id}`}
                    >
                      Historial
                    </Link>
                  </Celda>
                </tr>
              ))}
            </Tabla>
          )}
        </Tarjeta>
        <Tarjeta titulo={elegida ? `Editar ${elegida.nombreComercial}` : 'Nueva tienda'}>
          <Formulario tienda={elegida} alTerminar={() => setElegida(null)} />
        </Tarjeta>
      </div>
    </>
  );
}
