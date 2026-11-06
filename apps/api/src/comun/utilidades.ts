import { createParamDecorator, ExecutionContext, Injectable, PipeTransform, SetMetadata } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { aDec, Dec, Entrada, Moneda, simboloMoneda, soles } from '@vecinopay/finance';
import { IsInt, IsISO8601, Matches, Max, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
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
/** Importe para un texto de auditoría: S/ 228.42. */
export const conSimbolo = (moneda: string, x: Dato) => `${simboloMoneda(moneda as Moneda)} ${aSoles(x)}`;
/** Tasa en JSON: texto en tanto por uno. */
export const aTasa = (x: Dato, decimales = 15) => comoDec(x).toFixed(decimales);
export const aPorcentaje = (x: Dato, decimales = 2) => comoDec(x).times(100).toFixed(decimales);

export const IsMonto = (enteros = 10) =>
  Matches(new RegExp(`^\\d{1,${enteros}}(\\.\\d{1,2})?$`), { message: '$property debe ser un monto en texto, con hasta 2 decimales.' });
export const IsTasaTexto = () =>
  Matches(/^\d{1,3}(\.\d{1,9})?$/, { message: '$property debe ser una tasa en texto, en tanto por uno, con hasta 9 decimales.' });
export const IsIdTexto = () => Matches(/^\d{1,18}$/, { message: '$property debe ser un id en texto.' });

/** En un PATCH, "" vacía una columna opcional: guarda NULL en vez de una cadena vacía. */
export const vacioANull = (x: string | undefined) => (x === '' ? null : x);

/** Como IsOptional, pero sin dejar pasar null: las columnas opcionales de los DTO no se vacían con null. */
export const Opcional = () => ValidateIf((_, valor) => valor !== undefined);

/** La colación de la BD iguala variantes de ancho y otras: un usuario solo admite ASCII imprimible. */
export const IsUsuario = () => Matches(/^[\x20-\x7e]+$/, { message: 'El usuario solo admite letras sin acentos, números y símbolos comunes.' });

/** Fecha AAAA-MM-DD que además existe en el calendario. */
export const IsFecha = () => (objetivo: object, propiedad: string) => {
  Matches(/^(19|20)\d{2}-\d{2}-\d{2}$/, { message: '$property debe tener el formato AAAA-MM-DD, entre 1900 y 2099.' })(objetivo, propiedad);
  IsISO8601({ strict: true }, { message: '$property no es una fecha válida.' })(objetivo, propiedad);
};

/** Listas: ?pagina=1&tamano=50. */
export class PaginaDto {
  @Opcional() @Type(() => Number) @IsInt() @Min(1) @Max(1000000) pagina?: number;
  @Opcional() @Type(() => Number) @IsInt() @Min(1) @Max(200) tamano?: number;
}

export const paginar = (f: PaginaDto) => {
  const tamano = f.tamano ?? 50;
  return { skip: ((f.pagina ?? 1) - 1) * tamano, take: tamano };
};
