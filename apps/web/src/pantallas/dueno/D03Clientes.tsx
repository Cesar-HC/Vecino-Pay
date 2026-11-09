import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm, UseFormRegister } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../../api/api';
import type { Cliente, TasaEntrada } from '../../api/tipos';
import { T12 } from '../../contenido/ayudas';
import {
  aEntero,
  mayorQueCero,
  MONTO_DIGITADO,
  PORCENTAJE_DIGITADO,
  porcentajeATantoPorUno,
  tantoPorUnoAPorcentaje,
} from '../../lib/entrada';
import {
  formatearMonto,
  formatearTasa,
  formatearTasaDiaria,
  tasaConEtiqueta,
} from '../../lib/formato';
import { useSesion } from '../../sesion/Sesion';
import {
  Ayuda,
  Boton,
  Campo,
  Cargando,
  Celda,
  claseEntrada,
  Confirmar,
  Dato,
  Franja,
  Insignia,
  mensajeError,
  Modal,
  PanelError,
  Tabla,
  Tarjeta,
  Vacio,
} from '../../ui/base';
import { useEspera } from '../../ui/useEspera';

const PLAZOS = [
  [1, 'Diaria'],
  [15, 'Quincenal'],
  [30, 'Mensual'],
  [60, 'Bimestral'],
  [90, 'Trimestral'],
  [120, 'Cuatrimestral'],
  [180, 'Semestral'],
  [360, 'Anual'],
] as const;

const porcentaje = z
  .string()
  .regex(PORCENTAJE_DIGITADO, 'Escribe la tasa en porcentaje, con hasta 7 decimales.')
  .refine(mayorQueCero, 'La tasa debe ser mayor que cero.');
const esquema = z
  .object({
    dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener 8 dígitos.'),
    nombres: z.string().trim().min(1, 'Escribe los nombres.').max(80),
    apellidos: z.string().trim().min(1, 'Escribe los apellidos.').max(80),
    celular: z
      .string()
      .trim()
      .regex(/^(\d{9,15})?$/, 'El celular debe tener entre 9 y 15 dígitos, sin espacios ni signos.')
      .optional(),
    direccion: z.string().trim().max(200).optional(),
    aceptaDatos: z
      .boolean()
      .refine(
        (v) => v,
        'Debe constar que el cliente aceptó el tratamiento de sus datos personales.',
      ),
    tipoTasa: z.enum(['EFECTIVA', 'NOMINAL']),
    valorTasa: porcentaje,
    plazoTasa: z.coerce.number(),
    capitalizacion: z.coerce.number(),
    moneda: z.enum(['PEN', 'USD']),
    limiteCredito: z
      .string()
      .min(1, 'Escribe el límite de crédito.')
      .regex(
        MONTO_DIGITADO,
        'Escribe el límite solo con números y hasta 2 decimales, sin signo. Ejemplo: 500.00.',
      )
      .refine(mayorQueCero, 'El límite de crédito debe ser mayor que cero.'),
    tipoMora: z.enum(['EFECTIVA', 'NOMINAL']),
    valorMora: porcentaje,
    plazoMora: z.coerce.number(),
    capitalizacionMora: z.coerce.number(),
    maxMeses: z.coerce
      .number()
      .int()
      .min(1, 'El máximo de meses debe estar entre 1 y 12.')
      .max(12, 'El máximo de meses debe estar entre 1 y 12.'),
    diaCorte: z.coerce
      .number()
      .int()
      .min(1, 'El día de corte debe estar entre 1 y 28.')
      .max(28, 'El día de corte debe estar entre 1 y 28.'),
    diaPago: z.coerce
      .number()
      .int()
      .min(1, 'El día de pago debe estar entre 1 y 28.')
      .max(28, 'El día de pago debe estar entre 1 y 28.'),
  })
  .refine((d) => d.diaCorte !== d.diaPago, {
    path: ['diaPago'],
    message: 'El día de pago debe ser distinto del día de corte.',
  })
  .refine((d) => d.tipoTasa !== 'NOMINAL' || d.capitalizacion <= d.plazoTasa, {
    path: ['capitalizacion'],
    message: 'La capitalización no puede ser mayor que el plazo.',
  })
  .refine((d) => d.tipoMora !== 'NOMINAL' || !d.plazoMora || d.capitalizacionMora <= d.plazoMora, {
    path: ['capitalizacionMora'],
    message: 'La capitalización no puede ser mayor que el plazo.',
  });
type Datos = z.infer<typeof esquema>;

const VACIO: Datos = {
  dni: '',
  nombres: '',
  apellidos: '',
  celular: '',
  direccion: '',
  aceptaDatos: false,
  tipoTasa: 'EFECTIVA',
  valorTasa: '45',
  plazoTasa: 360,
  capitalizacion: 1,
  moneda: 'PEN',
  limiteCredito: '500.00',
  tipoMora: 'EFECTIVA',
  valorMora: '10',
  plazoMora: 360,
  capitalizacionMora: 1,
  maxMeses: 3,
  diaCorte: 20,
  diaPago: 26,
};

const tasaEntrada = (
  tipo: 'EFECTIVA' | 'NOMINAL',
  valor: string,
  plazo: number,
  capitalizacion: number,
): TasaEntrada => ({
  tipo,
  valor: porcentajeATantoPorUno(valor),
  plazo,
  ...(tipo === 'NOMINAL' ? { capitalizacion } : {}),
});

const desdeCliente = (c: Cliente): Datos => ({
  dni: c.dni,
  nombres: c.nombres,
  apellidos: c.apellidos,
  celular: c.celular ?? '',
  direccion: c.direccion ?? '',
  aceptaDatos: true,
  tipoTasa: c.tipoTasa as Datos['tipoTasa'],
  valorTasa: tantoPorUnoAPorcentaje(c.valorTasa),
  plazoTasa: c.plazoTasa,
  capitalizacion: c.capitalizacion ?? 1,
  moneda: c.moneda,
  limiteCredito: c.limiteCredito,
  tipoMora: c.tipoTasaMora as Datos['tipoMora'],
  valorMora: tantoPorUnoAPorcentaje(c.valorTasaMora),
  // Plazo y capitalización de la mora no se guardan (decisión de Adrián): se piden solo si la mora cambia.
  plazoMora: 0,
  capitalizacionMora: 0,
  maxMeses: c.maxMeses,
  diaCorte: c.diaCorte,
  diaPago: c.diaPago,
});

const CAMPOS: Record<string, keyof Datos> = {
  DNI_DUPLICADO: 'dni',
  TASA_VALOR: 'valorTasa',
  TASA_PLAZO: 'plazoTasa',
  TASA_CAP_MAYOR: 'capitalizacion',
  TASA_CAP_LISTA: 'capitalizacion',
  MAX_MESES: 'maxMeses',
  CICLO_DIA: 'diaCorte',
  CICLO_DIAS_IGUALES: 'diaPago',
  MONTO: 'limiteCredito',
};

function SelectorPlazo({
  id,
  nombre,
  registrar,
  deshabilitado,
  conVacio,
}: {
  id: string;
  nombre: keyof Datos;
  registrar: UseFormRegister<Datos>;
  deshabilitado?: boolean;
  conVacio?: boolean;
}) {
  return (
    <select
      id={id}
      disabled={deshabilitado}
      className={claseEntrada}
      {...registrar(nombre, { valueAsNumber: true })}
    >
      {conVacio && <option value={0}>Elige si cambias la tasa</option>}
      {PLAZOS.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </select>
  );
}

function FranjaTasas({ tasa }: { tasa: TasaEntrada | null }) {
  const enEspera = useEspera(tasa, 300);
  const { data, error } = useQuery({
    queryKey: ['tasas', enEspera],
    queryFn: () => api.calcularTasas(enEspera as TasaEntrada),
    enabled: !!enEspera,
  });
  if (error) return <Franja tipo="error">{mensajeError(error)}</Franja>;
  if (!data) return null;
  return (
    <dl className="grid gap-2 rounded-lg bg-vecino/5 p-3 text-sm sm:grid-cols-3">
      <Dato etiqueta="TED">{formatearTasaDiaria(data.ted)}</Dato>
      <Dato etiqueta="TEM">{formatearTasa(data.tem)}</Dato>
      <Dato etiqueta="TEA">{formatearTasa(data.tea)}</Dato>
    </dl>
  );
}

function Formulario({
  cliente,
  alGuardar,
}: {
  cliente: Cliente | null;
  alGuardar: (c: Cliente) => void;
}) {
  const consultas = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: cliente ? desdeCliente(cliente) : VACIO,
  });
  useEffect(() => {
    if (cliente) reset(desdeCliente(cliente));
  }, [cliente, reset]);

  const conDeuda = !!cliente && cliente.su !== '0.00';
  const dni = watch('dni');
  const tipo = watch('tipoTasa');
  const valor = watch('valorTasa');
  const plazo = watch('plazoTasa');
  const capitalizacion = watch('capitalizacion');
  const tipoMora = watch('tipoMora');
  const tasa =
    valor && PORCENTAJE_DIGITADO.test(valor) && mayorQueCero(valor)
      ? tasaEntrada(tipo, valor, aEntero(plazo), aEntero(capitalizacion))
      : null;

  const enviar = handleSubmit(async (d) => {
    try {
      let guardado: Cliente;
      if (cliente) {
        const cambios: Record<string, unknown> = {};
        for (const k of [
          'nombres',
          'apellidos',
          'celular',
          'direccion',
          'moneda',
          'limiteCredito',
          'maxMeses',
          'diaCorte',
          'diaPago',
        ] as const) {
          if (dirtyFields[k]) cambios[k] = d[k] ?? '';
        }
        // La API toma la sola presencia de una tasa como cambio de condiciones: se envía solo si cambió.
        if (
          dirtyFields.tipoTasa ||
          dirtyFields.valorTasa ||
          dirtyFields.plazoTasa ||
          dirtyFields.capitalizacion
        )
          cambios.tasa = tasaEntrada(d.tipoTasa, d.valorTasa, d.plazoTasa, d.capitalizacion);
        if (
          dirtyFields.tipoMora ||
          dirtyFields.valorMora ||
          dirtyFields.plazoMora ||
          dirtyFields.capitalizacionMora
        ) {
          // Plazo y capitalización no se guardan: nunca se asumen, porque definen la TED de la mora.
          if (!d.plazoMora) {
            setError('plazoMora', {
              message: 'Indica el plazo de la tasa moratoria que estás cambiando.',
            });
            return;
          }
          if (d.tipoMora === 'NOMINAL' && !d.capitalizacionMora) {
            setError('capitalizacionMora', {
              message: 'Indica la capitalización de la tasa moratoria.',
            });
            return;
          }
          cambios.tasaMora = tasaEntrada(
            d.tipoMora,
            d.valorMora,
            d.plazoMora,
            d.capitalizacionMora,
          );
        }
        if (!Object.keys(cambios).length) {
          setError('root', { message: 'No hay cambios que guardar.' });
          return;
        }
        guardado = await api.editarCliente(cliente.id, cambios);
      } else {
        guardado = await api.crearCliente({
          dni: d.dni,
          nombres: d.nombres,
          apellidos: d.apellidos,
          celular: d.celular || undefined,
          direccion: d.direccion || undefined,
          aceptaDatos: true,
          moneda: d.moneda,
          limiteCredito: d.limiteCredito,
          maxMeses: d.maxMeses,
          diaCorte: d.diaCorte,
          diaPago: d.diaPago,
          tasa: tasaEntrada(d.tipoTasa, d.valorTasa, d.plazoTasa, d.capitalizacion),
          tasaMora: tasaEntrada(d.tipoMora, d.valorMora, d.plazoMora, d.capitalizacionMora),
        });
      }
      consultas.invalidateQueries();
      alGuardar(guardado);
    } catch (e) {
      const c = (e as { codigo?: string }).codigo ?? '';
      const campo = CAMPOS[c];
      if (campo) setError(campo, { message: mensajeError(e) });
      else setError('root', { message: mensajeError(e) });
    }
  });

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4 lg:grid-cols-2">
      <Tarjeta titulo="Datos del cliente">
        <div className="space-y-3">
          <Campo
            etiqueta="DNI"
            ayuda="8 dígitos. También será su usuario en la aplicación."
            error={errors.dni?.message}
          >
            {(id) => (
              <input
                id={id}
                inputMode="numeric"
                disabled={!!cliente}
                className={claseEntrada}
                {...register('dni')}
              />
            )}
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Nombres"
              ayuda="Como figuran en su DNI. Ejemplo: Luis Quispe."
              error={errors.nombres?.message}
            >
              {(id) => <input id={id} className={claseEntrada} {...register('nombres')} />}
            </Campo>
            <Campo
              etiqueta="Apellidos"
              ayuda="Como figuran en su DNI. Ejemplo: Luis Quispe."
              error={errors.apellidos?.message}
            >
              {(id) => <input id={id} className={claseEntrada} {...register('apellidos')} />}
            </Campo>
          </div>
          <Campo
            etiqueta="Celular"
            ayuda="Opcional. Se usa para enviarle el listado por WhatsApp."
            error={errors.celular?.message}
          >
            {(id) => (
              <input id={id} inputMode="tel" className={claseEntrada} {...register('celular')} />
            )}
          </Campo>
          <Campo
            etiqueta="Dirección"
            ayuda="Opcional. Hasta 200 caracteres."
            error={errors.direccion?.message}
          >
            {(id) => <input id={id} className={claseEntrada} {...register('direccion')} />}
          </Campo>
          {!cliente && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Usuario para la aplicación:</span> {dni || 'su DNI'}
              <Ayuda texto="El cliente entra a la aplicación con su DNI, después de activarla con el código que recibe al guardar. Ejemplo: 45872316." />
            </p>
          )}
          {cliente && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Usuario para la aplicación:</span> {cliente.dni} ·{' '}
              {cliente.activado
                ? 'Activado'
                : `Código de activación pendiente: ${cliente.codigoActivacion ?? '—'}`}
            </p>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!!cliente}
              {...register('aceptaDatos')}
            />
            <span>
              El cliente aceptó el tratamiento de sus datos personales (Ley 29733).
              <Ayuda texto="Obligatorio para inscribirlo: la Ley 29733 exige su consentimiento. Queda registrado en la auditoría." />
            </span>
          </label>
          {errors.aceptaDatos && (
            <p role="alert" className="text-sm text-red-700">
              {errors.aceptaDatos.message}
            </p>
          )}
        </div>
      </Tarjeta>
      <Tarjeta titulo="Condiciones de crédito">
        <div className="space-y-3">
          {conDeuda && (
            <Franja tipo="aviso">
              No se pueden cambiar tasas, moneda ni días mientras el cliente tiene deuda: un listado
              emitido no cambia.
            </Franja>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Tipo de tasa" ayuda={T12.tipoTasa} error={errors.tipoTasa?.message}>
              {(id) => (
                <select
                  id={id}
                  disabled={conDeuda}
                  className={claseEntrada}
                  {...register('tipoTasa')}
                >
                  <option value="EFECTIVA">Efectiva</option>
                  <option value="NOMINAL">Nominal</option>
                </select>
              )}
            </Campo>
            <Campo
              etiqueta="Valor de la tasa (%)"
              ayuda={T12.valorTasa}
              error={errors.valorTasa?.message}
            >
              {(id) => (
                <input
                  id={id}
                  inputMode="decimal"
                  disabled={conDeuda}
                  className={claseEntrada}
                  {...register('valorTasa')}
                />
              )}
            </Campo>
            <Campo
              etiqueta="Plazo de la tasa"
              ayuda="El período al que se refiere la tasa. TEA 45 % es 45 % al año."
              error={errors.plazoTasa?.message}
            >
              {(id) => (
                <SelectorPlazo
                  id={id}
                  nombre="plazoTasa"
                  registrar={register}
                  deshabilitado={conDeuda}
                />
              )}
            </Campo>
            {tipo === 'NOMINAL' && (
              <Campo
                etiqueta="Capitalización"
                ayuda={T12.capitalizacion}
                error={errors.capitalizacion?.message}
              >
                {(id) => (
                  <SelectorPlazo
                    id={id}
                    nombre="capitalizacion"
                    registrar={register}
                    deshabilitado={conDeuda}
                  />
                )}
              </Campo>
            )}
          </div>
          <FranjaTasas tasa={tasa} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Moneda"
              ayuda="Moneda en la que se lleva la deuda del cliente."
              error={errors.moneda?.message}
            >
              {(id) => (
                <select
                  id={id}
                  disabled={conDeuda}
                  className={claseEntrada}
                  {...register('moneda')}
                >
                  <option value="PEN">Soles (S/)</option>
                  <option value="USD">Dólares (US$)</option>
                </select>
              )}
            </Campo>
            <Campo
              etiqueta="Límite de crédito"
              ayuda={T12.limiteCredito}
              error={errors.limiteCredito?.message}
            >
              {(id) => (
                <input
                  id={id}
                  inputMode="decimal"
                  className={claseEntrada}
                  {...register('limiteCredito')}
                />
              )}
            </Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Tipo de tasa moratoria"
              ayuda={T12.tasaMoratoria}
              error={errors.tipoMora?.message}
            >
              {(id) => (
                <select
                  id={id}
                  disabled={conDeuda}
                  className={claseEntrada}
                  {...register('tipoMora')}
                >
                  <option value="EFECTIVA">Efectiva</option>
                  <option value="NOMINAL">Nominal</option>
                </select>
              )}
            </Campo>
            <Campo
              etiqueta="Tasa moratoria (%)"
              ayuda={T12.tasaMoratoria}
              error={errors.valorMora?.message}
            >
              {(id) => (
                <input
                  id={id}
                  inputMode="decimal"
                  disabled={conDeuda}
                  className={claseEntrada}
                  {...register('valorMora')}
                />
              )}
            </Campo>
            <Campo
              etiqueta="Plazo de la mora"
              ayuda={
                cliente
                  ? 'No se guarda: indícalo solo si cambias la tasa moratoria.'
                  : 'El período al que se refiere la tasa moratoria.'
              }
              error={errors.plazoMora?.message}
            >
              {(id) => (
                <SelectorPlazo
                  id={id}
                  nombre="plazoMora"
                  registrar={register}
                  deshabilitado={conDeuda}
                  conVacio={!!cliente}
                />
              )}
            </Campo>
            {tipoMora === 'NOMINAL' && (
              <Campo
                etiqueta="Capitalización de la mora"
                ayuda={T12.capitalizacion}
                error={errors.capitalizacionMora?.message}
              >
                {(id) => (
                  <SelectorPlazo
                    id={id}
                    nombre="capitalizacionMora"
                    registrar={register}
                    deshabilitado={conDeuda}
                    conVacio={!!cliente}
                  />
                )}
              </Campo>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo
              etiqueta="Máximo de meses"
              ayuda="Cuántas cuotas puede pedir el cliente, de 1 a 12."
              error={errors.maxMeses?.message}
            >
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={1}
                  max={12}
                  className={claseEntrada}
                  {...register('maxMeses')}
                />
              )}
            </Campo>
            <Campo
              etiqueta="Día de corte"
              ayuda={T12.fechaCortePago}
              error={errors.diaCorte?.message}
            >
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={1}
                  max={28}
                  disabled={conDeuda}
                  className={claseEntrada}
                  {...register('diaCorte')}
                />
              )}
            </Campo>
            <Campo
              etiqueta="Día de pago"
              ayuda={T12.fechaCortePago}
              error={errors.diaPago?.message}
            >
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={1}
                  max={28}
                  disabled={conDeuda}
                  className={claseEntrada}
                  {...register('diaPago')}
                />
              )}
            </Campo>
          </div>
          <p className="text-xs text-gray-500">El cierre es a las 17:00, hora fija del sistema.</p>
          {errors.root && <Franja tipo="error">{errors.root.message}</Franja>}
          <Boton type="submit" disabled={isSubmitting}>
            Guardar
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}

const etiquetaCliente = (c: Cliente) =>
  tasaConEtiqueta(c.tipoTasa, c.valorTasa, c.plazoTasa, c.capitalizacion);

export function D03Lista() {
  const { sesion } = useSesion();
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [codigo, setCodigo] = useState<{ id: string; valor: string } | null>(null);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['clientes', sesion?.tienda?.id, texto],
    queryFn: () => api.clientes({ texto }),
  });
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-vecino-oscuro">Clientes y condiciones</h1>
        <Boton onClick={() => setNuevo((v) => !v)}>{nuevo ? 'Cerrar' : 'Nuevo cliente'}</Boton>
      </div>
      {nuevo && (
        <Formulario
          cliente={null}
          alGuardar={(c) => {
            setNuevo(false);
            setCodigo({ id: c.id, valor: c.codigoActivacion ?? '' });
          }}
        />
      )}
      <Tarjeta>
        <input
          aria-label="Buscar cliente"
          placeholder="Buscar por nombre o DNI"
          className={`${claseEntrada} mb-3`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        {isLoading && <Cargando />}
        {error && <PanelError error={error} reintentar={refetch} />}
        {data && !data.items.length && <Vacio texto="Aún no tienes clientes con ese criterio." />}
        {data && data.items.length > 0 && (
          <Tabla columnas={['Cliente', 'DNI', 'Tasa', 'Límite', 'Disponible', 'Estado']}>
            {data.items.map((c) => (
              <tr key={c.id}>
                <Celda>
                  <Link
                    className="font-medium text-vecino-oscuro underline"
                    to={`/dueno/clientes/${c.id}`}
                  >
                    {c.nombres} {c.apellidos}
                  </Link>
                </Celda>
                <Celda>{c.dni}</Celda>
                <Celda>{etiquetaCliente(c)}</Celda>
                <Celda derecha>{formatearMonto(c.limiteCredito, c.moneda)}</Celda>
                <Celda derecha>{formatearMonto(c.disponible, c.moneda)}</Celda>
                <Celda>
                  <Insignia estado={c.estado} />
                </Celda>
              </tr>
            ))}
          </Tabla>
        )}
      </Tarjeta>
      {codigo && (
        <Modal titulo="Código de activación" alCerrar={() => setCodigo(null)}>
          <p className="text-sm text-gray-700">
            Entrégaselo al cliente para que active su cuenta. Sigue visible en su ficha mientras
            esté pendiente.
          </p>
          <p className="my-3 text-center text-2xl font-bold tracking-wider text-vecino-oscuro">
            {codigo.valor}
          </p>
          <div className="flex justify-end gap-2">
            <Boton
              variante="secundario"
              onClick={() => navigator.clipboard?.writeText(codigo.valor)}
            >
              Copiar
            </Boton>
            <Boton onClick={() => navegar(`/dueno/clientes/${codigo.id}`)}>Ver ficha</Boton>
          </div>
        </Modal>
      )}
    </>
  );
}

export function D03Ficha() {
  const { id = '' } = useParams();
  const { sesion } = useSesion();
  const consultas = useQueryClient();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['cliente', sesion?.tienda?.id, id],
    queryFn: () => api.cliente(id),
  });
  const [bajar, setBajar] = useState(false);
  const [hecho, setHecho] = useState(false);
  const baja = useMutation({
    mutationFn: () => api.estadoCliente(id, 'INACTIVO'),
    onSuccess: () => {
      consultas.invalidateQueries();
      setBajar(false);
    },
    onError: () => setBajar(false),
  });
  if (isLoading) return <Cargando />;
  if (error || !data) return <PanelError error={error} reintentar={refetch} />;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/dueno/clientes" className="text-sm text-vecino-oscuro underline">
            ← Clientes
          </Link>
          <h1 className="text-2xl font-bold text-vecino-oscuro">
            {data.nombres} {data.apellidos}
          </h1>
        </div>
        <Boton
          variante="peligro"
          disabled={data.estado === 'INACTIVO'}
          onClick={() => setBajar(true)}
        >
          Dar de baja
        </Boton>
      </div>
      <Tarjeta>
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <Dato etiqueta="Estado">
            <Insignia estado={data.estado} />
          </Dato>
          <Dato etiqueta="Capital pendiente">{formatearMonto(data.su, data.moneda)}</Dato>
          <Dato etiqueta="Disponible">{formatearMonto(data.disponible, data.moneda)}</Dato>
          <Dato etiqueta="Uso del límite">{data.usoPorcentaje} %</Dato>
        </dl>
      </Tarjeta>
      {baja.error && <Franja tipo="error">{mensajeError(baja.error)}</Franja>}
      {hecho && <Franja tipo="exito">Cambios guardados.</Franja>}
      <Formulario cliente={data} alGuardar={() => setHecho(true)} />
      {bajar && (
        <Confirmar
          titulo="Dar de baja"
          texto="Bloquea compras nuevas y el acceso; la deuda se sigue cobrando."
          accion="Dar de baja"
          ocupado={baja.isPending}
          alConfirmar={() => baja.mutate()}
          alCerrar={() => setBajar(false)}
        />
      )}
    </>
  );
}
