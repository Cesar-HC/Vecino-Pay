import { sumarMeses, validarFecha } from './calendario';
import { validarDiasCiclo } from './validaciones';

export interface Ciclo {
  fechaCorte: string;
  fechaPago: string;
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/**
 * AsignarCiclo (Figura 31, Tabla 13). Trabaja con la fecha operativa, que ya aplica la hora de corte.
 * Día operativo <= corte: corte del mismo mes; si no, del mes siguiente.
 * Pago > corte: día de pago del mes del corte; si no, del mes siguiente.
 */
export function asignarCiclo(a: {
  fechaOperativa: string;
  diaCorte: number;
  diaPago: number;
}): Ciclo {
  validarDiasCiclo(a.diaCorte, a.diaPago);
  validarFecha(a.fechaOperativa);
  const mes = a.fechaOperativa.slice(0, 7);
  const dia = Number(a.fechaOperativa.slice(8));
  const corteDelMes = `${mes}-${dosDigitos(a.diaCorte)}`;
  const fechaCorte = dia <= a.diaCorte ? corteDelMes : sumarMeses(corteDelMes, 1);
  const pagoDelMesDeCorte = `${fechaCorte.slice(0, 7)}-${dosDigitos(a.diaPago)}`;
  const fechaPago = a.diaPago > a.diaCorte ? pagoDelMesDeCorte : sumarMeses(pagoDelMesDeCorte, 1);
  return { fechaCorte, fechaPago };
}
