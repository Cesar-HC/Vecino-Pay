// Contrato JSON de la API (docs/diseno/fase-3.md, sección 9). Montos y tasas son texto: la web no calcula con ellos.
export type Monto = string;
export type Tasa = string;
export type Moneda = 'PEN' | 'USD';
export type Perfil = 'ADMIN_SISTEMA' | 'DUENO' | 'CLIENTE';
export type EstadoRegistro = 'ACTIVO' | 'INACTIVO';

export interface Lista<T> {
  items: T[];
  total: number;
}

export interface Salud {
  estado: string;
  fechaLima: string;
  horaLima: string;
  horaCorte: string;
  fechaOperativa: string;
  relojFijo: boolean;
}

export interface TiendaCorta {
  id: string;
  nombreComercial: string;
}

export interface Sesion {
  usuario: { id: string; username: string; nombres: string; perfil: Perfil };
  tienda?: TiendaCorta;
  tiendas: TiendaCorta[];
  cliente?: { id: string; numeroCuenta: string };
}

export interface ResumenPlataforma {
  tiendasActivas: number;
  usuariosActivos: number;
  clientesRegistrados: number;
  operacionesHoy: number;
  altasPorMes: { mes: string; cantidad: number }[];
  operacionesPorDia: { fecha: string; cantidad: number }[];
  tiendasPorGiro: { giro: string; cantidad: number }[];
  ultimasOperaciones: {
    fechaHora: string;
    usuario: string | null;
    tienda: string | null;
    accion: string;
    tabla: string;
  }[];
}

export interface ResultadoCorte {
  fecha: string;
  listadosEmitidos: { numero: string; clienteId: string }[];
  omitidos: number;
  vencidos: number;
  errores: { clienteId: string; mensaje: string }[];
}

export interface Tienda {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  giro: string;
  telefono: string | null;
  direccion: string | null;
  cokTea: Tasa;
  estado: EstadoRegistro;
  duenio: { id: string; username: string; nombres: string; estado: EstadoRegistro };
}

export interface Usuario {
  id: string;
  username: string;
  nombres: string;
  perfil: Perfil;
  tienda: TiendaCorta | null;
  tiendas: TiendaCorta[];
  ultimoAcceso: string | null;
  estado: EstadoRegistro;
}

export interface FilaAuditoria {
  id: string;
  fechaHora: string;
  usuario: string | null;
  tienda: string | null;
  accion: string;
  tabla: string;
  registroId: string | null;
  detalle: string | null;
}

export interface ResumenMoneda {
  capitalPorCobrar: Monto;
  cobroProximo: { fecha: string; total: Monto } | null;
  interesesDelCiclo: Monto;
  carteraEnMora: Monto;
  vanAcumulado: Monto;
  ventasPorSemana: { semana: string; monto: Monto }[];
  ventasPorModalidad: { modalidad: string; monto: Monto }[];
  cobrosPorFecha: { fecha: string; total: Monto }[];
  usoLimite: { cliente: string; su: Monto; limite: Monto; usoPorcentaje: string }[];
  productosMasVendidos: { codigo: string; nombre: string; cantidad: string; subtotal: Monto }[];
}

export interface ResumenNegocio {
  fecha: string;
  cokTea: Tasa;
  clientes: number;
  porMoneda: Partial<Record<Moneda, ResumenMoneda>>;
}

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  marca: string | null;
  descripcion: string | null;
  unidad: string;
  proveedor: string | null;
  imagenUrl: string | null;
  precioContado: Monto;
  precioLista: Monto;
  permiteFinMes: boolean;
  permiteCuotas: boolean;
  estado: EstadoRegistro;
}

export interface Cliente {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  celular: string | null;
  direccion: string | null;
  moneda: Moneda;
  limiteCredito: Monto;
  maxMeses: number;
  diaCorte: number;
  horaCorte: string;
  diaPago: number;
  tipoTasa: string;
  valorTasa: Tasa;
  plazoTasa: number;
  capitalizacion: number | null;
  tipoTasaMora: string;
  valorTasaMora: Tasa;
  ted: Tasa;
  tedMora: Tasa;
  activado: boolean;
  estado: EstadoRegistro;
  su: Monto;
  disponible: Monto;
  usoPorcentaje: string;
  codigoActivacion?: string | null;
  deudaALaFecha?: Monto;
}

export interface TasaEntrada {
  tipo: 'EFECTIVA' | 'NOMINAL';
  valor: string;
  plazo: number;
  capitalizacion?: number;
}

export interface TasasCalculadas {
  ted: Tasa;
  tem: Tasa;
  tea: Tasa;
}

export interface FilaCuota {
  numero: number;
  vence: string;
  diasPeriodo: number;
  t?: number;
  valorActual?: Monto;
  saldoInicial: Monto;
  interes: Monto;
  amortizacion: Monto;
  monto: Monto;
  saldoFinal: Monto;
  estado?: string;
}

export interface Simulacion {
  lineas: {
    productoId: string;
    codigo: string;
    nombre: string;
    cantidad: string;
    precioLista: Monto;
    precioContado: Monto;
    subtotal: Monto;
    subtotalContado: Monto;
  }[];
  montoLista: Monto;
  montoContado: Monto;
  fechaOperativa: string;
  fechaCorte: string;
  fechaPago: string;
  limite: {
    aceptada: boolean;
    disponible: Monto;
    limite: Monto;
    su: Monto;
    usoActualPorcentaje: string;
    usoConCompraPorcentaje: string;
    mensaje?: string;
  };
  finMes?: { dias: number; interes: Monto; total: Monto };
  cuotas?: {
    g: number;
    capitalCapitalizado: Monto;
    interesGracia: Monto;
    cuotaFija: Monto;
    ultimaCuota: Monto;
    primeraCuota: string;
    tcea: Tasa;
    tceaPorcentaje: string;
    van: Monto;
    tirDiaria: string;
    cokTea: Tasa;
    sumaValorActual: Monto;
    filas: FilaCuota[];
  };
}

export interface CompraEntrada {
  clienteId: string;
  modalidad: 'FIN_MES' | 'CUOTAS';
  numCuotas?: number;
  items: { productoId: string; cantidad: string }[];
}

export interface Compra {
  id: string;
  ticket: string;
  clienteId: string;
  fechaHora: string;
  fechaOperativa: string;
  modalidad: 'FIN_MES' | 'CUOTAS';
  montoLista: Monto;
  montoContado: Monto;
  fechaCorte: string;
  fechaPago: string;
  numCuotas: number | null;
  tceaPorcentaje: string | null;
  cuotaFija: Monto | null;
  van: Monto | null;
  estado: string;
}

export interface Cronograma {
  compra: {
    id: string;
    ticket: string;
    clienteId: string;
    cliente: string;
    moneda: Moneda;
    fechaHora: string;
    fechaOperativa: string;
    fechaPago: string;
    montoLista: Monto;
    montoContado: Monto;
  };
  resumen: {
    montoCredito: Monto;
    diasGracia: number;
    capitalCapitalizado: Monto;
    interesGracia: Monto;
    interesCuotas: Monto;
    interesesTotales: Monto;
    cuotaFija: Monto;
    tcea: Tasa;
    tceaPorcentaje: string;
    tirDiaria: string;
    van: Monto;
  };
  filas: FilaCuota[];
  totales: { interes: Monto; amortizacion: Monto; monto: Monto };
  flujoCaja: {
    cokTea: Tasa;
    filas: { momento: number; t: number; flujo: Monto; valorActual: Monto }[];
    sumaValorActual: Monto;
    van: Monto;
    cokVigenteCoincide: boolean;
  };
}

export type EstadoListado = 'EMITIDO' | 'PAGADO' | 'VENCIDO';

export interface ListadoResumen {
  id: string;
  numero: string;
  clienteId: string;
  fechaCorte: string;
  horaCorte: string;
  fechaPago: string;
  totalCapital: Monto;
  totalInteres: Monto;
  totalMora: Monto;
  total: Monto;
  estado: EstadoListado;
  estadoEfectivo: EstadoListado;
  fechaPagoReal: string | null;
  diasMora: number | null;
}

export interface ItemListado {
  orden: number;
  tipo: 'COMPRA' | 'CUOTA' | 'MORA';
  ticket: string | null;
  compraId?: string | null;
  cuotaNumero: number | null;
  detalle: {
    codigo: string;
    nombre: string;
    unidad: string;
    cantidad: string;
    precioLista: Monto;
    subtotal: Monto;
  }[];
  fechaHoraRegistro: string | null;
  fecha: string;
  posteriorAlCorte: boolean;
  dias: number;
  capital: Monto;
  interes: Monto;
  mora: Monto;
  total: Monto;
}

export interface ListadoDetalle extends ListadoResumen {
  moneda: Moneda;
  cliente: string;
  tasa: Tasa;
  items: ItemListado[];
  comprasPosteriores: {
    ticket: string;
    fechaHora: string;
    fechaOperativa: string;
    monto: Monto;
    fechaPago: string;
  }[];
  moraALaFecha?: { diasMora: number; mora: Monto; totalALaFecha: Monto };
}

export interface ValorHoy {
  td: number;
  te: Tasa;
  d: Tasa;
  descuento: Monto;
  neto: Monto;
}

export interface Imputacion {
  mora: Monto;
  interes: Monto;
  capital: Monto;
}

export interface Liquidacion {
  fechaReal: string;
  horaReal: string;
  fechaOperativaPago: string;
  diasMora: number;
  mora: Monto;
  totalALaFecha: Monto;
  imputacion: Imputacion;
  disponibleDespues: Monto;
}

export interface ReciboPago {
  pago: {
    id: string;
    fecha: string;
    hora: string;
    monto: Monto;
    medioPago: string;
    numeroOperacion: string | null;
    diasMora: number;
  };
  imputacion: Imputacion;
  listado: { id: string; numero: string; estado: string; total: Monto };
  disponible: Monto;
}

/** Tasa pactada con la tienda, tal como la devuelve /api/mi: el valor viene como tanto por uno. */
export interface TasaPactada {
  tipo: string;
  valor: Tasa;
  plazo: number;
  capitalizacion: number | null;
}

export interface MiResumen {
  cliente: { nombre: string; numeroCuenta: string };
  tienda: { nombreComercial: string };
  moneda: Moneda;
  proximoPago: {
    total: Monto;
    capital: Monto;
    interes: Monto;
    mora: Monto;
    totalALaFecha: Monto;
    fecha: string;
    diasRestantes: number;
    proyectado: boolean;
  } | null;
  credito: {
    limite: Monto;
    usado: Monto;
    disponible: Monto;
    usoPorcentaje: string;
  };
  comprasPorSemana: { semana: string; monto: Monto }[];
  comprasDelCiclo: number;
  tasa: TasaPactada;
}

export interface MiCuotaCompra {
  ticket: string;
  cuotaFija: Monto | null;
  tcea: string | null;
  tceaPorcentaje: string | null;
  proximaCuota: { numero: number; vence: string; monto: Monto } | null;
  filas: { numero: number; vence: string; monto: Monto; estado: string }[];
  explicacion: {
    fechaCompra: string;
    fechaPago: string;
    g: number;
    interesGracia: Monto;
    montoLista: Monto;
    capitalCapitalizado: Monto;
  };
}

export interface MiCuotas {
  compras: MiCuotaCompra[];
}

export interface MiPagoFila {
  fecha: string;
  medioPago: string;
  numeroOperacion: string | null;
  monto: Monto;
  diasMora: number;
  imputacion: Imputacion;
  listadoNumero: string;
}

export interface MiPagos {
  pagos: MiPagoFila[];
  disponible: Monto;
}

export interface MiPerfil {
  id: string;
  numeroCuenta: string;
  dni: string;
  nombres: string;
  apellidos: string;
  celular: string;
  direccion: string | null;
  moneda: Moneda;
  limiteCredito: Monto;
  maxMeses: number;
  diaCorte: number;
  horaCorte: string;
  diaPago: number;
  tasa: TasaPactada;
  tasaMora: { tipo: string; valor: Tasa };
}

export interface MiEjemplo {
  ticket: string;
  capital: Monto;
  ted: string;
  dias: number;
  factor: string;
  interes: Monto;
  total: Monto;
}

export interface ActivarEntrada {
  dni: string;
  codigo: string;
  celular: string;
  password: string;
  passwordConfirmacion: string;
  aceptaDatos: boolean;
}

export interface CambiarClaveEntrada {
  actual: string;
  nueva: string;
}
