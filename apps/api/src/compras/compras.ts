import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { compra, cuota } from '@prisma/client';
import {
  aDec,
  asignarCiclo,
  cuantizarTasa,
  Dec,
  diasEntre,
  ErrorFinanciero,
  fechaOperativaLocal,
  evaluarLimite,
  indicadoresVenta,
  interesCompra,
  Moneda,
  PartesLima,
  red,
  simularVentaEnCuotas,
  tem,
  usoLimite,
  validarModalidad,
} from '@vecinopay/finance';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, Matches, ValidateIf, ValidateNested } from 'class-validator';
import { Ambito } from '../bd/ambito-tienda';
import { BdService, TrabajoTienda } from '../bd/bd.service';
import { aDecBd, aFechaBd, aInstanteBd, deFechaBd, dePartesBd } from '../bd/conversiones';
import { comprasParaSu } from '../clientes/clientes';
import { calcularSu } from '../clientes/saldos';
import { ErrorNegocio, noExiste } from '../comun/error-negocio';
import { aId, aPorcentaje, aSoles, aTasa, conSimbolo, ContextoDueno, Ctx, IsIdTexto, Opcional, PaginaDto, paginar, ParseIdPipe, Roles } from '../comun/utilidades';

export class ItemCompraDto {
  @IsIdTexto() productoId: string;
  @Matches(/^\d{1,7}(\.\d{1,3})?$/, { message: 'La cantidad debe ser texto, con hasta 3 decimales.' }) cantidad: string;
}

export class CompraDto {
  @IsIdTexto() clienteId: string;
  @IsIn(['FIN_MES', 'CUOTAS']) modalidad: 'FIN_MES' | 'CUOTAS';
  // Obligatorio con CUOTAS; con FIN_MES se rechaza abajo.
  @ValidateIf((o) => o.modalidad === 'CUOTAS' || o.numCuotas !== undefined) @IsInt() numCuotas?: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ItemCompraDto) items: ItemCompraDto[];
}

export class FiltroComprasDto extends PaginaDto {
  @Opcional() @IsIdTexto() clienteId?: string;
  @Opcional() @IsIn(['PENDIENTE', 'PAGADA', 'ANULADA']) estado?: string;
  @Opcional() @IsIn(['FIN_MES', 'CUOTAS']) modalidad?: string;
}

/** Lo que el simulador muestra y lo que el registro guarda: salen del mismo cálculo. */
async function calcularCompra(
  bd: Ambito,
  cokTea: Dec,
  dto: CompraDto,
  p: PartesLima,
) {
  if (dto.modalidad === 'FIN_MES' && dto.numCuotas !== undefined) {
    throw new ErrorNegocio(400, 'MODALIDAD', 'Una compra a fin de mes no lleva número de cuotas.');
  }
  const clienteId = BigInt(dto.clienteId);
  const cliente = await bd.cliente.findFirst({ where: { id: clienteId } });
  if (!cliente) throw noExiste('El cliente');
  if (cliente.estado !== 'ACTIVO') throw new ErrorNegocio(409, 'CLIENTE_INACTIVO', 'El cliente está dado de baja.');

  const ids = [...new Set(dto.items.map((i) => BigInt(i.productoId)))];
  const productos = await bd.producto.findMany({ where: { id: { in: ids } } });
  if (productos.length !== ids.length) throw noExiste('El producto');
  const inactivo = productos.find((x) => x.estado !== 'ACTIVO');
  if (inactivo) throw new ErrorNegocio(409, 'PRODUCTO_INACTIVO', `El producto ${inactivo.codigo} está dado de baja.`);
  validarModalidad(
    dto.modalidad,
    productos.map((x) => ({ permiteFinMes: x.permite_fin_mes, permiteCuotas: x.permite_cuotas })),
  );

  const detalle = dto.items.map((i) => {
    const producto = productos.find((x) => x.id === BigInt(i.productoId));
    if (!producto) throw noExiste('El producto');
    const cantidad = aDec(i.cantidad);
    if (!cantidad.gt(0)) throw new ErrorNegocio(400, 'CANTIDAD', 'La cantidad debe ser mayor que cero.');
    const lista = aDecBd(producto.precio_lista);
    const contado = aDecBd(producto.precio_contado);
    if (!red(cantidad.times(contado)).gt(0)) {
      throw new ErrorNegocio(400, 'CANTIDAD', 'La cantidad es demasiado pequeña: el monto se redondea a cero.');
    }
    return {
      producto,
      cantidad,
      precioLista: lista,
      precioContado: contado,
      subtotal: red(cantidad.times(lista)),
      subtotalContado: red(cantidad.times(contado)),
    };
  });
  const montoLista = detalle.reduce<Dec>((s, d) => s.plus(d.subtotal), new Dec(0));
  const montoContado = detalle.reduce<Dec>((s, d) => s.plus(d.subtotalContado), new Dec(0));

  const fechaOperativa = fechaOperativaLocal(p.fecha, p.hora);
  const ciclo = asignarCiclo({ fechaOperativa, diaCorte: cliente.dia_corte, diaPago: cliente.dia_pago });
  const ted = aDecBd(cliente.ted);
  const su = calcularSu(await comprasParaSu(bd, clienteId));
  const limite = evaluarLimite({
    monto: montoLista,
    limite: aDecBd(cliente.limite_credito),
    su,
    moneda: cliente.moneda as Moneda,
  });

  const venta =
    dto.modalidad === 'CUOTAS'
      ? simularVentaEnCuotas({
          p: montoLista,
          pContado: montoContado,
          ted,
          n: dto.numCuotas as number,
          maxMeses: cliente.max_meses,
          cok: cokTea,
          fechaOperativa,
          diaCorte: cliente.dia_corte,
          diaPago: cliente.dia_pago,
        })
      : null;

  return { cliente, detalle, montoLista, montoContado, fechaOperativa, ciclo, ted, su, limite, venta };
}

function compraDto(c: compra & { cuota?: cuota[] }) {
  const p = dePartesBd(c.fecha_hora);
  return {
    id: aId(c.id),
    ticket: c.ticket,
    clienteId: aId(c.cliente_id),
    fechaHora: `${p.fecha}T${p.hora}`,
    fechaOperativa: fechaOperativaLocal(p.fecha, p.hora),
    modalidad: c.modalidad,
    montoLista: aSoles(c.monto_lista),
    montoContado: aSoles(c.monto_contado),
    fechaCorte: deFechaBd(c.fecha_corte),
    fechaPago: deFechaBd(c.fecha_pago),
    numCuotas: c.num_cuotas,
    diasGracia: c.dias_gracia,
    capitalCapitalizado: c.capital_capitalizado ? aSoles(c.capital_capitalizado) : null,
    tem: c.tem ? aTasa(c.tem) : null,
    cuotaFija: c.cuota_fija ? aSoles(c.cuota_fija) : null,
    tcea: c.tcea ? aTasa(c.tcea, 10) : null,
    tceaPorcentaje: c.tcea ? aPorcentaje(c.tcea) : null,
    van: c.van ? aSoles(c.van) : null,
    estado: c.estado,
    cuotas: c.cuota
      ? [...c.cuota]
          .sort((a, b) => a.numero - b.numero)
          .map((q) => ({
            numero: q.numero,
            vence: deFechaBd(q.fecha_vencimiento),
            saldoInicial: aSoles(q.saldo_inicial),
            interes: aSoles(q.interes),
            amortizacion: aSoles(q.amortizacion),
            monto: aSoles(q.monto),
            saldoFinal: aSoles(q.saldo_final),
            estado: q.estado,
          }))
      : undefined,
  };
}

@Injectable()
export class ComprasService {
  constructor(private readonly bd: BdService) {}

  /** Lo que alimenta D04. No guarda ni audita; el rechazo por límite es un dato, no un error. */
  simular(c: ContextoDueno, dto: CompraDto) {
    return this.bd.transaccionEnTienda(c.tiendaId, async (t) => {
      const tienda = await t.tienda();
      const r = await calcularCompra(t.bd, aDecBd(tienda.cok_tea), dto, t.ahora());
      const dias = diasEntre(r.fechaOperativa, r.ciclo.fechaPago);
      return {
        lineas: r.detalle.map((d) => ({
          productoId: aId(d.producto.id),
          codigo: d.producto.codigo,
          nombre: d.producto.nombre,
          cantidad: d.cantidad.toFixed(3),
          precioLista: aSoles(d.precioLista),
          precioContado: aSoles(d.precioContado),
          subtotal: aSoles(d.subtotal),
          subtotalContado: aSoles(d.subtotalContado),
        })),
        montoLista: aSoles(r.montoLista),
        montoContado: aSoles(r.montoContado),
        fechaOperativa: r.fechaOperativa,
        fechaCorte: r.ciclo.fechaCorte,
        fechaPago: r.ciclo.fechaPago,
        limite: {
          aceptada: r.limite.aceptada,
          disponible: aSoles(r.limite.disponible),
          limite: aSoles(r.cliente.limite_credito),
          su: aSoles(r.su),
          // La barra de D04: la web no hace cuentas con montos.
          usoActualPorcentaje: usoLimite(r.su, aDecBd(r.cliente.limite_credito)).toFixed(1),
          usoConCompraPorcentaje: usoLimite(r.su.plus(r.montoLista), aDecBd(r.cliente.limite_credito)).toFixed(1),
          mensaje: r.limite.aceptada ? undefined : r.limite.mensaje,
        },
        finMes: r.venta
          ? undefined
          : (() => {
              const interes = interesCompra(r.montoLista, r.ted, dias);
              return { dias, interes: aSoles(interes), total: aSoles(r.montoLista.plus(interes)) };
            })(),
        cuotas: r.venta
          ? {
              g: r.venta.plan.g,
              capitalCapitalizado: aSoles(r.venta.plan.capitalCapitalizado),
              interesGracia: aSoles(r.venta.plan.interesGracia),
              cuotaFija: aSoles(r.venta.plan.cuotaFija),
              ultimaCuota: aSoles(r.venta.plan.ultimaCuota),
              primeraCuota: r.venta.plan.filas[0].vence,
              tcea: aTasa(cuantizarTasa(r.venta.indicadores.tcea, 10), 10),
              tceaPorcentaje: aPorcentaje(r.venta.indicadores.tcea),
              van: aSoles(r.venta.indicadores.van),
              tirDiaria: r.venta.indicadores.tirDiaria.toFixed(10),
              cokTea: aTasa(tienda.cok_tea, 9),
              sumaValorActual: aSoles(r.venta.indicadores.sumaVa),
              filas: r.venta.plan.filas.map((f, i) => ({
                numero: f.k,
                vence: f.vence,
                diasPeriodo: f.diasPeriodo,
                t: f.t,
                valorActual: aSoles(r.venta!.indicadores.valoresActuales[i]),
                saldoInicial: aSoles(f.saldoInicial),
                interes: aSoles(f.interes),
                amortizacion: aSoles(f.amortizacion),
                monto: aSoles(f.cuota),
                saldoFinal: aSoles(f.saldoFinal),
              })),
            }
          : undefined,
      };
    });
  }

  async registrar(c: ContextoDueno, dto: CompraDto) {
    const resultado = await this.bd.transaccionEnTienda(c.tiendaId, async (t) => {
      const clienteId = BigInt(dto.clienteId);
      await t.bloquearTienda();
      await t.bloquearCliente(clienteId);
      // La hora se lee después del bloqueo: una compra nunca queda fuera de un corte ya ejecutado.
      const p = t.ahora();
      const tienda = await t.tienda();
      const r = await calcularCompra(t.bd, aDecBd(tienda.cok_tea), dto, p);

      const cerrado = await t.bd.listado_pago.findFirst({
        where: { cliente_id: clienteId, fecha_corte: aFechaBd(r.ciclo.fechaCorte) },
      });
      if (cerrado) throw new ErrorNegocio(409, 'CICLO_CERRADO', 'El ciclo de esta compra ya se cerró.');

      if (!r.limite.aceptada) {
        await t.auditar({
          usuarioId: c.usuarioId,
          accion: 'RECHAZO',
          tabla: 'compra',
          detalle: `Compra de ${conSimbolo(r.cliente.moneda, r.montoLista)} de ${r.cliente.nombres} ${r.cliente.apellidos}. ${r.limite.mensaje}`,
        });
        return new ErrorNegocio(422, 'LIMITE_EXCEDIDO', r.limite.mensaje, { disponible: aSoles(r.limite.disponible) });
      }

      const creada = await this.insertar(t, r, dto, p, clienteId);
      await t.auditar({
        usuarioId: c.usuarioId,
        accion: 'ALTA',
        tabla: 'compra',
        registroId: creada.id,
        detalle: `Compra ${creada.ticket} de ${r.cliente.nombres} ${r.cliente.apellidos}, ${creada.modalidad}, ${conSimbolo(r.cliente.moneda, r.montoLista)}`,
      });
      return compraDto(creada);
    });
    if (resultado instanceof ErrorNegocio) throw resultado;
    return resultado;
  }

  private async insertar(
    t: TrabajoTienda,
    r: Awaited<ReturnType<typeof calcularCompra>>,
    dto: CompraDto,
    p: PartesLima,
    clienteId: bigint,
  ) {
    const ultima = await t.bd.compra.findFirst({ orderBy: { ticket: 'desc' }, select: { ticket: true } });
    const correlativo = ultima ? Number(ultima.ticket.slice(2)) + 1 : 1;
    const v = r.venta;
    const creada = await t.bd.compra.create({
      data: {
        tienda_id: t.tiendaId,
        cliente_id: clienteId,
        ticket: `T-${String(correlativo).padStart(6, '0')}`,
        fecha_hora: aInstanteBd(p),
        modalidad: dto.modalidad,
        monto_lista: r.montoLista.toFixed(2),
        monto_contado: r.montoContado.toFixed(2),
        fecha_corte: aFechaBd(r.ciclo.fechaCorte),
        fecha_pago: aFechaBd(r.ciclo.fechaPago),
        ...(v
          ? {
              num_cuotas: dto.numCuotas,
              dias_gracia: v.plan.g,
              capital_capitalizado: v.plan.capitalCapitalizado.toFixed(2),
              tem: cuantizarTasa(tem(r.ted)).toFixed(15),
              cuota_fija: v.plan.cuotaFija.toFixed(2),
              tcea: cuantizarTasa(v.indicadores.tcea, 10).toFixed(10),
              van: v.indicadores.van.toFixed(2),
            }
          : {}),
      },
    });
    await t.bd.compra_detalle.createMany({
      data: r.detalle.map((d) => ({
        compra_id: creada.id,
        producto_id: d.producto.id,
        cantidad: d.cantidad.toFixed(3),
        precio_lista: d.precioLista.toFixed(2),
        precio_contado: d.precioContado.toFixed(2),
        subtotal: d.subtotal.toFixed(2),
      })),
    });
    if (v) {
      await t.bd.cuota.createMany({
        data: v.plan.filas.map((f) => ({
          compra_id: creada.id,
          numero: f.k,
          fecha_vencimiento: aFechaBd(f.vence),
          saldo_inicial: f.saldoInicial.toFixed(2),
          interes: f.interes.toFixed(2),
          amortizacion: f.amortizacion.toFixed(2),
          monto: f.cuota.toFixed(2),
          saldo_final: f.saldoFinal.toFixed(2),
        })),
      });
    }
    return t.bd.compra.findFirstOrThrow({ where: { id: creada.id }, include: { cuota: true } });
  }

  async listar(c: ContextoDueno, f: FiltroComprasDto) {
    const bd = this.bd.enTienda(c.tiendaId);
    const where = {
      cliente_id: f.clienteId ? BigInt(f.clienteId) : undefined,
      estado: f.estado,
      modalidad: f.modalidad,
    };
    const items = await bd.compra.findMany({ where, orderBy: [{ fecha_hora: 'asc' }, { id: 'asc' }], ...paginar(f) });
    return { items: items.map(compraDto), total: await bd.compra.count({ where }) };
  }

  async obtener(c: ContextoDueno, id: bigint) {
    const x = await this.bd.enTienda(c.tiendaId).compra.findFirst({
      where: { id },
      include: { cuota: true, compra_detalle: { include: { producto: true } } },
    });
    if (!x) throw noExiste('La compra');
    return {
      ...compraDto(x),
      detalle: x.compra_detalle.map((d) => ({
        codigo: d.producto.codigo,
        nombre: d.producto.nombre,
        unidad: d.producto.unidad,
        cantidad: d.cantidad.toFixed(3),
        precioLista: aSoles(d.precio_lista),
        precioContado: aSoles(d.precio_contado),
        subtotal: aSoles(d.subtotal),
      })),
    };
  }

  /** D05, T19, T22. TCEA y VAN son los guardados; TIR y valores actuales se recalculan. */
  async cronograma(c: ContextoDueno, id: bigint) {
    const bd = this.bd.enTienda(c.tiendaId);
    const x = await bd.compra.findFirst({ where: { id }, include: { cuota: true, cliente: true, tienda: true } });
    if (!x) throw noExiste('La compra');
    if (x.modalidad !== 'CUOTAS' || !x.tcea || !x.van || !x.capital_capitalizado || !x.cuota_fija || x.dias_gracia === null) {
      throw new ErrorNegocio(409, 'NO_ES_CUOTAS', 'Esta compra no es en cuotas.');
    }
    const cuotas = [...x.cuota].sort((a, b) => a.numero - b.numero);
    const fechaPago = deFechaBd(x.fecha_pago);
    const g = x.dias_gracia;
    let anterior = fechaPago;
    const filas = cuotas.map((q) => {
      const vence = deFechaBd(q.fecha_vencimiento);
      const diasPeriodo = diasEntre(anterior, vence);
      anterior = vence;
      return {
        numero: q.numero,
        vence,
        diasPeriodo,
        t: g + diasEntre(fechaPago, vence),
        saldoInicial: aSoles(q.saldo_inicial),
        interes: aSoles(q.interes),
        amortizacion: aSoles(q.amortizacion),
        monto: aSoles(q.monto),
        saldoFinal: aSoles(q.saldo_final),
        estado: q.estado,
      };
    });
    const montoLista = aDecBd(x.monto_lista);
    const contado = aDecBd(x.monto_contado);
    const indicadores = indicadoresVenta({
      p: montoLista,
      pContado: contado,
      cok: aDecBd(x.tienda.cok_tea),
      flujos: cuotas.map((q, i) => ({ monto: aDecBd(q.monto), t: filas[i].t })),
    });
    const suma = (f: (q: cuota) => Dec) => cuotas.reduce<Dec>((s, q) => s.plus(f(q)), new Dec(0));
    const totalMonto = suma((q) => aDecBd(q.monto));
    const interesCuotas = suma((q) => aDecBd(q.interes));
    const p = dePartesBd(x.fecha_hora);
    if (!filas.length) throw new ErrorFinanciero('CUOTAS_RANGO', 'La compra no tiene cuotas.');
    return {
      compra: {
        id: aId(x.id),
        ticket: x.ticket,
        clienteId: aId(x.cliente_id),
        cliente: `${x.cliente.nombres} ${x.cliente.apellidos}`,
        moneda: x.cliente.moneda,
        fechaHora: `${p.fecha}T${p.hora}`,
        fechaOperativa: fechaOperativaLocal(p.fecha, p.hora),
        fechaPago,
        montoLista: aSoles(montoLista),
        montoContado: aSoles(contado),
      },
      resumen: {
        montoCredito: aSoles(montoLista),
        diasGracia: g,
        capitalCapitalizado: aSoles(x.capital_capitalizado),
        interesGracia: aSoles(aDecBd(x.capital_capitalizado).minus(montoLista)),
        interesCuotas: aSoles(interesCuotas),
        interesesTotales: aSoles(totalMonto.minus(montoLista)),
        cuotaFija: aSoles(x.cuota_fija),
        tcea: aTasa(x.tcea, 10),
        tceaPorcentaje: aPorcentaje(x.tcea),
        tirDiaria: indicadores.tirDiaria.toFixed(10),
        van: aSoles(x.van),
      },
      filas: filas.map((f) => ({
        numero: f.numero,
        vence: f.vence,
        diasPeriodo: f.diasPeriodo,
        saldoInicial: f.saldoInicial,
        interes: f.interes,
        amortizacion: f.amortizacion,
        monto: f.monto,
        saldoFinal: f.saldoFinal,
        estado: f.estado,
      })),
      totales: {
        interes: aSoles(interesCuotas),
        amortizacion: aSoles(suma((q) => aDecBd(q.amortizacion))),
        monto: aSoles(totalMonto),
      },
      flujoCaja: {
        cokTea: aTasa(x.tienda.cok_tea, 9),
        filas: [
          { momento: 0, t: 0, flujo: aSoles(contado.negated()), valorActual: aSoles(contado.negated()) },
          ...filas.map((f, i) => ({
            momento: f.numero,
            t: f.t,
            flujo: f.monto,
            valorActual: aSoles(indicadores.valoresActuales[i]),
          })),
        ],
        // Suma sin redondear, redondeada al final: la web la muestra como total y no suma filas.
        sumaValorActual: aSoles(indicadores.sumaVa),
        van: aSoles(x.van),
        cokVigenteCoincide: indicadores.van.eq(aDecBd(x.van)),
      },
    };
  }
}

@ApiTags('compras')
@ApiBearerAuth()
@Roles('DUENO')
@Controller('compras')
export class ComprasController {
  constructor(private readonly s: ComprasService) {}

  @HttpCode(200)
  @Post('simular')
  simular(@Ctx() c: ContextoDueno, @Body() d: CompraDto) {
    return this.s.simular(c, d);
  }

  @Post()
  registrar(@Ctx() c: ContextoDueno, @Body() d: CompraDto) {
    return this.s.registrar(c, d);
  }

  @Get()
  listar(@Ctx() c: ContextoDueno, @Query() f: FiltroComprasDto) {
    return this.s.listar(c, f);
  }

  @Get(':id')
  obtener(@Ctx() c: ContextoDueno, @Param('id', ParseIdPipe) id: bigint) {
    return this.s.obtener(c, id);
  }

  @Get(':id/cronograma')
  cronograma(@Ctx() c: ContextoDueno, @Param('id', ParseIdPipe) id: bigint) {
    return this.s.cronograma(c, id);
  }
}
