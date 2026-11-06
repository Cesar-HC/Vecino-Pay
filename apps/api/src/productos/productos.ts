import { Body, Controller, Get, Injectable, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { producto } from '@prisma/client';
import { validarPrecios } from '@vecinopay/finance';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { BdService } from '../bd/bd.service';
import { aDecBd, aDecimalBd } from '../bd/conversiones';
import { restriccionUnica } from '../bd/errores-bd';
import { ErrorNegocio, noExiste } from '../comun/error-negocio';
import { aId, aSoles, ContextoDueno, Ctx, IsMonto, PaginaDto, paginar, ParseIdPipe, Roles } from '../comun/utilidades';
import { EstadoDto } from '../plataforma/plataforma.dto';

const URL_IMAGEN = /^https?:\/\/\S+\.(jpg|jpeg|png)$/i;

export class CrearProductoDto {
  @IsString() @Length(1, 30) codigo: string;
  @IsString() @Length(1, 120) nombre: string;
  @IsOptional() @IsString() @MaxLength(60) marca?: string;
  @IsOptional() @IsString() @MaxLength(500) descripcion?: string;
  @IsString() @Length(1, 5) unidad: string;
  @IsOptional() @IsString() @MaxLength(150) proveedor?: string;
  @IsOptional() @Matches(URL_IMAGEN, { message: 'La imagen debe ser una URL .jpg o .png.' }) @MaxLength(300) imagenUrl?: string;
  @IsMonto(8) precioContado: string;
  @IsMonto(8) precioLista: string;
  @IsBoolean() permiteFinMes: boolean;
  @IsBoolean() permiteCuotas: boolean;
}

export class EditarProductoDto {
  @IsOptional() @IsString() @Length(1, 30) codigo?: string;
  @IsOptional() @IsString() @Length(1, 120) nombre?: string;
  @IsOptional() @IsString() @MaxLength(60) marca?: string;
  @IsOptional() @IsString() @MaxLength(500) descripcion?: string;
  @IsOptional() @IsString() @Length(1, 5) unidad?: string;
  @IsOptional() @IsString() @MaxLength(150) proveedor?: string;
  @IsOptional() @Matches(URL_IMAGEN, { message: 'La imagen debe ser una URL .jpg o .png.' }) @MaxLength(300) imagenUrl?: string;
  @IsOptional() @IsMonto(8) precioContado?: string;
  @IsOptional() @IsMonto(8) precioLista?: string;
  @IsOptional() @IsBoolean() permiteFinMes?: boolean;
  @IsOptional() @IsBoolean() permiteCuotas?: boolean;
}

export class FiltroProductosDto extends PaginaDto {
  @IsOptional() @IsString() texto?: string;
  @IsOptional() @IsIn(['ACTIVO', 'INACTIVO']) estado?: string;
  @IsOptional() @IsIn(['FIN_MES', 'CUOTAS']) modalidad?: string;
}

const productoDto = (p: producto) => ({
  id: aId(p.id),
  codigo: p.codigo,
  nombre: p.nombre,
  marca: p.marca,
  descripcion: p.descripcion,
  unidad: p.unidad,
  proveedor: p.proveedor,
  imagenUrl: p.imagen_url,
  precioContado: aSoles(p.precio_contado),
  precioLista: aSoles(p.precio_lista),
  permiteFinMes: p.permite_fin_mes,
  permiteCuotas: p.permite_cuotas,
  estado: p.estado,
});

function exigirModalidad(finMes: boolean, cuotas: boolean) {
  if (!finMes && !cuotas) {
    throw new ErrorNegocio(400, 'MODALIDAD', 'El producto debe permitir al menos una modalidad de venta.');
  }
}

@Injectable()
export class ProductosService {
  constructor(private readonly bd: BdService) {}

  private conflicto(e: unknown): never {
    if (restriccionUnica(e)?.includes('producto')) {
      throw new ErrorNegocio(409, 'CODIGO_DUPLICADO', 'Ya tienes un producto con ese código.');
    }
    throw e;
  }

  async listar(c: ContextoDueno, f: FiltroProductosDto) {
    const bd = this.bd.enTienda(c.tiendaId);
    const where = {
      estado: f.estado,
      permite_fin_mes: f.modalidad === 'FIN_MES' ? true : undefined,
      permite_cuotas: f.modalidad === 'CUOTAS' ? true : undefined,
      ...(f.texto ? { OR: [{ nombre: { contains: f.texto } }, { codigo: { contains: f.texto } }] } : {}),
    };
    const items = await bd.producto.findMany({ where, orderBy: { codigo: 'asc' }, ...paginar(f) });
    return { items: items.map(productoDto), total: await bd.producto.count({ where }) };
  }

  async crear(c: ContextoDueno, d: CrearProductoDto) {
    validarPrecios(d.precioContado, d.precioLista);
    exigirModalidad(d.permiteFinMes, d.permiteCuotas);
    try {
      return await this.bd.transaccionEnTienda(c.tiendaId, async (t) => {
        const p = await t.bd.producto.create({
          data: {
            tienda_id: t.tiendaId,
            codigo: d.codigo,
            nombre: d.nombre,
            marca: d.marca ?? null,
            descripcion: d.descripcion ?? null,
            unidad: d.unidad,
            proveedor: d.proveedor ?? null,
            imagen_url: d.imagenUrl ?? null,
            precio_contado: aDecimalBd(d.precioContado, 2),
            precio_lista: aDecimalBd(d.precioLista, 2),
            permite_fin_mes: d.permiteFinMes,
            permite_cuotas: d.permiteCuotas,
          },
        });
        await t.auditar({ usuarioId: c.usuarioId, accion: 'ALTA', tabla: 'producto', registroId: p.id, detalle: `Alta del producto ${p.codigo}.` });
        return productoDto(p);
      });
    } catch (e) {
      return this.conflicto(e);
    }
  }

  async editar(c: ContextoDueno, id: bigint, d: EditarProductoDto) {
    try {
      return await this.bd.transaccionEnTienda(c.tiendaId, async (t) => {
        const actual = await t.bd.producto.findFirst({ where: { id } });
        if (!actual) throw noExiste('El producto');
        validarPrecios(d.precioContado ?? aDecBd(actual.precio_contado), d.precioLista ?? aDecBd(actual.precio_lista));
        exigirModalidad(d.permiteFinMes ?? actual.permite_fin_mes, d.permiteCuotas ?? actual.permite_cuotas);
        const p = await t.bd.producto.update({
          where: { id },
          data: {
            codigo: d.codigo,
            nombre: d.nombre,
            marca: d.marca,
            descripcion: d.descripcion,
            unidad: d.unidad,
            proveedor: d.proveedor,
            imagen_url: d.imagenUrl,
            precio_contado: d.precioContado === undefined ? undefined : aDecimalBd(d.precioContado, 2),
            precio_lista: d.precioLista === undefined ? undefined : aDecimalBd(d.precioLista, 2),
            permite_fin_mes: d.permiteFinMes,
            permite_cuotas: d.permiteCuotas,
          },
        });
        await t.auditar({ usuarioId: c.usuarioId, accion: 'CAMBIO', tabla: 'producto', registroId: id, detalle: `Edición del producto ${p.codigo}.` });
        return productoDto(p);
      });
    } catch (e) {
      return this.conflicto(e);
    }
  }

  estado(c: ContextoDueno, id: bigint, estado: 'ACTIVO' | 'INACTIVO') {
    return this.bd.transaccionEnTienda(c.tiendaId, async (t) => {
      if (!(await t.bd.producto.findFirst({ where: { id } }))) throw noExiste('El producto');
      const p = await t.bd.producto.update({ where: { id }, data: { estado } });
      await t.auditar({
        usuarioId: c.usuarioId,
        accion: estado === 'INACTIVO' ? 'BAJA' : 'CAMBIO',
        tabla: 'producto',
        registroId: id,
        detalle: `${estado === 'INACTIVO' ? 'Baja' : 'Reactivación'} del producto ${p.codigo}.`,
      });
      return productoDto(p);
    });
  }
}

@ApiTags('productos')
@ApiBearerAuth()
@Roles('DUENO')
@Controller('productos')
export class ProductosController {
  constructor(private readonly s: ProductosService) {}

  @Get()
  listar(@Ctx() c: ContextoDueno, @Query() f: FiltroProductosDto) {
    return this.s.listar(c, f);
  }

  @Post()
  crear(@Ctx() c: ContextoDueno, @Body() d: CrearProductoDto) {
    return this.s.crear(c, d);
  }

  @Patch(':id')
  editar(@Ctx() c: ContextoDueno, @Param('id', ParseIdPipe) id: bigint, @Body() d: EditarProductoDto) {
    return this.s.editar(c, id, d);
  }

  @Patch(':id/estado')
  estado(@Ctx() c: ContextoDueno, @Param('id', ParseIdPipe) id: bigint, @Body() d: EstadoDto) {
    return this.s.estado(c, id, d.estado);
  }
}
