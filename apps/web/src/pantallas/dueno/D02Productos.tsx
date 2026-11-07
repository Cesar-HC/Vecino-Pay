import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../../api/api';
import type { Producto } from '../../api/tipos';
import { listaMenorQueContado, mayorQueCero } from '../../lib/entrada';
import { formatearMonto } from '../../lib/formato';
import { useSesion } from '../../sesion/Sesion';
import {
  Ayuda,
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

const PRECIO = /^\d{1,8}(\.\d{1,2})?$/;
const esquema = z
  .object({
    codigo: z.string().trim().min(1, 'Escribe el código.').max(30),
    nombre: z.string().trim().min(1, 'Escribe el nombre.').max(120),
    marca: z.string().trim().max(60).optional(),
    descripcion: z.string().trim().max(500).optional(),
    unidad: z.string().trim().min(1, 'Escribe la unidad.').max(5),
    proveedor: z.string().trim().max(150).optional(),
    imagenUrl: z
      .string()
      .trim()
      .max(300)
      .regex(/^$|^https?:\/\/\S+\.(jpg|jpeg|png)$/i, 'La imagen debe ser una URL .jpg o .png.')
      .optional(),
    precioContado: z
      .string()
      .regex(PRECIO, 'El precio admite hasta 2 decimales.')
      .refine(mayorQueCero, 'El precio contado debe ser mayor que cero.'),
    precioLista: z.string().regex(PRECIO, 'El precio admite hasta 2 decimales.'),
    permiteFinMes: z.boolean(),
    permiteCuotas: z.boolean(),
  })
  .refine(
    (d) =>
      !PRECIO.test(d.precioContado) ||
      !PRECIO.test(d.precioLista) ||
      !listaMenorQueContado(d.precioContado, d.precioLista),
    {
      path: ['precioLista'],
      message: 'El precio de lista debe ser mayor o igual que el precio contado.',
    },
  )
  .refine((d) => d.permiteFinMes || d.permiteCuotas, {
    path: ['permiteCuotas'],
    message: 'El producto debe permitir al menos una modalidad de venta.',
  });
type Datos = z.infer<typeof esquema>;

const VACIO: Datos = {
  codigo: '',
  nombre: '',
  marca: '',
  descripcion: '',
  unidad: 'UND',
  proveedor: '',
  imagenUrl: '',
  precioContado: '',
  precioLista: '',
  permiteFinMes: true,
  permiteCuotas: false,
};
const CAMPOS: Record<string, keyof Datos> = {
  CODIGO_DUPLICADO: 'codigo',
  PRECIO_LISTA: 'precioLista',
  PRECIO_CONTADO: 'precioContado',
  MODALIDAD: 'permiteCuotas',
};

function Formulario({
  producto,
  alTerminar,
}: {
  producto: Producto | null;
  alTerminar: () => void;
}) {
  const cliente = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Datos>({ resolver: zodResolver(esquema), defaultValues: VACIO });
  const [bajar, setBajar] = useState(false);
  const imagen = watch('imagenUrl');

  useEffect(() => {
    reset(
      producto
        ? {
            codigo: producto.codigo,
            nombre: producto.nombre,
            marca: producto.marca ?? '',
            descripcion: producto.descripcion ?? '',
            unidad: producto.unidad,
            proveedor: producto.proveedor ?? '',
            imagenUrl: producto.imagenUrl ?? '',
            precioContado: producto.precioContado,
            precioLista: producto.precioLista,
            permiteFinMes: producto.permiteFinMes,
            permiteCuotas: producto.permiteCuotas,
          }
        : VACIO,
    );
  }, [producto, reset]);

  const baja = useMutation({
    mutationFn: () => api.estadoProducto((producto as Producto).id, 'INACTIVO'),
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
      if (producto) {
        // Solo lo que cambió: "" vacía una columna opcional.
        const cambios = Object.fromEntries(
          Object.keys(dirtyFields).map((k) => [k, d[k as keyof Datos]]),
        );
        if (!Object.keys(cambios).length) {
          setError('root', { message: 'No hay cambios que guardar.' });
          return;
        }
        await api.editarProducto(producto.id, cambios);
      } else {
        const opcionales = {
          marca: d.marca,
          descripcion: d.descripcion,
          proveedor: d.proveedor,
          imagenUrl: d.imagenUrl,
        };
        const conValor = Object.fromEntries(Object.entries(opcionales).filter(([, v]) => v));
        await api.crearProducto({
          codigo: d.codigo,
          nombre: d.nombre,
          unidad: d.unidad,
          precioContado: d.precioContado,
          precioLista: d.precioLista,
          permiteFinMes: d.permiteFinMes,
          permiteCuotas: d.permiteCuotas,
          ...conValor,
        });
      }
      cliente.invalidateQueries();
      reset(VACIO);
      alTerminar();
    } catch (e) {
      const c = (e as { codigo?: string }).codigo;
      const campo = c ? CAMPOS[c] : undefined;
      if (campo) setError(campo, { message: mensajeError(e) });
      else setError('root', { message: mensajeError(e) });
    }
  });

  return (
    <form onSubmit={enviar} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Código"
          ayuda="Identifica al producto en tu catálogo; no se repite. Ejemplo: P001."
          error={errors.codigo?.message}
        >
          {(id) => <input id={id} className={claseEntrada} {...register('codigo')} />}
        </Campo>
        <Campo
          etiqueta="Unidad"
          ayuda="Cómo se vende: UND, KG o L. Hasta 5 caracteres."
          error={errors.unidad?.message}
        >
          {(id) => <input id={id} className={claseEntrada} {...register('unidad')} />}
        </Campo>
      </div>
      <Campo
        etiqueta="Nombre"
        ayuda="Nombre con el que verás el producto al registrar una compra."
        error={errors.nombre?.message}
      >
        {(id) => <input id={id} className={claseEntrada} {...register('nombre')} />}
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Marca"
          ayuda="Opcional. Hasta 60 caracteres."
          error={errors.marca?.message}
        >
          {(id) => <input id={id} className={claseEntrada} {...register('marca')} />}
        </Campo>
        <Campo
          etiqueta="Proveedor"
          ayuda="Opcional. Quién te vende el producto."
          error={errors.proveedor?.message}
        >
          {(id) => <input id={id} className={claseEntrada} {...register('proveedor')} />}
        </Campo>
      </div>
      <Campo
        etiqueta="Descripción"
        ayuda="Opcional. Hasta 500 caracteres."
        error={errors.descripcion?.message}
      >
        {(id) => (
          <textarea id={id} rows={2} className={claseEntrada} {...register('descripcion')} />
        )}
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Precio contado (S/)"
          ayuda="Lo que cobras al contado. Es la base del VAN: lo que recibirías si no dieras crédito."
          error={errors.precioContado?.message}
        >
          {(id) => (
            <input
              id={id}
              inputMode="decimal"
              className={claseEntrada}
              {...register('precioContado')}
            />
          )}
        </Campo>
        <Campo
          etiqueta="Precio de lista (S/)"
          ayuda="Lo que cobras al fiado. Debe ser mayor o igual que el precio contado."
          error={errors.precioLista?.message}
        >
          {(id) => (
            <input
              id={id}
              inputMode="decimal"
              className={claseEntrada}
              {...register('precioLista')}
            />
          )}
        </Campo>
      </div>
      <Campo
        etiqueta="Imagen (URL)"
        ayuda="Opcional. Dirección de una imagen .jpg o .png. Ejemplo: https://misitio.pe/arroz.jpg."
        error={errors.imagenUrl?.message}
      >
        {(id) => (
          <input id={id} inputMode="url" className={claseEntrada} {...register('imagenUrl')} />
        )}
      </Campo>
      {imagen && !errors.imagenUrl && (
        <img
          src={imagen}
          alt="Vista previa del producto"
          className="h-20 w-20 rounded-lg border object-cover"
        />
      )}
      <fieldset className="space-y-1">
        <legend className="flex items-center text-sm font-medium text-gray-700">
          Modalidades de venta
          <Ayuda texto="Cómo se puede vender: a fin de mes, en cuotas o de ambas formas. Ejemplo: una olla en cuotas y el arroz a fin de mes." />
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('permiteFinMes')} /> A fin de mes
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('permiteCuotas')} /> En cuotas
        </label>
        {errors.permiteCuotas && (
          <p role="alert" className="text-sm text-red-700">
            {errors.permiteCuotas.message}
          </p>
        )}
      </fieldset>
      {errors.root && <Franja tipo="error">{errors.root.message}</Franja>}
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" disabled={isSubmitting}>
          Guardar
        </Boton>
        {producto && (
          <>
            <Boton
              variante="peligro"
              disabled={producto.estado === 'INACTIVO'}
              onClick={() => setBajar(true)}
            >
              Dar de baja
            </Boton>
            <Boton variante="secundario" onClick={alTerminar}>
              Nuevo producto
            </Boton>
          </>
        )}
      </div>
      {bajar && producto && (
        <Confirmar
          titulo="Dar de baja"
          texto={`${producto.nombre} ya no se podrá vender. Las compras hechas se conservan.`}
          accion="Dar de baja"
          ocupado={baja.isPending}
          alConfirmar={() => baja.mutate()}
          alCerrar={() => setBajar(false)}
        />
      )}
    </form>
  );
}

export default function D02Productos() {
  const { sesion } = useSesion();
  const [texto, setTexto] = useState('');
  const [elegido, setElegido] = useState<Producto | null>(null);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['productos', sesion?.tienda?.id, texto],
    queryFn: () => api.productos({ texto }),
  });
  return (
    <>
      <h1 className="text-2xl font-bold text-vecino-oscuro">Catálogo de productos</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <input
            aria-label="Buscar producto"
            placeholder="Buscar por nombre o código"
            className={`${claseEntrada} mb-3`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          {isLoading && <Cargando />}
          {error && <PanelError error={error} reintentar={refetch} />}
          {data && !data.items.length && <Vacio texto="No hay productos con ese criterio." />}
          {data && data.items.length > 0 && (
            <Tabla columnas={['Código', 'Nombre', 'Contado', 'Lista', 'Modalidades', 'Estado']}>
              {data.items.map((p) => (
                <tr key={p.id} className={elegido?.id === p.id ? 'bg-vecino/5' : ''}>
                  <Celda>{p.codigo}</Celda>
                  <Celda>
                    <button
                      type="button"
                      className="text-left font-medium text-vecino-oscuro underline"
                      onClick={() => setElegido(p)}
                    >
                      {p.nombre}
                    </button>
                  </Celda>
                  <Celda derecha>{formatearMonto(p.precioContado)}</Celda>
                  <Celda derecha>{formatearMonto(p.precioLista)}</Celda>
                  <Celda>
                    {[p.permiteFinMes && 'Fin de mes', p.permiteCuotas && 'Cuotas']
                      .filter(Boolean)
                      .join(', ')}
                  </Celda>
                  <Celda>
                    <Insignia estado={p.estado} />
                  </Celda>
                </tr>
              ))}
            </Tabla>
          )}
        </Tarjeta>
        <Tarjeta titulo={elegido ? `Editar ${elegido.nombre}` : 'Nuevo producto'}>
          <Formulario producto={elegido} alTerminar={() => setElegido(null)} />
        </Tarjeta>
      </div>
    </>
  );
}
