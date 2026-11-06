import { createParamDecorator, ExecutionContext, Injectable, PipeTransform, SetMetadata } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { aDec, Dec, Entrada, soles } from '@vecinopay/finance';
import { Matches } from 'class-validator';
import { noExiste } from './error-negocio';

export type Perfil = 'ADMIN_SISTEMA' | 'DUENO' | 'CLIENTE';

export type Contexto =
  | { perfil: 'ADMIN_SISTEMA'; usuarioId: bigint }
  | { perfil: 'DUENO'; usuarioId: bigint; tiendaId: bigint }
  | { perfil: 'CLIENTE'; usuarioId: bigint; tiendaId: bigint; clienteId: bigint };
export type ContextoDueno = Extract<Contexto, { perfil: 'DUENO' }>;
export type ContextoCliente = Extract<Contexto, { perfil: 'CLIENTE' }>;

export const CLAVE_PUBLICO = 'publico';
export const CLAVE_ROLES = 'roles';
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);
export const Roles = (...perfiles: Perfil[]) => SetMetadata(CLAVE_ROLES, perfiles);
export const Ctx = createParamDecorator(
  (_: unknown, c: ExecutionContext): Contexto => c.switchToHttp().getRequest().contexto,
);

/** Los id viajan como texto; un id inválido responde igual que uno inexistente. */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, bigint> {
  transform(valor: string): bigint {
    if (!/^\d{1,18}$/.test(valor)) throw noExiste();
    return BigInt(valor);
  }
}

export const aId = (x: bigint | null | undefined) => (x === null || x === undefined ? null : x.toString());

type Dato = Entrada | Prisma.Decimal;
const comoDec = (x: Dato): Dec => aDec(typeof x === 'string' ? x : x.toFixed());

/** Dinero en JSON: texto con 2 decimales. */
export const aSoles = (x: Dato) => soles(comoDec(x));
/** Tasa en JSON: texto en tanto por uno. */
export const aTasa = (x: Dato, decimales = 15) => comoDec(x).toFixed(decimales);
export const aPorcentaje = (x: Dato, decimales = 2) => comoDec(x).times(100).toFixed(decimales);

export const IsMonto = () =>
  Matches(/^\d{1,10}(\.\d{1,2})?$/, { message: '$property debe ser un monto en texto, con hasta 2 decimales.' });
export const IsTasaTexto = () =>
  Matches(/^\d{1,3}(\.\d{1,15})?$/, { message: '$property debe ser una tasa en texto, en tanto por uno.' });
export const IsIdTexto = () => Matches(/^\d{1,18}$/, { message: '$property debe ser un id en texto.' });
