import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Contexto, Ctx, Publico, Roles } from '../comun/utilidades';
import { ActivarDto, CambiarContrasenaDto, CambiarTiendaDto, LoginDto } from './auth.dto';
import { AuthService } from './auth.service';
import { GuardIntentos } from './guardias';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @UseGuards(GuardIntentos)
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Publico()
  @UseGuards(GuardIntentos)
  @Post('activar')
  activar(@Body() dto: ActivarDto) {
    return this.auth.activar(dto);
  }

  @Roles('ADMIN_SISTEMA', 'DUENO', 'CLIENTE')
  @Get('yo')
  yo(@Ctx() c: Contexto) {
    return this.auth.yo(c);
  }

  @Roles('ADMIN_SISTEMA', 'DUENO', 'CLIENTE')
  @HttpCode(204)
  @Post('cambiar-contrasena')
  cambiarContrasena(@Ctx() c: Contexto, @Body() dto: CambiarContrasenaDto) {
    return this.auth.cambiarContrasena(c, dto);
  }

  @Roles('DUENO')
  @HttpCode(200)
  @Post('cambiar-tienda')
  cambiarTienda(@Ctx() c: Contexto, @Body() dto: CambiarTiendaDto) {
    return this.auth.cambiarTienda(c, BigInt(dto.tiendaId));
  }
}
