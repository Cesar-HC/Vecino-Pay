import { IsBoolean, IsIn, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { IsIdTexto, IsUsuario } from '../comun/utilidades';

export class LoginDto {
  @IsString() @MaxLength(120) @IsUsuario() username: string;
  @IsString() @MaxLength(200) password: string;
  @IsIn(['ADMIN_SISTEMA', 'DUENO', 'CLIENTE']) perfil: 'ADMIN_SISTEMA' | 'DUENO' | 'CLIENTE';
}

export class ActivarDto {
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener 8 dígitos.' }) dni: string;
  @IsString() @Length(1, 10) codigo: string;
  @IsString() @Matches(/^\d{9,15}$/, { message: 'El celular debe tener solo dígitos.' }) celular: string;
  @IsString() @MinLength(8, { message: 'La contraseña debe tener 8 o más caracteres.' }) @MaxLength(72) password: string;
  @IsString() passwordConfirmacion: string;
  @IsBoolean() aceptaDatos: boolean;
}

export class CambiarContrasenaDto {
  @IsString() @MaxLength(200) actual: string;
  @IsString() @MinLength(8, { message: 'La contraseña debe tener 8 o más caracteres.' }) @MaxLength(72) nueva: string;
}

export class CambiarTiendaDto {
  @IsIdTexto() tiendaId: string;
}
