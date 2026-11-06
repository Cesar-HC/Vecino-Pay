import { Prisma } from '@prisma/client';

/** Tabla de la restricción única violada (P2002, "dbo.usuario"), o null si el error es otro. SQL Server no da el índice. */
export function restriccionUnica(e: unknown): string | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return null;
  const objetivo = e.meta?.target;
  return Array.isArray(objetivo) ? objetivo.join(',') : String(objetivo ?? e.message);
}
