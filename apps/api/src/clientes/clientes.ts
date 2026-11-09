import { randomInt } from 'node:crypto';
import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { cliente, Prisma } from '@prisma/client';
import {
  creditoDisponible,
  cuantizarTasa,
  Dec,
  fechaOperativaLocal,
  partesLima,
  tasaEfectivaDiaria,
  TasaPactada,
  tea,
  tem,
  usoLimite,
  validarDiasCiclo,
  validarMaxMeses,
  validarMontoPositivo,
  validarTasa,
} from '@vecinopay/finance';
import { Type } from 'class-transformer';
import { Equals, IsDefined, IsIn, IsInt, IsString, Length, Matches, MaxLength, ValidateNested } from 'class-validator';
import { Inject } from '@nestjs/common';
import { armarDetalle } from '../auditoria/detalle';
import { Ambito } from '../bd/ambito-tienda';
import { BdService } from '../bd/bd.service';
import { aDecBd, aDecimalBd, deFechaBd } from '../bd/conversiones';
import { restriccionUnica } from '../bd/errores-bd';
import { ErrorNegocio, noExiste } from '../comun/error-negocio';
import { aId, aSoles, aTasa, ContextoDueno, Ctx, IsMonto, IsTasaTexto, Opcional, PaginaDto, paginar, ParseIdPipe, Roles, vacioANull } from '../comun/utilidades';
import { EstadoDto } from '../plataforma/plataforma.dto';
import { RELOJ, Reloj } from '../reloj/reloj';
import { calcularDeuda, calcularSu, CompraParaSu } from './saldos';

export class TasaDto {
  @IsIn(['EFECTIVA', 'NOMINAL']) tipo: 'EFECTIVA' | 'NOMINAL';
  @IsTasaTexto() valor: string;
  @IsInt() plazo: number;
  @Opcional() @IsInt() capitalizacion?: number;
}

export class CrearClienteDto {
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener 8 dígitos.' }) dni: string;
  @IsString() @Length(1, 80) nombres: string;
  @IsString() @Length(1, 80) apellidos: string;
  @Opcional() @IsString() @Matches(/^(\d{9,15})?$/, { message: 'El celular debe tener entre 9 y 15 dígitos.' }) celular?: string;
  @Opcional() @IsString() @MaxLength(200) direccion?: string;
  @Equals(true, { message: 'Debe constar que el cliente aceptó el tratamiento de sus datos personales.' }) aceptaDatos: boolean;
  @IsIn(['PEN', 'USD']) moneda: 'PEN' | 'USD';
  @IsMonto() limiteCredito: string;
  @IsInt() maxMeses: number;
  @IsInt() diaCorte: number;
  @IsInt() diaPago: number;
  @IsDefined() @ValidateNested() @Type(() => TasaDto) tasa: TasaDto;
  @IsDefined() @ValidateNested() @Type(() => TasaDto) tasaMora: TasaDto;
}

export class EditarClienteDto {
  @Opcional() @IsString() @Length(1, 80) nombres?: string;
  @Opcional() @IsString() @Length(1, 80) apellidos?: string;
  @Opcional() @IsString() @Matches(/^(\d{9,15})?$/, { message: 'El celular debe tener entre 9 y 15 dígitos.' }) celular?: string;
  @Opcional() @IsString() @MaxLength(200) direccion?: string;
  @Opcional() @IsIn(['PEN', 'USD']) moneda?: 'PEN' | 'USD';
  @Opcional() @IsMonto() limiteCredito?: string;
  @Opcional() @IsInt() maxMeses?: number;
  @Opcional() @IsInt() diaCorte?: number;
  @Opcional() @IsInt() diaPago?: number;
  @Opcional() @ValidateNested() @Type(() => TasaDto) tasa?: TasaDto;
  @Opcional() @ValidateNested() @Type(() => TasaDto) tasaMora?: TasaDto;
}

export class CalcularTasasDto {
  @IsDefined() @ValidateNested() @Type(() => TasaDto) tasa: TasaDto;
}

export class FiltroClientesDto extends PaginaDto {
  @Opcional() @IsString() texto?: string;
  @Opcional() @IsIn(['ACTIVO', 'INACTIVO']) estado?: string;
}

/** Único punto donde se validan y calculan tasas. Si Adrián pide un tope, va aquí. */
export function calcularTasaCliente(t: TasaDto) {
  const pactada: TasaPactada = {
    tipo: t.tipo,
    valor: t.valor,
    plazo: t.plazo,
    // Nominal sin capitalización: 1 (6.3c), porque CK_cliente_capitalizacion no admite NULL en nominales.
    capitalizacion: t.tipo === 'NOMINAL' ? (t.capitalizacion ?? 1) : null,
  };
  validarTasa(pactada);
  return { pactada, ted: cuantizarTasa(tasaEfectivaDiaria(pactada)) };
}

/** Compras de un cliente en la forma que pide la regla de SU. */
export async function comprasParaSu(bd: Ambito, clienteId: bigint): Promise<CompraParaSu[]> {
  const compras = await bd.compra.findMany({
    where: { cliente_id: clienteId, estado: 'PENDIENTE' },
    include: { cuota: true },
  });
  return compras.map((c) => ({
    modalidad: c.modalidad,
    estado: c.estado,
    montoLista: aDecBd(c.monto_lista),
    cuotas: c.cuota.map((q) => ({ numero: q.numero, estado: q.estado, saldoFinal: aDecBd(q.saldo_final) })),
  }));
}

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function codigoActivacion(nombreComercial: string): string {
  const letras = nombreComercial
    .normalize('NFD')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  const iniciales = nombreComercial
    .normalize('NFD')
    .split(/\s+/)
    .map((p) => p.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase())
    .join('');
  const prefijo = (iniciales.length >= 3 ? iniciales : letras).padEnd(3, 'V').slice(0, 3);
  const azar = Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  return `${prefijo}-${azar}`;
}

@Injectable()
export class ClientesService {
  constructor(
    private readonly bd: BdService,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  private dto(c: cliente, su: Dec) {
    const limite = aDecBd(c.limite_credito);
    return {
      id: aId(c.id),
      dni: c.dni,
      nombres: c.nombres,
      apellidos: c.apellidos,
      celular: c.celular,
      direccion: c.direccion,
      moneda: c.moneda,
      limiteCredito: aSoles(limite),
      maxMeses: c.max_meses,
      diaCorte: c.dia_corte,
      horaCorte: '17:00:00',
      diaPago: c.dia_pago,
      tipoTasa: c.tipo_tasa,
      valorTasa: aTasa(c.valor_tasa, 9),
      plazoTasa: c.plazo_tasa,
      capitalizacion: c.capitalizacion,
      tipoTasaMora: c.tipo_tasa_mora,
      valorTasaMora: aTasa(c.valor_tasa_mora, 9),
      ted: aTasa(c.ted),
      tedMora: aTasa(c.ted_mora),
      activado: c.usuario_id !== null,
      estado: c.estado,
      su: aSoles(su),
      disponible: aSoles(creditoDisponible(limite, su)),
      usoPorcentaje: usoLimite(su, limite).toFixed(1),
    };
  }

  async listar(c: ContextoDueno, f: FiltroClientesDto) {
    const bd = this.bd.enTienda(c.tiendaId);
    const where = {
      estado: f.estado,
      ...(f.texto
        ? { OR: [{ dni: { contains: f.texto } }, { nombres: { contains: f.texto } }, { apellidos: { contains: f.texto } }] }
        : {}),
    };
    const filas = await bd.cliente.findMany({ where, orderBy: { id: 'asc' }, ...paginar(f) });
    const items = await Promise.all(filas.map(async (x) => this.dto(x, calcularSu(await comprasParaSu(bd, x.id)))));
    return { items, total: await bd.cliente.count({ where }) };
  }

  /** Incluye la deuda a la fecha (6.3m, ver calcularDeuda). */
  async obtener(c: ContextoDueno, id: bigint) {
    const bd = this.bd.enTienda(c.tiendaId);
    const x = await bd.cliente.findFirst({ where: { id } });
    if (!x) throw noExiste('El cliente');
    const su = calcularSu(await comprasParaSu(bd, id));
    const listados = await bd.listado_pago.findMany({ where: { cliente_id: id, estado: { not: 'PAGADO' } } });
    const p = partesLima(this.reloj.ahora());
    const hoy = fechaOperativaLocal(p.fecha, p.hora);
    const compras = await bd.compra.findMany({
      where: { cliente_id: id, estado: 'PENDIENTE' },
      include: { cuota: { include: { listado_item: true } }, listado_item: true },
    });
    const deuda = calcularDeuda({
      listados: listados.map((l) => ({
        total: aDecBd(l.total),
        totalCapital: aDecBd(l.total_capital),
        fechaPago: deFechaBd(l.fecha_pago),
      })),
      comprasSinListar: compras
        .filter((k) => k.modalidad === 'FIN_MES' && k.listado_item.length === 0)
        .map((k) => aDecBd(k.monto_lista)),
      cuotasSinListar: compras.flatMap((k) =>
        k.cuota.filter((q) => q.estado === 'PENDIENTE' && q.listado_item.length === 0).map((q) => aDecBd(q.amortizacion)),
      ),
      tedMora: aDecBd(x.ted_mora),
      hoy,
    });
    return {
      ...this.dto(x, su),
      deudaALaFecha: aSoles(deuda),
      codigoActivacion: x.codigo_activacion,
    };
  }

  async crear(c: ContextoDueno, d: CrearClienteDto) {
    validarMaxMeses(d.maxMeses);
    validarDiasCiclo(d.diaCorte, d.diaPago);
    validarMontoPositivo(d.limiteCredito, 'El límite de crédito');
    const { pactada, ted } = calcularTasaCliente(d.tasa);
    const mora = calcularTasaCliente(d.tasaMora);

    for (let intento = 1; ; intento++) {
      try {
        return await this.bd.transaccionEnTienda(c.tiendaId, async (t) => {
          // P2002 no dice qué índice chocó: el DNI se comprueba antes y lo que quede es el código de activación.
          if (await t.bd.cliente.findFirst({ where: { dni: d.dni }, select: { id: true } })) {
            throw new ErrorNegocio(409, 'DNI_DUPLICADO', 'Ya tienes un cliente con ese DNI.');
          }
          const tienda = await t.tienda();
          const x = await t.bd.cliente.create({
            data: {
              tienda_id: t.tiendaId,
              dni: d.dni,
              nombres: d.nombres,
              apellidos: d.apellidos,
              celular: vacioANull(d.celular) ?? null,
              direccion: d.direccion ?? null,
              moneda: d.moneda,
              limite_credito: aDecimalBd(d.limiteCredito, 2),
              max_meses: d.maxMeses,
              dia_corte: d.diaCorte,
              dia_pago: d.diaPago,
              tipo_tasa: d.tasa.tipo,
              valor_tasa: aDecimalBd(d.tasa.valor, 9),
              plazo_tasa: d.tasa.plazo,
              capitalizacion: pactada.capitalizacion ?? null,
              tipo_tasa_mora: d.tasaMora.tipo,
              valor_tasa_mora: aDecimalBd(d.tasaMora.valor, 9),
              ted: ted.toFixed(15),
              ted_mora: mora.ted.toFixed(15),
              codigo_activacion: codigoActivacion(tienda.nombre_comercial),
            },
          });
          // Plazo y capitalización de la mora no tienen columna (decisión de Adrián).
          await t.auditar({
            usuarioId: c.usuarioId,
            accion: 'ALTA',
            tabla: 'cliente',
            registroId: x.id,
            detalle: armarDetalle(`Alta de cliente ${x.nombres} ${x.apellidos}. Aceptó el tratamiento de datos.`, {
              plazoMora: d.tasaMora.plazo,
              capitalizacionMora: mora.pactada.capitalizacion ?? null,
              tedMora: mora.ted.toFixed(15),
            }),
          });
          return { ...this.dto(x, new Dec(0)), codigoActivacion: x.codigo_activacion };
        });
      } catch (e) {
        // Otro error, o el código o una inscripción simultánea chocaron demasiadas veces: al reintentar, el DNI repetido da 409.
        if (restriccionUnica(e) === null || intento >= 5) throw e;
      }
    }
  }

  async editar(c: ContextoDueno, id: bigint, d: EditarClienteDto) {
    return this.bd.transaccionEnTienda(c.tiendaId, async (t) => {
      await t.bloquearCliente(id);
      const x = await t.bd.cliente.findFirst({ where: { id } });
      if (!x) throw noExiste('El cliente');
      const su = calcularSu(await comprasParaSu(t.bd, id));

      const cambiaCondiciones =
        d.tasa !== undefined ||
        d.tasaMora !== undefined ||
        (d.moneda !== undefined && d.moneda !== x.moneda) ||
        (d.diaCorte !== undefined && d.diaCorte !== x.dia_corte) ||
        (d.diaPago !== undefined && d.diaPago !== x.dia_pago);
      if (cambiaCondiciones && su.gt(0)) {
        throw new ErrorNegocio(
          409,
          'CONDICIONES_CON_DEUDA',
          'No se pueden cambiar tasas, moneda ni días mientras el cliente tiene deuda: un listado emitido no cambia.',
        );
      }
      if (d.maxMeses !== undefined) validarMaxMeses(d.maxMeses);
      validarDiasCiclo(d.diaCorte ?? x.dia_corte, d.diaPago ?? x.dia_pago);
      if (d.limiteCredito !== undefined) validarMontoPositivo(d.limiteCredito, 'El límite de crédito');

      const data: Prisma.clienteUpdateInput = {
        nombres: d.nombres,
        apellidos: d.apellidos,
        celular: vacioANull(d.celular),
        direccion: vacioANull(d.direccion),
        moneda: d.moneda,
        limite_credito: d.limiteCredito === undefined ? undefined : aDecimalBd(d.limiteCredito, 2),
        max_meses: d.maxMeses,
        dia_corte: d.diaCorte,
        dia_pago: d.diaPago,
      };
      let datos: Record<string, unknown> | undefined;
      if (d.tasa) {
        const { pactada, ted } = calcularTasaCliente(d.tasa);
        Object.assign(data, {
          tipo_tasa: d.tasa.tipo,
          valor_tasa: aDecimalBd(d.tasa.valor, 9),
          plazo_tasa: d.tasa.plazo,
          capitalizacion: pactada.capitalizacion ?? null,
          ted: ted.toFixed(15),
        });
      }
      if (d.tasaMora) {
        const mora = calcularTasaCliente(d.tasaMora);
        Object.assign(data, {
          tipo_tasa_mora: d.tasaMora.tipo,
          valor_tasa_mora: aDecimalBd(d.tasaMora.valor, 9),
          ted_mora: mora.ted.toFixed(15),
        });
        datos = {
          plazoMora: d.tasaMora.plazo,
          capitalizacionMora: mora.pactada.capitalizacion ?? null,
          tedMora: mora.ted.toFixed(15),
        };
      }
      const editado = await t.bd.cliente.update({ where: { id }, data });
      await t.auditar({
        usuarioId: c.usuarioId,
        accion: 'CAMBIO',
        tabla: 'cliente',
        registroId: id,
        detalle: armarDetalle(`Edición del cliente ${editado.nombres} ${editado.apellidos}.`, datos),
      });
      return this.dto(editado, su);
    });
  }

  /** La baja bloquea compras nuevas y el acceso; el corte y el cobro siguen: no borra la deuda. */
  async estado(c: ContextoDueno, id: bigint, estado: 'ACTIVO' | 'INACTIVO') {
    return this.bd.transaccionEnTienda(c.tiendaId, async (t) => {
      if (!(await t.bd.cliente.findFirst({ where: { id } }))) throw noExiste('El cliente');
      const x = await t.bd.cliente.update({ where: { id }, data: { estado } });
      await t.auditar({
        usuarioId: c.usuarioId,
        accion: estado === 'INACTIVO' ? 'BAJA' : 'CAMBIO',
        tabla: 'cliente',
        registroId: id,
        detalle: `${estado === 'INACTIVO' ? 'Baja' : 'Reactivación'} del cliente ${x.nombres} ${x.apellidos}.`,
      });
      return this.dto(x, calcularSu(await comprasParaSu(t.bd, id)));
    });
  }
}

@ApiTags('clientes')
@ApiBearerAuth()
@Roles('DUENO')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly s: ClientesService) {}

  @Get()
  listar(@Ctx() c: ContextoDueno, @Query() f: FiltroClientesDto) {
    return this.s.listar(c, f);
  }

  /** Calcula sin guardar, para el formulario de D03. */
  @HttpCode(200)
  @Post('calcular-tasas')
  calcular(@Body() d: CalcularTasasDto) {
    const { ted } = calcularTasaCliente(d.tasa);
    return { ted: aTasa(ted), tem: aTasa(tem(ted)), tea: aTasa(tea(ted)) };
  }

  @Post()
  crear(@Ctx() c: ContextoDueno, @Body() d: CrearClienteDto) {
    return this.s.crear(c, d);
  }

  @Get(':id')
  obtener(@Ctx() c: ContextoDueno, @Param('id', ParseIdPipe) id: bigint) {
    return this.s.obtener(c, id);
  }

  @Patch(':id')
  editar(@Ctx() c: ContextoDueno, @Param('id', ParseIdPipe) id: bigint, @Body() d: EditarClienteDto) {
    return this.s.editar(c, id, d);
  }

  @Patch(':id/estado')
  estado(@Ctx() c: ContextoDueno, @Param('id', ParseIdPipe) id: bigint, @Body() d: EstadoDto) {
    return this.s.estado(c, id, d.estado);
  }
}
