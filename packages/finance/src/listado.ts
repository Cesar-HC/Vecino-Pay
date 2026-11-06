import { diasEntre, validarFecha } from './calendario';
import { aDec, Dec, Entrada, red } from './decimal';
import { ErrorFinanciero } from './errores';
import { tasaDeDias } from './tasas';

/** 6.3h: I = Red(P·[(1+TED)^d − 1]). */
export function interesCompra(p: Entrada, ted: Entrada, dias: number): Dec {
  return red(aDec(p).times(tasaDeDias(ted, dias)));
}

export interface ItemListado {
  orden: number;
  tipo: 'COMPRA' | 'CUOTA';
  ref: string;
  fecha: string;
  dias: number;
  capital: Dec;
  interes: Dec;
  total: Dec;
}

/**
 * ListadoDePago (Figura 33, 6.3h). Ordena las compras por fecha operativa de forma estable,
 * redondea el interés compra por compra y agrega las cuotas que vencen en la fecha de pago,
 * ordenadas por ref para que el listado siempre se muestre igual (Tabla 31). Sus días son los
 * del período de la cuota.
 */
export function listadoDePago(a: {
  compras: { ref: string; fechaOperativa: string; capital: Entrada }[];
  cuotas?: { ref: string; capital: Entrada; interes: Entrada; dias: number }[];
  fechaPago: string;
  ted: Entrada;
}) {
  validarFecha(a.fechaPago);
  const ordenadas = a.compras
    .map((c, i) => ({ c, i }))
    .sort((x, y) => diasEntre(y.c.fechaOperativa, x.c.fechaOperativa) || x.i - y.i)
    .map(({ c }) => c);

  const items: ItemListado[] = [];
  const agregar = (
    tipo: ItemListado['tipo'],
    ref: string,
    fecha: string,
    dias: number,
    capital: Dec,
    interes: Dec,
  ) =>
    items.push({
      orden: items.length + 1,
      tipo,
      ref,
      fecha,
      dias,
      capital,
      interes,
      total: capital.plus(interes),
    });

  for (const c of ordenadas) {
    const dias = diasEntre(c.fechaOperativa, a.fechaPago);
    if (dias < 0) {
      throw new ErrorFinanciero(
        'FECHA_ORDEN',
        'La fecha de la compra no puede ser posterior a su fecha de pago.',
      );
    }
    const capital = aDec(c.capital);
    agregar('COMPRA', c.ref, c.fechaOperativa, dias, capital, interesCompra(capital, a.ted, dias));
  }
  const cuotas = [...(a.cuotas ?? [])].sort((x, y) => (x.ref < y.ref ? -1 : x.ref > y.ref ? 1 : 0));
  for (const q of cuotas) {
    agregar('CUOTA', q.ref, a.fechaPago, q.dias, aDec(q.capital), aDec(q.interes));
  }

  const totalCapital = items.reduce((s, i) => s.plus(i.capital), new Dec(0));
  const totalInteres = items.reduce((s, i) => s.plus(i.interes), new Dec(0));
  return { items, totalCapital, totalInteres, total: totalCapital.plus(totalInteres) };
}
