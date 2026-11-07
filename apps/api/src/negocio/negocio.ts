import { Controller, Get, Inject, Injectable } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { aDec, Dec, capitalPorCobrar, fechaOperativaLocal, interesCompra, partesLima, usoLimite, diasEntre } from '@vecinopay/finance';
import { BdService } from '../bd/bd.service';
import { aDecBd, deFechaBd, dePartesBd } from '../bd/conversiones';
import { calcularSu } from '../clientes/saldos';
import { aSoles, aTasa, ContextoDueno, Ctx, Roles } from '../comun/utilidades';
import { estadoEfectivo } from '../listados/listados';
import { RELOJ, Reloj } from '../reloj/reloj';

const cero = () => new Dec(0);
const sumarEn = (m: Map<string, Dec>, k: string, x: Dec) => m.set(k, (m.get(k) ?? cero()).plus(x));

/** Lunes de la semana ISO de una fecha. */
function inicioSemana(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  const desde = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - desde);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class NegocioService {
  constructor(
    private readonly bd: BdService,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  /** D01 (6.1.2, 6.3m). Los montos de PEN y USD no se suman (6.1.1). */
  async resumen(c: ContextoDueno) {
    const bd = this.bd.enTienda(c.tiendaId);
    const p = partesLima(this.reloj.ahora());
    const hoy = fechaOperativaLocal(p.fecha, p.hora);
    const clientes = await bd.cliente.findMany();
    const listados = await bd.listado_pago.findMany();
    const compras = await bd.compra.findMany({
      where: { estado: { not: 'ANULADA' } },
      include: { cuota: true, compra_detalle: { include: { producto: true } }, listado_item: true },
    });
    const items = await bd.listado_item.findMany({ where: { cuota_id: { not: null } }, select: { cuota_id: true } });
    const cuotasListadas = new Set(items.map((i) => i.cuota_id));

    const monedas = [...new Set(clientes.map((x) => x.moneda))].sort();
    const porMoneda: Record<string, unknown> = {};
    for (const moneda of monedas) {
      const deMoneda = clientes.filter((x) => x.moneda === moneda);
      const ids = new Set(deMoneda.map((x) => x.id));
      const ls = listados.filter((l) => ids.has(l.cliente_id));
      const cs = compras.filter((x) => ids.has(x.cliente_id));

      const usos = deMoneda.map((x) => ({
        x,
        su: calcularSu(
          cs
            .filter((k) => k.cliente_id === x.id)
            .map((k) => ({
              modalidad: k.modalidad,
              estado: k.estado,
              montoLista: aDecBd(k.monto_lista),
              cuotas: k.cuota.map((q) => ({ numero: q.numero, estado: q.estado, saldoFinal: aDecBd(q.saldo_final) })),
            })),
        ),
      }));

      const noPagados = ls.filter((l) => l.estado !== 'PAGADO');
      const cortes = ls.map((l) => deFechaBd(l.fecha_corte)).filter((f) => f <= hoy).sort();
      const ultimoCorte = cortes[cortes.length - 1];
      const interesesDelCiclo = ls
        .filter((l) => deFechaBd(l.fecha_corte) === ultimoCorte)
        .reduce<Dec>((s, l) => s.plus(aDecBd(l.total_interes)), cero());

      const carteraEnMora = ls
        .filter((l) => estadoEfectivo(l, hoy) === 'VENCIDO')
        .reduce<Dec>((s, l) => s.plus(aDecBd(l.total)), cero());

      const ventasPorSemana = new Map<string, Dec>();
      const ventasPorModalidad = new Map<string, Dec>();
      const cobros = new Map<string, Dec>();
      const productos = new Map<string, { codigo: string; nombre: string; cantidad: Dec; subtotal: Dec }>();
      for (const l of noPagados) sumarEn(cobros, deFechaBd(l.fecha_pago), aDecBd(l.total));

      for (const x of cs) {
        const r = dePartesBd(x.fecha_hora);
        const operativa = fechaOperativaLocal(r.fecha, r.hora);
        const lista = aDecBd(x.monto_lista);
        sumarEn(ventasPorSemana, inicioSemana(operativa), lista);
        sumarEn(ventasPorModalidad, x.modalidad, lista);
        for (const d of x.compra_detalle) {
          const f = productos.get(d.producto.codigo) ?? { codigo: d.producto.codigo, nombre: d.producto.nombre, cantidad: cero(), subtotal: cero() };
          f.cantidad = f.cantidad.plus(aDec(d.cantidad.toFixed()));
          f.subtotal = f.subtotal.plus(aDecBd(d.subtotal));
          productos.set(d.producto.codigo, f);
        }
        if (x.estado !== 'PENDIENTE') continue;
        // Lo que aún no está en un listado se proyecta con su fecha guardada.
        if (x.modalidad === 'FIN_MES' && x.listado_item.length === 0) {
          const cliente = deMoneda.find((y) => y.id === x.cliente_id);
          if (cliente) {
            const fechaPago = deFechaBd(x.fecha_pago);
            const interes = interesCompra(lista, aDecBd(cliente.ted), diasEntre(operativa, fechaPago));
            sumarEn(cobros, fechaPago, lista.plus(interes));
          }
        }
        for (const q of x.cuota) {
          if (q.estado === 'PENDIENTE' && !cuotasListadas.has(q.id)) {
            sumarEn(cobros, deFechaBd(q.fecha_vencimiento), aDecBd(q.monto));
          }
        }
      }

      const orden = <T,>(m: Map<string, T>) => [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
      // Lo que se cobrará en la próxima fecha de pago, con lo aún no listado proyectado (D01).
      const proximo = orden(cobros).find(([fecha]) => fecha >= hoy);
      porMoneda[moneda] = {
        capitalPorCobrar: aSoles(capitalPorCobrar(usos.map((u) => u.su))),
        cobroProximo: proximo ? { fecha: proximo[0], total: aSoles(proximo[1]) } : null,
        interesesDelCiclo: aSoles(interesesDelCiclo),
        carteraEnMora: aSoles(carteraEnMora),
        vanAcumulado: aSoles(cs.reduce<Dec>((s, x) => (x.van ? s.plus(aDecBd(x.van)) : s), cero())),
        ventasPorSemana: orden(ventasPorSemana).map(([semana, monto]) => ({ semana, monto: aSoles(monto) })),
        ventasPorModalidad: orden(ventasPorModalidad).map(([modalidad, monto]) => ({ modalidad, monto: aSoles(monto) })),
        cobrosPorFecha: orden(cobros).map(([fecha, total]) => ({ fecha, total: aSoles(total) })),
        usoLimite: usos.map(({ x, su }) => ({
          cliente: `${x.nombres} ${x.apellidos}`,
          su: aSoles(su),
          limite: aSoles(x.limite_credito),
          usoPorcentaje: usoLimite(su, aDecBd(x.limite_credito)).toFixed(1),
        })),
        productosMasVendidos: [...productos.values()]
          .sort((a, b) => b.subtotal.comparedTo(a.subtotal))
          .map((f) => ({ codigo: f.codigo, nombre: f.nombre, cantidad: f.cantidad.toFixed(3), subtotal: aSoles(f.subtotal) })),
      };
    }
    const tienda = await this.bd.transaccionEnTienda(c.tiendaId, (t) => t.tienda());
    return { fecha: hoy, cokTea: aTasa(tienda.cok_tea, 9), clientes: clientes.length, porMoneda };
  }
}

@ApiTags('negocio')
@ApiBearerAuth()
@Roles('DUENO')
@Controller('negocio')
export class NegocioController {
  constructor(private readonly s: NegocioService) {}

  @Get('resumen')
  resumen(@Ctx() c: ContextoDueno) {
    return this.s.resumen(c);
  }
}
