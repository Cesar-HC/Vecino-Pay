import { IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { IsIdTexto, IsTasaTexto } from '../comun/utilidades';

export class EstadoDto {
  @IsIn(['ACTIVO', 'INACTIVO']) estado: 'ACTIVO' | 'INACTIVO';
}

export class CrearTiendaDto {
  @Matches(/^\d{11}$/, { message: 'El RUC debe tener 11 dígitos.' }) ruc: string;
  @IsString() @Length(1, 150) razonSocial: string;
  @IsString() @Length(1, 100) nombreComercial: string;
  @IsString() @Length(1, 40) giro: string;
  @IsOptional() @IsString() @MaxLength(15) telefono?: string;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsTasaTexto() cokTea: string;
  @IsString() @Length(1, 120) usuarioDueno: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(72) claveTemporal?: string;
  @IsOptional() @IsString() @MaxLength(160) nombresDueno?: string;
}

export class EditarTiendaDto {
  @IsOptional() @Matches(/^\d{11}$/, { message: 'El RUC debe tener 11 dígitos.' }) ruc?: string;
  @IsOptional() @IsString() @Length(1, 150) razonSocial?: string;
  @IsOptional() @IsString() @Length(1, 100) nombreComercial?: string;
  @IsOptional() @IsString() @Length(1, 40) giro?: string;
  @IsOptional() @IsString() @MaxLength(15) telefono?: string;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @IsTasaTexto() cokTea?: string;
}

export class CrearUsuarioDto {
  @IsString() perfil: string;
  @IsString() @Length(1, 120) username: string;
  @IsString() @Length(1, 160) nombres: string;
  @IsString() @MinLength(8) @MaxLength(72) claveTemporal: string;
  @IsOptional() @IsIdTexto() tiendaId?: string;
}

export class EditarUsuarioDto {
  @IsOptional() @IsString() @Length(1, 160) nombres?: string;
  @IsOptional() @IsIdTexto() tiendaId?: string;
}

export class RestablecerClaveDto {
  @IsString() @MinLength(8) @MaxLength(72) claveTemporal: string;
}

export class FiltroTiendasDto {
  @IsOptional() @IsString() texto?: string;
  @IsOptional() @IsIn(['ACTIVO', 'INACTIVO']) estado?: string;
}

export class FiltroUsuariosDto {
  @IsOptional() @IsString() texto?: string;
  @IsOptional() @IsIn(['ADMIN_SISTEMA', 'DUENO', 'CLIENTE']) perfil?: string;
  @IsOptional() @IsIdTexto() tiendaId?: string;
}

export class FiltroAuditoriaDto {
  @ValidateIf((o) => o.desde !== undefined) @Matches(/^\d{4}-\d{2}-\d{2}$/) desde?: string;
  @ValidateIf((o) => o.hasta !== undefined) @Matches(/^\d{4}-\d{2}-\d{2}$/) hasta?: string;
  @IsOptional() @IsIdTexto() tiendaId?: string;
  @IsOptional() @IsIdTexto() usuarioId?: string;
  @IsOptional() @IsIn(['ALTA', 'BAJA', 'CAMBIO', 'LOGIN', 'RECHAZO']) accion?: string;
  @IsOptional() @Matches(/^\d{1,6}$/) pagina?: string;
  @IsOptional() @Matches(/^\d{1,3}$/) tamano?: string;
}
