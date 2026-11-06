import { Prisma } from '@prisma/client';
import { aDec, Dec, Entrada, PartesLima } from '@vecinopay/finance';

// fecha_hora guarda hora local de Lima y Prisma la trata como UTC.
// Ningún servicio interpreta un Date de la BD: todo pasa por estas funciones.

export function aInstanteBd(p: PartesLima): Date {
  return new Date(`${p.fecha}T${p.hora}.000Z`);
}

export function dePartesBd(d: Date): PartesLima {
  const iso = d.toISOString();
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 19) };
}

export function aFechaBd(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

export function deFechaBd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** toFixed y no toString: toString usa notación científica en tasas pequeñas y aDec la rechaza. */
export function aDecBd(x: Prisma.Decimal): Dec {
  return new Dec(x.toFixed());
}

export function aDecBdONull(x: Prisma.Decimal | null): Dec | null {
  return x === null ? null : aDecBd(x);
}

/** Texto con la escala de la columna, para escribir sin pasar por number. */
export function aDecimalBd(x: Entrada, decimales: number): string {
  return aDec(x).toFixed(decimales);
}
