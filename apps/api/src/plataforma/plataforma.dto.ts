import { IsIn, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { IsFecha, IsIdTexto, IsTasaTexto, IsUsuario, Opcional, PaginaDto } from '../comun/utilidades';

export class EstadoDto {
  @IsIn(['ACTIVO', 'INACTIVO']) estado: 'ACTIVO' | 'INACTIVO';
}

export class CrearTiendaDto {
  @Matches(/^\d{11}$/, { message: 'El RUC debe tener 11 dígitos.' }) ruc: string;
  @IsString() @Length(1, 150) razonSocial: string;
  @IsString() @Length(1, 100) nombreComercial: string;
  @IsString() @Length(1, 40) giro: string;
  @Opcional() @IsString() @MaxLength(15) telefono?: string;
  @Opcional() @IsString() @MaxLength(200) direccion?: string;
  @IsTasaTexto() cokTea: string;
  @IsString() @Length(1, 120) @IsUsuario() usuarioDueno: string;
  @Opcional() @IsString() @MinLength(8) @MaxLength(72) claveTemporal?: string;
  @Opcional() @IsString() @MaxLength(160) nombresDueno?: string;
}

export class EditarTiendaDto {
  @Opcional() @Matches(/^\d{11}$/, { message: 'El RUC debe tener 11 dígitos.' }) ruc?: string;
  @Opcional() @IsString() @Length(1, 150) razonSocial?: string;
  @Opcional() @IsString() @Length(1, 100) nombreComercial?: string;
  @Opcional() @IsString() @Length(1, 40) giro?: string;
  @Opcional() @IsString() @MaxLength(15) telefono?: string;
  @Opcional() @IsString() @MaxLength(200) direccion?: string;
  @Opcional() @IsTasaTexto() cokTea?: string;
}

export class CrearUsuarioDto {
  @IsString() perfil: string;
  @IsString() @Length(1, 120) @IsUsuario() username: string;
  @IsString() @Length(1, 160) nombres: string;
  @IsString() @MinLength(8) @MaxLength(72) claveTemporal: string;
  @Opcional() @IsIdTexto() tiendaId?: string;
}

export class EditarUsuarioDto {
  @Opcional() @IsString() @Length(1, 160) nombres?: string;
  @Opcional() @IsIdTexto() tiendaId?: string;
}

export class RestablecerClaveDto {
  @IsString() @MinLength(8) @MaxLength(72) claveTemporal: string;
}

export class FiltroTiendasDto extends PaginaDto {
  @Opcional() @IsString() texto?: string;
  @Opcional() @IsIn(['ACTIVO', 'INACTIVO']) estado?: string;
}

export class FiltroUsuariosDto extends PaginaDto {
  @Opcional() @IsString() texto?: string;
  @Opcional() @IsIn(['ADMIN_SISTEMA', 'DUENO', 'CLIENTE']) perfil?: string;
  @Opcional() @IsIdTexto() tiendaId?: string;
}

export class FiltroAuditoriaDto extends PaginaDto {
  @Opcional() @IsFecha() desde?: string;
  @Opcional() @IsFecha() hasta?: string;
  @Opcional() @IsIdTexto() tiendaId?: string;
  @Opcional() @IsIdTexto() usuarioId?: string;
  @Opcional() @IsIn(['ALTA', 'BAJA', 'CAMBIO', 'LOGIN', 'RECHAZO']) accion?: string;
}
