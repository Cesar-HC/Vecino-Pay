import { Controller, HttpCode, Inject, Injectable, Logger, OnApplicationBootstrap, Post } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  diasEntre,
  fechaOperativaLocal,
  HORA_CORTE,
  listadoDePago,
  partesLima,
  sumarMeses,
  ZONA_HORARIA,
} from '@vecinopay/finance';
import { BdService } from '../bd/bd.service';
import { aDecBd, aFechaBd, deFechaBd, dePartesBd } from '../bd/conversiones';
import { ErrorNegocio } from '../comun/error-negocio';
import { aId, aSoles, Roles } from '../comun/utilidades';
import { RELOJ, Reloj } from '../reloj/reloj';

export interface ResultadoCorte {
  fecha: string;
  listadosEmitidos: { numero: string; clienteId: string; total: string }[];
  omitidos: number;
  vencidos: number;
  errores: { clienteId: string; mensaje: string }[];
}

@Injectable()
export class CorteService implements OnApplicationBootstrap {
  private readonly log = new Logger('Corte');

  constructor(
    private readonly bd: BdService,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  private get automatico() {
    return !this.reloj.fijo && process.env.NODE_ENV !== 'test';
  }

  /** 17:00:01 y no 17:00:00: la hora de corte es inclusiva por segundo (Fig. 25). */
  @Cron('1 0 17 * * *', { timeZone: ZONA_HORARIA })
  async programado() {
    if (this.automatico) await this.correrSinInterrumpir();
  }

  /** Recupera el corte perdido solo de hoy, si la API arranca después de la hora de corte. */
  async onApplicationBootstrap() {
    if (this.automatico && partesLima(this.reloj.ahora()).hora > HORA_CORTE) await this.correrSinInterrumpir();
  }

  private async correrSinInterrumpir() {
    try {
      const r = await this.ejecutar();
      this.log.log(`Corte ${r.fecha}: ${r.listadosEmitidos.length} listados, ${r.errores.length} errores.`);
    } catch (e) {
      this.log.error(e);
    }
  }

  async ejecutarManual(): Promise<ResultadoCorte> {
    if (partesLima(this.reloj.ahora()).hora <= HORA_CORTE) {
      throw new ErrorNegocio(409, 'CORTE_NO_DISPONIBLE', 'El corte solo se puede ejecutar después de las 17:00:00.');
    }
    return this.ejecutar();
  }

  /** Procesa solo la fecha calendario de hoy: nunca recibe fecha ni se pone al día (fases 1-2, 9.1.2). */
  private async ejecutar(): Promise<ResultadoCorte> {
    const hoy = partesLima(this.reloj.ahora()).fecha;
    const resultado: ResultadoCorte = { fecha: hoy, listadosEmitidos: [], omitidos: 0, vencidos: 0, errores: [] };
    const bd = this.bd.global();

    const vencen = await bd.listado_pago.findMany({
      where: { estado: 'EMITIDO', fecha_pago: { lte: aFechaBd(hoy) } },
      select: { id: true, tienda_id: true, numero: true },
    });
    for (const l of vencen) {
      await this.bd.transaccionEnTienda(l.tienda_id, async (t) => {
        await t.bd.listado_pago.updateMany({ where: { id: l.id, estado: 'EMITIDO' }, data: { estado: 'VENCIDO' } });
        await t.auditar({
          usuarioId: null,
          accion: 'CAMBIO',
          tabla: 'listado_pago',
          registroId: l.id,
          detalle: `Listado ${l.numero} vencido.`,
        });
      });
      resultado.vencidos++;
    }

    const clientes = await bd.cliente.findMany({
      where: { dia_corte: Number(hoy.slice(8)), tienda: { estado: 'ACTIVO' } },
      select: { id: true, tienda_id: true },
    });
    // Cada cliente en su transacción: un error no detiene a los demás.
    for (const c of clientes) {
      try {
        const emitido = await this.cortarCliente(c.tienda_id, c.id, hoy);
        if (emitido) resultado.listadosEmitidos.push(emitido);
        else resultado.omitidos++;
      } catch (e) {
        this.log.error(e);
        resultado.errores.push({ clienteId: aId(c.id) as string, mensaje: e instanceof Error ? e.message : 'Error' });
      }
    }
    return resultado;
  }

  private cortarCliente(tiendaId: bigint, clienteId: bigint, hoy: string) {
    return this.bd.transaccionEnTienda(tiendaId, async (t) => {
      await t.bloquearTienda();
      await t.bloquearCliente(clienteId);
      const corte = aFechaBd(hoy);
      // Idempotencia: si ya tiene listado de este corte, no se hace nada.
      if (await t.bd.listado_pago.findFirst({ where: { cliente_id: clienteId, fecha_corte: corte } })) return null;

      const cliente = await t.bd.cliente.findFirstOrThrow({ where: { id: clienteId } });
      const compras = await t.bd.compra.findMany({
        where: { cliente_id: clienteId, modalidad: 'FIN_MES', estado: 'PENDIENTE', fecha_corte: corte, listado_item: { none: {} } },
      });
      const enCuotas = await t.bd.compra.findMany({
        where: { cliente_id: clienteId, modalidad: 'CUOTAS', estado: 'PENDIENTE' },
        include: { cuota: { where: { estado: 'PENDIENTE', listado_item: { none: {} } } } },
      });
      // Por las fechas guardadas (6.1.3): la cuota k se lista en el corte k meses después del de la compra.
      const cuotas = enCuotas.flatMap((c) =>
        c.cuota
          .filter((q) => sumarMeses(deFechaBd(c.fecha_corte), q.numero) === hoy)
          .map((q) => ({ compra: c, cuota: q })),
      );
      if (compras.length === 0 && cuotas.length === 0) return null;

      const fechas = new Set([
        ...compras.map((c) => deFechaBd(c.fecha_pago)),
        ...cuotas.map((q) => deFechaBd(q.cuota.fecha_vencimiento)),
      ]);
      if (fechas.size !== 1) throw new Error(`El cliente ${clienteId} tiene fechas de pago distintas en el corte.`);
      const fechaPago = [...fechas][0];

      const listado = listadoDePago({
        fechaPago,
        ted: aDecBd(cliente.ted),
        compras: compras.map((c) => {
          const p = dePartesBd(c.fecha_hora);
          return { ref: String(c.id), fechaOperativa: fechaOperativaLocal(p.fecha, p.hora), capital: aDecBd(c.monto_lista) };
        }),
        cuotas: await Promise.all(
          cuotas.map(async ({ compra, cuota }) => {
            const anterior =
              cuota.numero === 1
                ? deFechaBd(compra.fecha_pago)
                : sumarMeses(deFechaBd(compra.fecha_pago), cuota.numero - 1);
            return {
              ref: String(cuota.id),
              capital: aDecBd(cuota.amortizacion),
              interes: aDecBd(cuota.interes),
              dias: diasEntre(anterior, deFechaBd(cuota.fecha_vencimiento)),
            };
          }),
        ),
      });

      const prefijo = `EC-${hoy.slice(0, 4)}${hoy.slice(5, 7)}-`;
      const ultimo = await t.bd.listado_pago.findFirst({
        where: { numero: { startsWith: prefijo } },
        orderBy: { numero: 'desc' },
        select: { numero: true },
      });
      const correlativo = ultimo ? Number(ultimo.numero.slice(prefijo.length)) + 1 : 1;
      const numero = `${prefijo}${String(correlativo).padStart(5, '0')}`;

      const creado = await t.bd.listado_pago.create({
        data: {
          tienda_id: t.tiendaId,
          cliente_id: clienteId,
          numero,
          fecha_corte: corte,
          fecha_pago: aFechaBd(fechaPago),
          total_capital: listado.totalCapital.toFixed(2),
          total_interes: listado.totalInteres.toFixed(2),
          total_mora: '0.00',
          total: listado.total.toFixed(2),
        },
      });
      await t.bd.listado_item.createMany({
        data: listado.items.map((i) => ({
          listado_id: creado.id,
          compra_id: i.tipo === 'COMPRA' ? BigInt(i.ref) : null,
          cuota_id: i.tipo === 'CUOTA' ? BigInt(i.ref) : null,
          orden: i.orden,
          tipo: i.tipo,
          fecha: aFechaBd(i.fecha),
          dias: i.dias,
          capital: i.capital.toFixed(2),
          interes: i.interes.toFixed(2),
          mora: '0.00',
          total: i.total.toFixed(2),
        })),
      });
      await t.auditar({
        usuarioId: null,
        accion: 'ALTA',
        tabla: 'listado_pago',
        registroId: creado.id,
        detalle: `Corte automático: listado ${numero}`,
      });
      return { numero, clienteId: aId(clienteId) as string, total: aSoles(listado.total) };
    });
  }
}

@ApiTags('cortes')
@ApiBearerAuth()
@Roles('ADMIN_SISTEMA')
@Controller('cortes')
export class CortesController {
  constructor(private readonly s: CorteService) {}

  /** Para la demo y las pruebas: con reloj fijo no hay cron. Solo hoy y después de las 17:00:00. */
  @HttpCode(200)
  @Post('ejecutar')
  ejecutar() {
    return this.s.ejecutarManual();
  }
}
