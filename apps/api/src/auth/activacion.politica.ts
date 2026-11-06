import { ErrorNegocio } from '../comun/error-negocio';
import { ClienteBd } from '../bd/ambito-tienda';

/**
 * Persona en dos tiendas: pendiente de Adrián (docs/escalaciones.md). Hoy se rechaza la segunda activación.
 * Es el único punto de la API que cambia si elige otra opción.
 */
export async function exigirDniSinCuenta(tx: ClienteBd, dni: string): Promise<void> {
  const existente = await tx.usuario.findUnique({ where: { username: dni } });
  if (existente) {
    throw new ErrorNegocio(
      409,
      'DNI_YA_ACTIVADO',
      'Este DNI ya tiene una cuenta activada en otra tienda. Por ahora cada persona puede activar una sola cuenta.',
    );
  }
}
