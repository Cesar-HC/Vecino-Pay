import type { ListadoDetalle } from '../api/tipos';
import { formatearFecha, formatearMonto } from './formato';

/** Sin celular no hay enlace. Con 9 dígitos se antepone el código de Perú. */
export function enlaceWhatsApp(celular: string | null | undefined, mensaje: string): string | null {
  const digitos = (celular ?? '').replace(/\D/g, '');
  if (!digitos) return null;
  const numero = digitos.length === 9 ? `51${digitos}` : digitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

/** Todas las cifras salen de la respuesta de la API. */
export function mensajeListado(tienda: string, l: ListadoDetalle): string {
  const m = l.moneda;
  const lineas = [
    `${tienda}: listado ${l.numero}`,
    l.cliente,
    `Corte: ${formatearFecha(l.fechaCorte)} ${l.horaCorte}`,
    `Fecha de pago: ${formatearFecha(l.fechaPago)}`,
    `Capital: ${formatearMonto(l.totalCapital, m)}`,
    `Interés: ${formatearMonto(l.totalInteres, m)}`,
    ...(l.totalMora !== '0.00' ? [`Mora: ${formatearMonto(l.totalMora, m)}`] : []),
    `${l.estado === 'PAGADO' ? 'Total pagado' : 'Total a pagar'}: ${formatearMonto(l.total, m)}`,
  ];
  if (l.moraALaFecha && l.moraALaFecha.diasMora > 0) {
    lineas.push(
      `Mora de ${l.moraALaFecha.diasMora} días: ${formatearMonto(l.moraALaFecha.mora, m)}`,
    );
    lineas.push(`Total a la fecha: ${formatearMonto(l.moraALaFecha.totalALaFecha, m)}`);
  } else if (l.estado !== 'PAGADO') {
    lineas.push('Si pagas después de la fecha de pago se agrega interés moratorio.');
  }
  return lineas.join('\n');
}
