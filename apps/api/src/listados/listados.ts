import { Body, Controller, Get, Inject, Injectable, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { cliente, listado_pago } from '@prisma/client';
import {
  creditoDisponible,
  diasEntre,
  fechaOperativaLocal,
  HORA_CORTE,
  itemMora,
  liquidarAFecha,
  Moneda,
  partesLima,
  registrarPago,
  sumarDias,
  tea,
  valorHoy,
} from '@vecinopay/finance';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { armarDetalle } from '../auditoria/detalle';
import { Ambito } from '../bd/ambito-tienda';
import { BdService } from '../bd/bd.service';
import { aDecBd, aFechaBd, deFechaBd, dePartesBd } from '../bd/conversiones';
import { restriccionUnica } from '../bd/errores-bd';
import { comprasParaSu } from '../clientes/clientes';
import { calcularSu, CompraParaSu } from '../clientes/saldos';
import { ErrorNegocio, noExiste } from '../comun/error-negocio';
import { aId, aSoles, aTasa, conSimbolo, ContextoDueno, Ctx, IsFecha, IsIdTexto, IsMonto, Opcional, PaginaDto, paginar, ParseIdPipe, Roles } from '../comun/utilidades';
import { RELOJ, Reloj } from '../reloj/reloj';

export class PagoDto {
  @IsMonto() montoPagado: string;
  @IsIn(['Efectivo', 'Yape', 'Plin', 'Transferencia']) medioPago: string;
  @Opcional() @IsString() @MaxLength(30) numeroOperacion?: string;
}

export class FiltroListadosDto extends PaginaDto {
  @Opcional() @IsIdTexto() clienteId?: string;
  @Opcional() @IsIn(['EMITIDO', 'PAGADO', 'VENCIDO']) estado?: string;
  @Opcional() @IsFecha() fechaCorte?: string;
}

export class ValorHoyDto {
  @Opcional() @IsFecha() fecha?: string;
}

/** Vencido si no está pagado y su fecha de pago ya pasó. Se calcula al leer: con reloj fijo el trabajo diario no corre. */
export function estadoEfectivo(l: listado_pago, fechaOperativa: string): string {
  if (l.estado === 'PAGADO') return 'PAGADO';
  return deFechaBd(l.fecha_pago) < fechaOperativa ? 'VENCIDO' : l.estado;
}

export function listadoResumenDto(l: listado_pago, fechaOperativa: string) {
  return {
    id: aId(l.id),
    numero: l.numero,
    clienteId: aId(l.cliente_id),
    fechaCorte: deFechaBd(l.fecha_corte),
    horaCorte: HORA_CORTE,
    fechaPago: deFechaBd(l.fecha_pago),
    totalCapital: aSoles(l.total_capital),
    totalInteres: aSoles(l.total_interes),
    totalMora: aSoles(l.total_mora),
    total: aSoles(l.total),
    estado: l.estado,
    estadoEfectivo: estadoEfectivo(l, fechaOperativa),
    fechaPagoReal: l.fecha_pago_real ? deFechaBd(l.fecha_pago_real) : null,
    diasMora: l.dias_mora,
  };
}

/** D06 y C05. Sirve a ambas pantallas: el filtro de cliente lo pone quien llama. */
export async function detalleListado(bd: Ambito, id: bigint, clienteId: bigint | undefined, fechaOperativaHoy: string) {
  const l = await bd.listado_pago.findFirst({
    where: { id, cliente_id: clienteId },
    include: {
      cliente: true,
      listado_item: {
        include: {
          compra: { include: { compra_detalle: { include: { producto: true } } } },
          cuota: { include: { compra: { include: { compra_detalle: { include: { producto: true } } } } } },
        },
        orderBy: { orden: 'asc' },
      },
    },
  });
  if (!l) throw noExiste('El listado');
  const moneda = l.cliente.moneda;
  const posteriores = await bd.compra.findMany({
    where: {
      cliente_id: l.cliente_id,
      estado: { not: 'ANULADA' },
      fecha_hora: { gte: aFechaBd(deFechaBd(l.fecha_corte)), lt: aFechaBd(sumarDias(deFechaBd(l.fecha_corte), 1)) },
    },
    orderBy: { fecha_hora: 'asc' },
  });
  const pagado = l.estado === 'PAGADO';
  const liquidacion = pagado
    ? null
    : liquidarAFecha({
        total: aDecBd(l.total),
        tedMora: aDecBd(l.cliente.ted_mora),
        fechaPago: deFechaBd(l.fecha_pago),
        fechaOperativaPago: fechaOperativaHoy,
      });
  return {
    ...listadoResumenDto(l, fechaOperativaHoy),
    moneda,
    cliente: `${l.cliente.nombres} ${l.cliente.apellidos}`,
    tasa: aTasa(l.cliente.ted),
    items: l.listado_item.map((i) => {
      const compra = i.compra ?? i.cuota?.compra ?? null;
      const registro = i.compra ? dePartesBd(i.compra.fecha_hora) : null;
      return {
        orden: i.orden,
        tipo: i.tipo,
        ticket: compra?.ticket ?? null,
        compraId: aId(compra?.id),
        // D06: lo que se llevó el cliente. Sin precio contado: esta respuesta también la ve el cliente.
        detalle: (compra?.compra_detalle ?? []).map((d) => ({
          codigo: d.producto.codigo,
          nombre: d.producto.nombre,
          unidad: d.producto.unidad,
          cantidad: d.cantidad.toFixed(3),
          precioLista: aSoles(d.precio_lista),
          subtotal: aSoles(d.subtotal),
        })),
        cuotaNumero: i.cuota?.numero ?? null,
        fechaHoraRegistro: registro ? `${registro.fecha}T${registro.hora}` : null,
        fecha: deFechaBd(i.fecha),
        posteriorAlCorte: registro ? registro.hora > HORA_CORTE : false,
        dias: i.dias,
        capital: aSoles(i.capital),
        interes: aSoles(i.interes),
        mora: aSoles(i.mora),
        total: aSoles(i.total),
      };
    }),
    comprasPosteriores: posteriores
      .map((c) => ({ c, p: dePartesBd(c.fecha_hora) }))
      .filter(({ p }) => p.hora > HORA_CORTE)
      .map(({ c, p }) => ({
        ticket: c.ticket,
        fechaHora: `${p.fecha}T${p.hora}`,
        fechaOperativa: fechaOperativaLocal(p.fecha, p.hora),
        monto: aSoles(c.monto_lista),
        fechaPago: deFechaBd(c.fecha_pago),
      })),
    moraALaFecha: liquidacion
      ? {
          diasMora: liquidacion.diasMora,
          mora: aSoles(liquidacion.mora),
          totalALaFecha: aSoles(liquidacion.totalALaFecha),
        }
      : undefined,
  };
}

/** SU después de pagar este listado: marca como pagado lo que el listado incluye. */
async function suTrasPago(bd: Ambito, l: listado_pago) {
  const compras = await bd.compra.findMany({
    where: { cliente_id: l.cliente_id, estado: 'PENDIENTE' },
    include: { cuota: true },
  });
  const items = await bd.listado_item.findMany({ where: { listado_id: l.id } });
  const comprasPagadas = new Set(items.map((i) => i.compra_id).filter(Boolean));
  const cuotasPagadas = new Set(items.map((i) => i.cuota_id).filter(Boolean));
  const simuladas: CompraParaSu[] = compras
    .filter((c) => !comprasPagadas.has(c.id))
    .map((c) => ({
      modalidad: c.modalidad,
      estado: c.estado,
      montoLista: aDecBd(c.monto_lista),
      cuotas: c.cuota.map((q) => ({
        numero: q.numero,
        estado: cuotasPagadas.has(q.id) ? 'PAGADA' : q.estado,
        saldoFinal: aDecBd(q.saldo_final),
      })),
    }));
  return calcularSu(simuladas);
}

@Injectable()
export class ListadosService {
  constructor(
    private readonly bd: BdService,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  private hoyOperativo() {
    const p = partesLima(this.reloj.ahora());
    return fechaOperativaLocal(p.fecha, p.hora);
  }

  async listar(c: ContextoDueno, f: FiltroListadosDto) {
    const hoy = this.hoyOperativo();
    const bd = this.bd.enTienda(c.tiendaId);
    const where = {
      cliente_id: f.clienteId ? BigInt(f.clienteId) : undefined,
      estado: f.estado,
      fecha_corte: f.fechaCorte ? aFechaBd(f.fechaCorte) : undefined,
    };
    const filas = await bd.listado_pago.findMany({ where, orderBy: [{ fecha_corte: 'desc' }, { id: 'desc' }], ...paginar(f) });
    return { items: filas.map((l) => listadoResumenDto(l, hoy)), total: await bd.listado_pago.count({ where }) };
  }

  obtener(c: ContextoDueno, id: bigint) {
    return detalleListado(this.bd.enTienda(c.tiendaId), id, undefined, this.hoyOperativo());
  }

  private async conCliente(bd: Ambito, id: bigint): Promise<listado_pago & { cliente: cliente }> {
    const l = await bd.listado_pago.findFirst({ where: { id }, include: { cliente: true } });
    if (!l) throw noExiste('El listado');
    return l;
  }

  /** 6.3l, T17: cuánto valdría pagar antes de la fecha de pago. */
  async valorHoy(c: ContextoDueno, id: bigint, f: ValorHoyDto) {
    const l = await this.conCliente(this.bd.enTienda(c.tiendaId), id);
    const fecha = f.fecha ?? this.hoyOperativo();
    const fechaPago = deFechaBd(l.fecha_pago);
    const td = diasEntre(fecha, fechaPago);
    if (td < 0) throw new ErrorNegocio(400, 'FECHA_ORDEN', 'La fecha no puede ser posterior a la fecha de pago.');
    const r = valorHoy({ vn: aDecBd(l.total), tea: tea(aDecBd(l.cliente.ted)), td });
    return {
      td,
      te: aTasa(r.te, 10),
      d: aTasa(r.d, 10),
      descuento: aSoles(r.descuento),
      neto: aSoles(r.neto),
    };
  }

  async liquidacion(c: ContextoDueno, id: bigint) {
    const bd = this.bd.enTienda(c.tiendaId);
    const l = await this.conCliente(bd, id);
    if (l.estado === 'PAGADO') throw new ErrorNegocio(409, 'LISTADO_YA_PAGADO', 'Este listado ya está pagado.');
    const real = partesLima(this.reloj.ahora());
    const fechaOperativaPago = fechaOperativaLocal(real.fecha, real.hora);
    const a = liquidarAFecha({
      total: aDecBd(l.total),
      tedMora: aDecBd(l.cliente.ted_mora),
      fechaPago: deFechaBd(l.fecha_pago),
      fechaOperativaPago,
    });
    return {
      fechaReal: real.fecha,
      horaReal: real.hora,
      fechaOperativaPago,
      diasMora: a.diasMora,
      mora: aSoles(a.mora),
      totalALaFecha: aSoles(a.totalALaFecha),
      imputacion: { mora: aSoles(a.mora), interes: aSoles(l.total_interes), capital: aSoles(l.total_capital) },
      disponibleDespues: aSoles(creditoDisponible(aDecBd(l.cliente.limite_credito), await suTrasPago(bd, l))),
    };
  }

  async pagar(c: ContextoDueno, id: bigint, d: PagoDto) {
    const resultado = await this.registrarPago(c, id, d).catch((e) => {
      // Último recurso: UQ_pago_listado, si dos pagos pasaran el bloqueo.
      if (restriccionUnica(e)) throw new ErrorNegocio(409, 'LISTADO_YA_PAGADO', 'Este listado ya está pagado.');
      throw e;
    });
    if (resultado instanceof ErrorNegocio) throw resultado;
    return resultado;
  }

  private registrarPago(c: ContextoDueno, id: bigint, d: PagoDto) {
    return this.bd.transaccionEnTienda(c.tiendaId, async (t) => {
      const previo = await t.bd.listado_pago.findFirst({ where: { id }, select: { cliente_id: true } });
      if (!previo) throw noExiste('El listado');
      await t.bloquearCliente(previo.cliente_id);
      await t.bloquearListado(id);
      const l = await this.conCliente(t.bd, id);
      if (l.estado === 'PAGADO') throw new ErrorNegocio(409, 'LISTADO_YA_PAGADO', 'Este listado ya está pagado.');

      // Siempre la hora del servidor (decisión de Adrián). Se lee después del bloqueo.
      const p = t.ahora();
      const fechaOperativaPago = fechaOperativaLocal(p.fecha, p.hora);
      const r = registrarPago({
        total: aDecBd(l.total),
        interes: aDecBd(l.total_interes),
        capital: aDecBd(l.total_capital),
        tedMora: aDecBd(l.cliente.ted_mora),
        fechaPago: deFechaBd(l.fecha_pago),
        fechaOperativaPago,
        montoPagado: d.montoPagado,
        moneda: l.cliente.moneda as Moneda,
      });
      if (!r.aceptado) {
        await t.auditar({
          usuarioId: c.usuarioId,
          accion: 'RECHAZO',
          tabla: 'pago',
          detalle: `Pago de ${conSimbolo(l.cliente.moneda, d.montoPagado)} del listado ${l.numero} rechazado. ${r.mensaje}`,
        });
        return new ErrorNegocio(422, 'PAGO_NO_EXACTO', r.mensaje, { totalALaFecha: aSoles(r.totalALaFecha) });
      }

      const items = await t.bd.listado_item.findMany({ where: { listado_id: l.id }, orderBy: { orden: 'asc' } });
      const pago = await t.bd.pago.create({
        data: {
          listado_id: l.id,
          fecha: aFechaBd(p.fecha), // Fecha calendario real (decisión de Adrián); la hora queda en auditoría.
          monto: r.totalALaFecha.toFixed(2),
          medio_pago: d.medioPago,
          numero_operacion: d.numeroOperacion ?? null,
          mora_aplicada: r.imputacion.mora.toFixed(2),
          interes_aplicado: r.imputacion.interes.toFixed(2),
          capital_aplicado: r.imputacion.capital.toFixed(2),
        },
      });
      if (r.diasMora > 0) {
        const i = itemMora({
          ultimoOrden: items[items.length - 1]?.orden ?? 0,
          fechaOperativaPago,
          diasMora: r.diasMora,
          mora: r.mora,
        });
        await t.bd.listado_item.createMany({
          data: [
            {
              listado_id: l.id,
              compra_id: null,
              cuota_id: null,
              orden: i.orden,
              tipo: i.tipo,
              fecha: aFechaBd(i.fecha),
              dias: i.dias,
              capital: '0.00',
              interes: '0.00',
              mora: i.mora.toFixed(2),
              total: i.total.toFixed(2),
            },
          ],
        });
      }
      await t.bd.listado_pago.update({
        where: { id: l.id },
        data: {
          total_mora: r.mora.toFixed(2),
          total: r.totalALaFecha.toFixed(2),
          estado: 'PAGADO',
          fecha_pago_real: aFechaBd(p.fecha),
          dias_mora: r.diasMora,
        },
      });

      const idsCompra = items.flatMap((i) => (i.compra_id ? [i.compra_id] : []));
      const idsCuota = items.flatMap((i) => (i.cuota_id ? [i.cuota_id] : []));
      if (idsCompra.length) await t.bd.compra.updateMany({ where: { id: { in: idsCompra } }, data: { estado: 'PAGADA' } });
      if (idsCuota.length) {
        await t.bd.cuota.updateMany({ where: { id: { in: idsCuota } }, data: { estado: 'PAGADA' } });
        const afectadas = await t.bd.cuota.findMany({ where: { id: { in: idsCuota } }, select: { compra_id: true } });
        for (const compraId of new Set(afectadas.map((q) => q.compra_id))) {
          const pendientes = await t.bd.cuota.count({ where: { compra_id: compraId, estado: 'PENDIENTE' } });
          if (pendientes === 0) await t.bd.compra.updateMany({ where: { id: compraId }, data: { estado: 'PAGADA' } });
        }
      }

      await t.auditar({
        usuarioId: c.usuarioId,
        accion: 'ALTA',
        tabla: 'pago',
        registroId: pago.id,
        detalle: armarDetalle(`Pago de ${conSimbolo(l.cliente.moneda, r.totalALaFecha)} del listado ${l.numero} por ${d.medioPago}.`, {
          hora: p.hora,
          fecha: p.fecha,
          fechaOperativa: fechaOperativaPago,
        }),
      });

      const su = calcularSu(await comprasParaSu(t.bd, l.cliente_id));
      return {
        pago: {
          id: aId(pago.id),
          fecha: p.fecha,
          hora: p.hora,
          monto: aSoles(pago.monto),
          medioPago: pago.medio_pago,
          numeroOperacion: pago.numero_operacion,
          diasMora: r.diasMora,
        },
        imputacion: {
          mora: aSoles(r.imputacion.mora),
          interes: aSoles(r.imputacion.interes),
          capital: aSoles(r.imputacion.capital),
        },
        listado: { id: aId(l.id), numero: l.numero, estado: 'PAGADO', total: aSoles(r.totalALaFecha) },
        disponible: aSoles(creditoDisponible(aDecBd(l.cliente.limite_credito), su)),
      };
    });
  }
}

@ApiTags('listados')
@ApiBearerAuth()
@Roles('DUENO')
@Controller('listados')
export class ListadosController {
  constructor(private readonly s: ListadosService) {}

  @Get()
  listar(@Ctx() c: ContextoDueno, @Query() f: FiltroListadosDto) {
    return this.s.listar(c, f);
  }

  @Get(':id')
  obtener(@Ctx() c: ContextoDueno, @Param('id', ParseIdPipe) id: bigint) {
    return this.s.obtener(c, id);
  }

  @Get(':id/valor-hoy')
  valorHoy(@Ctx() c: ContextoDueno, @Param('id', ParseIdPipe) id: bigint, @Query() f: ValorHoyDto) {
    return this.s.valorHoy(c, id, f);
  }

  @Get(':id/liquidacion')
  liquidacion(@Ctx() c: ContextoDueno, @Param('id', ParseIdPipe) id: bigint) {
    return this.s.liquidacion(c, id);
  }

  @Post(':id/pago')
  pagar(@Ctx() c: ContextoDueno, @Param('id', ParseIdPipe) id: bigint, @Body() d: PagoDto) {
    return this.s.pagar(c, id, d);
  }
}
