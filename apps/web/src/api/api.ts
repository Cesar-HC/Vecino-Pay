import { consulta, pedir } from './cliente';
import type {
  Cliente,
  Compra,
  CompraEntrada,
  Cronograma,
  EstadoRegistro,
  FilaAuditoria,
  Liquidacion,
  Lista,
  ListadoDetalle,
  ListadoResumen,
  Producto,
  ReciboPago,
  ResultadoCorte,
  ResumenNegocio,
  ResumenPlataforma,
  Salud,
  Sesion,
  Simulacion,
  TasaEntrada,
  TasasCalculadas,
  Tienda,
  TiendaCorta,
  Usuario,
  ValorHoy,
} from './tipos';

type Params = Record<string, string | number | undefined>;
type Cuerpo = Record<string, unknown>;

export const api = {
  salud: () => pedir<Salud>('/salud'),

  login: (cuerpo: { username: string; password: string; perfil: string }) =>
    pedir<Sesion & { token: string }>('/auth/login', { metodo: 'POST', cuerpo }),
  yo: () => pedir<Sesion>('/auth/yo'),
  cambiarTienda: (tiendaId: string) =>
    pedir<{ token: string; tienda: TiendaCorta }>('/auth/cambiar-tienda', {
      metodo: 'POST',
      cuerpo: { tiendaId },
    }),

  resumenPlataforma: () => pedir<ResumenPlataforma>('/plataforma/resumen'),
  ejecutarCorte: () => pedir<ResultadoCorte>('/cortes/ejecutar', { metodo: 'POST' }),

  tiendas: (p: Params = {}) => pedir<Lista<Tienda>>(`/tiendas${consulta({ tamano: 200, ...p })}`),
  crearTienda: (cuerpo: Cuerpo) => pedir<Tienda>('/tiendas', { metodo: 'POST', cuerpo }),
  editarTienda: (id: string, cuerpo: Cuerpo) =>
    pedir<Tienda>(`/tiendas/${id}`, { metodo: 'PATCH', cuerpo }),
  estadoTienda: (id: string, estado: EstadoRegistro) =>
    pedir<Tienda>(`/tiendas/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } }),

  usuarios: (p: Params = {}) =>
    pedir<Lista<Usuario>>(`/usuarios${consulta({ tamano: 200, ...p })}`),
  crearUsuario: (cuerpo: Cuerpo) => pedir<Usuario>('/usuarios', { metodo: 'POST', cuerpo }),
  editarUsuario: (id: string, cuerpo: Cuerpo) =>
    pedir<Usuario>(`/usuarios/${id}`, { metodo: 'PATCH', cuerpo }),
  restablecerClave: (id: string, claveTemporal: string) =>
    pedir<void>(`/usuarios/${id}/restablecer-clave`, { metodo: 'POST', cuerpo: { claveTemporal } }),
  estadoUsuario: (id: string, estado: EstadoRegistro) =>
    pedir<Usuario>(`/usuarios/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } }),

  auditoria: (p: Params) => pedir<Lista<FilaAuditoria>>(`/auditoria${consulta(p)}`),

  resumenNegocio: () => pedir<ResumenNegocio>('/negocio/resumen'),

  productos: (p: Params = {}) =>
    pedir<Lista<Producto>>(`/productos${consulta({ tamano: 200, ...p })}`),
  crearProducto: (cuerpo: Cuerpo) => pedir<Producto>('/productos', { metodo: 'POST', cuerpo }),
  editarProducto: (id: string, cuerpo: Cuerpo) =>
    pedir<Producto>(`/productos/${id}`, { metodo: 'PATCH', cuerpo }),
  estadoProducto: (id: string, estado: EstadoRegistro) =>
    pedir<Producto>(`/productos/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } }),

  clientes: (p: Params = {}) =>
    pedir<Lista<Cliente>>(`/clientes${consulta({ tamano: 200, ...p })}`),
  cliente: (id: string) => pedir<Cliente>(`/clientes/${id}`),
  crearCliente: (cuerpo: Cuerpo) => pedir<Cliente>('/clientes', { metodo: 'POST', cuerpo }),
  editarCliente: (id: string, cuerpo: Cuerpo) =>
    pedir<Cliente>(`/clientes/${id}`, { metodo: 'PATCH', cuerpo }),
  estadoCliente: (id: string, estado: EstadoRegistro) =>
    pedir<Cliente>(`/clientes/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } }),
  calcularTasas: (tasa: TasaEntrada) =>
    pedir<TasasCalculadas>('/clientes/calcular-tasas', { metodo: 'POST', cuerpo: { tasa } }),

  simular: (cuerpo: CompraEntrada) =>
    pedir<Simulacion>('/compras/simular', { metodo: 'POST', cuerpo }),
  registrarCompra: (cuerpo: CompraEntrada) => pedir<Compra>('/compras', { metodo: 'POST', cuerpo }),
  compras: (p: Params = {}) => pedir<Lista<Compra>>(`/compras${consulta({ tamano: 200, ...p })}`),
  cronograma: (id: string) => pedir<Cronograma>(`/compras/${id}/cronograma`),

  listados: (p: Params = {}) =>
    pedir<Lista<ListadoResumen>>(`/listados${consulta({ tamano: 200, ...p })}`),
  listado: (id: string) => pedir<ListadoDetalle>(`/listados/${id}`),
  valorHoy: (id: string, fecha?: string) =>
    pedir<ValorHoy>(`/listados/${id}/valor-hoy${consulta({ fecha })}`),
  liquidacion: (id: string) => pedir<Liquidacion>(`/listados/${id}/liquidacion`),
  pagar: (id: string, cuerpo: Cuerpo) =>
    pedir<ReciboPago>(`/listados/${id}/pago`, { metodo: 'POST', cuerpo }),
};
