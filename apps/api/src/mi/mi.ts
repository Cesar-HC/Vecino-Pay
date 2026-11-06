import { Controller, Get, Inject, Injectable, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  creditoDisponible,
  Dec,
  diasEntre,
  fechaOperativaLocal,
  HORA_CORTE,
  interesCompra,
  partesLima,
  red,
  tasaDeDias,
  usoLimite,
} from '@vecinopay/finance';
import { numeroCuenta } from '../auth/auth.service';
import { BdService } from '../bd/bd.service';
import { aDecBd, deFechaBd, dePartesBd } from '../bd/conversiones';
import { comprasParaSu } from '../clientes/clientes';
import { calcularSu } from '../clientes/saldos';
import { noExiste } from '../comun/error-negocio';
import { aId, aPorcentaje, aSoles, aTasa, ContextoCliente, Ctx, ParseIdPipe, Roles } from '../comun/utilidades';
import { detalleListado, listadoResumenDto } from '../listados/listados';
import { RELOJ, Reloj } from '../reloj/reloj';

/** Rutas del cliente. El id sale del contexto. Nunca devuelven VAN, contado, COK ni precio contado (RF09). */
@Injectable()
export class MiService {
  constructor(
    private readonly bd: BdService,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  private hoy() {
    const p = partesLima(this.reloj.ahora());
    return fechaOperativaLocal(p.fecha, p.hora);
  }

  async resumen(c: ContextoCliente) {
    const bd = this.bd.enTienda(c.tiendaId);
    const hoy = this.hoy();
    const yo = await bd.cliente.findFirstOrThrow({ where: { id: c.clienteId }, include: { tienda: true } });
    const su = calcularSu(await comprasParaSu(bd, c.clienteId));
    const limite = aDecBd(yo.limite_credito);
    const pendientes = await bd.listado_pago.findMany({
      where: { cliente_id: c.clienteId, estado: { not: 'PAGADO' } },
      orderBy: { fecha_pago: 'asc' },
    });
    const proximo = pendientes[0];
    const ultimaFechaCorte = await bd.listado_pago.findFirst({
      where: { cliente_id: c.clienteId },
      orderBy: { fecha_corte: 'desc' },
    });
    const compras = await bd.compra.findMany({
      where: { cliente_id: c.clienteId, estado: { not: 'ANULADA' } },
      orderBy: { fecha_hora: 'asc' },
    });
    const semanas = new Map<string, Dec>();
    for (const x of compras) {
      const r = dePartesBd(x.fecha_hora);
      const d = new Date(`${fechaOperativaLocal(r.fecha, r.hora)}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      const semana = d.toISOString().slice(0, 10);
      semanas.set(semana, (semanas.get(semana) ?? new Dec(0)).plus(aDecBd(x.monto_lista)));
    }
    return {
      cliente: { nombre: `${yo.nombres} ${yo.apellidos}`, numeroCuenta: numeroCuenta(yo.id) },
      tienda: { nombreComercial: yo.tienda.nombre_comercial },
      moneda: yo.moneda,
      proximoPago: proximo
        ? {
            total: aSoles(proximo.total),
            capital: aSoles(proximo.total_capital),
            interes: aSoles(proximo.total_interes),
            fecha: deFechaBd(proximo.fecha_pago),
            diasRestantes: diasEntre(hoy, deFechaBd(proximo.fecha_pago)),
          }
        : null,
      credito: {
        limite: aSoles(limite),
        usado: aSoles(su),
        disponible: aSoles(creditoDisponible(limite, su)),
        usoPorcentaje: usoLimite(su, limite).toFixed(1),
      },
      comprasPorSemana: [...semanas.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([semana, monto]) => ({ semana, monto: aSoles(monto) })),
      // Compras incluidas en el último listado emitido: es lo que C03 muestra del ciclo.
      comprasDelCiclo: ultimaFechaCorte
        ? compras.filter((x) => deFechaBd(x.fecha_corte) === deFechaBd(ultimaFechaCorte.fecha_corte) && x.modalidad === 'FIN_MES').length
        : 0,
      tasa: { tipo: yo.tipo_tasa, valor: aTasa(yo.valor_tasa, 9), plazo: yo.plazo_tasa, capitalizacion: yo.capitalizacion },
    };
  }

  async listados(c: ContextoCliente) {
    const hoy = this.hoy();
    const filas = await this.bd.enTienda(c.tiendaId).listado_pago.findMany({
      where: { cliente_id: c.clienteId },
      orderBy: { fecha_corte: 'desc' },
    });
    return { items: filas.map((l) => listadoResumenDto(l, hoy)), total: filas.length };
  }

  listado(c: ContextoCliente, id: bigint) {
    return detalleListado(this.bd.enTienda(c.tiendaId), id, c.clienteId, this.hoy());
  }

  async cuotas(c: ContextoCliente) {
    const compras = await this.bd.enTienda(c.tiendaId).compra.findMany({
      where: { cliente_id: c.clienteId, modalidad: 'CUOTAS', estado: { not: 'ANULADA' } },
      include: { cuota: true },
      orderBy: { fecha_hora: 'asc' },
    });
    return {
      compras: compras.map((x) => {
        const filas = [...x.cuota].sort((a, b) => a.numero - b.numero);
        const r = dePartesBd(x.fecha_hora);
        const proxima = filas.find((q) => q.estado === 'PENDIENTE');
        const capital = x.capital_capitalizado ? aDecBd(x.capital_capitalizado) : new Dec(0);
        return {
          ticket: x.ticket,
          cuotaFija: x.cuota_fija ? aSoles(x.cuota_fija) : null,
          tcea: x.tcea ? aTasa(x.tcea, 10) : null,
          tceaPorcentaje: x.tcea ? aPorcentaje(x.tcea) : null,
          proximaCuota: proxima ? { numero: proxima.numero, vence: deFechaBd(proxima.fecha_vencimiento), monto: aSoles(proxima.monto) } : null,
          filas: filas.map((q) => ({
            numero: q.numero,
            vence: deFechaBd(q.fecha_vencimiento),
            monto: aSoles(q.monto),
            estado: q.estado,
          })),
          explicacion: {
            fechaCompra: fechaOperativaLocal(r.fecha, r.hora),
            fechaPago: deFechaBd(x.fecha_pago),
            g: x.dias_gracia,
            interesGracia: aSoles(capital.minus(aDecBd(x.monto_lista))),
            montoLista: aSoles(x.monto_lista),
            capitalCapitalizado: aSoles(capital),
          },
        };
      }),
    };
  }

  async pagos(c: ContextoCliente) {
    const bd = this.bd.enTienda(c.tiendaId);
    const yo = await bd.cliente.findFirstOrThrow({ where: { id: c.clienteId } });
    const filas = await bd.pago.findMany({
      where: { listado_pago: { cliente_id: c.clienteId } },
      include: { listado_pago: true },
      orderBy: { fecha: 'desc' },
    });
    const su = calcularSu(await comprasParaSu(bd, c.clienteId));
    return {
      pagos: filas.map((p) => ({
        fecha: deFechaBd(p.fecha),
        medioPago: p.medio_pago,
        numeroOperacion: p.numero_operacion,
        monto: aSoles(p.monto),
        diasMora: p.listado_pago.dias_mora,
        imputacion: { mora: aSoles(p.mora_aplicada), interes: aSoles(p.interes_aplicado), capital: aSoles(p.capital_aplicado) },
        listadoNumero: p.listado_pago.numero,
      })),
      disponible: aSoles(creditoDisponible(aDecBd(yo.limite_credito), su)),
    };
  }

  async perfil(c: ContextoCliente) {
    const yo = await this.bd.enTienda(c.tiendaId).cliente.findFirstOrThrow({ where: { id: c.clienteId } });
    return {
      id: aId(yo.id),
      numeroCuenta: numeroCuenta(yo.id),
      dni: yo.dni,
      nombres: yo.nombres,
      apellidos: yo.apellidos,
      celular: yo.celular,
      direccion: yo.direccion,
      moneda: yo.moneda,
      limiteCredito: aSoles(yo.limite_credito),
      maxMeses: yo.max_meses,
      diaCorte: yo.dia_corte,
      horaCorte: HORA_CORTE,
      diaPago: yo.dia_pago,
      tasa: { tipo: yo.tipo_tasa, valor: aTasa(yo.valor_tasa, 9), plazo: yo.plazo_tasa, capitalizacion: yo.capitalizacion },
      tasaMora: { tipo: yo.tipo_tasa_mora, valor: aTasa(yo.valor_tasa_mora, 9) },
    };
  }

  /** C09: la fórmula explicada con una compra real del cliente, la más antigua. */
  async ejemplo(c: ContextoCliente) {
    const bd = this.bd.enTienda(c.tiendaId);
    const yo = await bd.cliente.findFirstOrThrow({ where: { id: c.clienteId } });
    const x = await bd.compra.findFirst({
      where: { cliente_id: c.clienteId, estado: { not: 'ANULADA' } },
      orderBy: { fecha_hora: 'asc' },
    });
    if (!x) throw noExiste('La compra de ejemplo');
    const r = dePartesBd(x.fecha_hora);
    const dias = diasEntre(fechaOperativaLocal(r.fecha, r.hora), deFechaBd(x.fecha_pago));
    const capital = aDecBd(x.monto_lista);
    const ted = aDecBd(yo.ted);
    const interes = interesCompra(capital, ted, dias);
    return {
      ticket: x.ticket,
      capital: aSoles(capital),
      ted: aTasa(ted),
      dias,
      factor: tasaDeDias(ted, dias).toFixed(10),
      interes: aSoles(red(interes)),
      total: aSoles(capital.plus(interes)),
    };
  }
}

@ApiTags('cliente')
@ApiBearerAuth()
@Roles('CLIENTE')
@Controller('mi')
export class MiController {
  constructor(private readonly s: MiService) {}

  @Get('resumen')
  resumen(@Ctx() c: ContextoCliente) {
    return this.s.resumen(c);
  }

  @Get('listados')
  listados(@Ctx() c: ContextoCliente) {
    return this.s.listados(c);
  }

  @Get('listados/:id')
  listado(@Ctx() c: ContextoCliente, @Param('id', ParseIdPipe) id: bigint) {
    return this.s.listado(c, id);
  }

  @Get('cuotas')
  cuotas(@Ctx() c: ContextoCliente) {
    return this.s.cuotas(c);
  }

  @Get('pagos')
  pagos(@Ctx() c: ContextoCliente) {
    return this.s.pagos(c);
  }

  @Get('perfil')
  perfil(@Ctx() c: ContextoCliente) {
    return this.s.perfil(c);
  }

  @Get('ayuda/ejemplo')
  ejemplo(@Ctx() c: ContextoCliente) {
    return this.s.ejemplo(c);
  }
}
