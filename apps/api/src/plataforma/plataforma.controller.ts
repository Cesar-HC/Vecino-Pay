import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Contexto, Ctx, ParseIdPipe, Roles } from '../comun/utilidades';
import {
  CrearTiendaDto,
  CrearUsuarioDto,
  EditarTiendaDto,
  EditarUsuarioDto,
  EstadoDto,
  FiltroAuditoriaDto,
  FiltroTiendasDto,
  FiltroUsuariosDto,
  RestablecerClaveDto,
} from './plataforma.dto';
import { PlataformaService } from './plataforma.service';

@ApiTags('plataforma')
@ApiBearerAuth()
@Roles('ADMIN_SISTEMA')
@Controller()
export class PlataformaController {
  constructor(private readonly s: PlataformaService) {}

  @Get('plataforma/resumen')
  resumen() {
    return this.s.resumen();
  }

  @Get('tiendas')
  listarTiendas(@Query() f: FiltroTiendasDto) {
    return this.s.listarTiendas(f);
  }

  @Post('tiendas')
  crearTienda(@Ctx() c: Contexto, @Body() dto: CrearTiendaDto) {
    return this.s.crearTienda(c, dto);
  }

  @Patch('tiendas/:id')
  editarTienda(@Ctx() c: Contexto, @Param('id', ParseIdPipe) id: bigint, @Body() dto: EditarTiendaDto) {
    return this.s.editarTienda(c, id, dto);
  }

  @Patch('tiendas/:id/estado')
  estadoTienda(@Ctx() c: Contexto, @Param('id', ParseIdPipe) id: bigint, @Body() dto: EstadoDto) {
    return this.s.estadoTienda(c, id, dto.estado);
  }

  @Get('usuarios')
  listarUsuarios(@Query() f: FiltroUsuariosDto) {
    return this.s.listarUsuarios(f);
  }

  @Post('usuarios')
  crearUsuario(@Ctx() c: Contexto, @Body() dto: CrearUsuarioDto) {
    return this.s.crearUsuario(c, dto);
  }

  @Patch('usuarios/:id')
  editarUsuario(@Ctx() c: Contexto, @Param('id', ParseIdPipe) id: bigint, @Body() dto: EditarUsuarioDto) {
    return this.s.editarUsuario(c, id, dto);
  }

  @HttpCode(204)
  @Post('usuarios/:id/restablecer-clave')
  restablecer(@Ctx() c: Contexto, @Param('id', ParseIdPipe) id: bigint, @Body() dto: RestablecerClaveDto) {
    return this.s.restablecerClave(c, id, dto.claveTemporal);
  }

  @Patch('usuarios/:id/estado')
  estadoUsuario(@Ctx() c: Contexto, @Param('id', ParseIdPipe) id: bigint, @Body() dto: EstadoDto) {
    return this.s.estadoUsuario(c, id, dto.estado);
  }

  @Get('auditoria')
  auditoria(@Query() f: FiltroAuditoriaDto) {
    return this.s.auditoria(f);
  }
}
