import { Prisma } from '@prisma/client';

/** Nombre de la restricción única violada (P2002), o null si el error es otro. */
export function restriccionUnica(e: unknown): string | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return null;
  const objetivo = e.meta?.target;
  return Array.isArray(objetivo) ? objetivo.join(',') : String(objetivo ?? e.message);
}
