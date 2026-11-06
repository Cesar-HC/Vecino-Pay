import { IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { IsFecha, IsIdTexto, IsTasaTexto, PaginaDto } from '../comun/utilidades';

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

export class FiltroTiendasDto extends PaginaDto {
  @IsOptional() @IsString() texto?: string;
  @IsOptional() @IsIn(['ACTIVO', 'INACTIVO']) estado?: string;
}

export class FiltroUsuariosDto extends PaginaDto {
  @IsOptional() @IsString() texto?: string;
  @IsOptional() @IsIn(['ADMIN_SISTEMA', 'DUENO', 'CLIENTE']) perfil?: string;
  @IsOptional() @IsIdTexto() tiendaId?: string;
}

export class FiltroAuditoriaDto extends PaginaDto {
  @IsOptional() @IsFecha() desde?: string;
  @IsOptional() @IsFecha() hasta?: string;
  @IsOptional() @IsIdTexto() tiendaId?: string;
  @IsOptional() @IsIdTexto() usuarioId?: string;
  @IsOptional() @IsIn(['ALTA', 'BAJA', 'CAMBIO', 'LOGIN', 'RECHAZO']) accion?: string;
}
