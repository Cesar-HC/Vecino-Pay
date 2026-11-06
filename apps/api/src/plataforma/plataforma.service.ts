import { Inject, Injectable } from '@nestjs/common';
import { Prisma, tienda, usuario } from '@prisma/client';
import { aDec, partesLima, sumarDias } from '@vecinopay/finance';
import * as bcrypt from 'bcryptjs';
import { detalleParaAdmin } from '../auditoria/detalle';
import { COSTO_BCRYPT } from '../auth/auth.service';
import { BdService } from '../bd/bd.service';
import { aFechaBd, aDecimalBd, dePartesBd } from '../bd/conversiones';
import { restriccionUnica } from '../bd/errores-bd';
import { ErrorNegocio, noExiste } from '../comun/error-negocio';
import { aId, aTasa, Contexto, paginar, vacioANull } from '../comun/utilidades';
import { RELOJ, Reloj } from '../reloj/reloj';
import {
  CrearTiendaDto,
  CrearUsuarioDto,
  EditarTiendaDto,
  EditarUsuarioDto,
  FiltroAuditoriaDto,
  FiltroTiendasDto,
  FiltroUsuariosDto,
} from './plataforma.dto';

function exigirCok(cok: string) {
  if (!aDec(cok).gt(0)) throw new ErrorNegocio(400, 'COK', 'El COK de la tienda debe ser mayor que cero.');
}

const sinHora = (d: Date) => dePartesBd(d).fecha;
const fechaHoraIso = (d: Date) => {
  const p = dePartesBd(d);
  return `${p.fecha}T${p.hora}`;
};

@Injectable()
export class PlataformaService {
  constructor(
    private readonly bd: BdService,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  private conflictoTienda(e: unknown): never {
    const r = restriccionUnica(e);
    if (r?.includes('tienda')) throw new ErrorNegocio(409, 'RUC_DUPLICADO', 'Ya existe una tienda con ese RUC.');
    if (r?.includes('usuario')) throw new ErrorNegocio(409, 'USUARIO_DUPLICADO', 'Ya existe un usuario con ese nombre.');
    throw e;
  }

  private tiendaDto(t: tienda & { usuario: usuario }) {
    return {
      id: aId(t.id),
      ruc: t.ruc,
      razonSocial: t.razon_social,
      nombreComercial: t.nombre_comercial,
      giro: t.giro,
      telefono: t.telefono,
      direccion: t.direccion,
      cokTea: aTasa(t.cok_tea, 9),
      estado: t.estado,
      duenio: { id: aId(t.usuario.id), username: t.usuario.username, nombres: t.usuario.nombres, estado: t.usuario.estado },
    };
  }

  async listarTiendas(f: FiltroTiendasDto) {
    const where: Prisma.tiendaWhereInput = {
      estado: f.estado,
      ...(f.texto
        ? { OR: [{ nombre_comercial: { contains: f.texto } }, { razon_social: { contains: f.texto } }, { ruc: { contains: f.texto } }] }
        : {}),
    };
    const items = await this.bd.global().tienda.findMany({ where, include: { usuario: true }, orderBy: { id: 'asc' }, ...paginar(f) });
    return { items: items.map((t) => this.tiendaDto(t)), total: await this.bd.global().tienda.count({ where }) };
  }

  /** Crea o reutiliza al dueño (T24) y crea la tienda, todo en una transacción. */
  async crearTienda(c: Contexto, dto: CrearTiendaDto) {
    exigirCok(dto.cokTea);
    const hash = dto.claveTemporal ? await bcrypt.hash(dto.claveTemporal, COSTO_BCRYPT) : null;
    try {
      return await this.bd.transaccionGlobal(async (tx) => {
        let dueno = await tx.usuario.findUnique({ where: { username: dto.usuarioDueno } });
        if (dueno && dueno.perfil !== 'DUENO') {
          throw new ErrorNegocio(409, 'USUARIO_NO_ES_DUENO', 'Ese usuario ya existe y no tiene perfil de dueño.');
        }
        if (!dueno) {
          if (!hash) throw new ErrorNegocio(400, 'CLAVE_REQUERIDA', 'Indica una clave temporal para el dueño nuevo.');
          dueno = await tx.usuario.create({
            data: {
              perfil: 'DUENO',
              username: dto.usuarioDueno,
              password_hash: hash,
              nombres: dto.nombresDueno ?? dto.nombreComercial,
            },
          });
          await this.bd.auditarEn(tx, {
            usuarioId: c.usuarioId,
            accion: 'ALTA',
            tabla: 'usuario',
            registroId: dueno.id,
            detalle: `Alta del usuario ${dueno.username}.`,
          });
        }
        const creada = await tx.tienda.create({
          data: {
            duenio_id: dueno.id,
            ruc: dto.ruc,
            razon_social: dto.razonSocial,
            nombre_comercial: dto.nombreComercial,
            giro: dto.giro,
            telefono: dto.telefono ?? null,
            direccion: dto.direccion ?? null,
            cok_tea: aDecimalBd(dto.cokTea, 9),
          },
          include: { usuario: true },
        });
        await this.bd.auditarEn(tx, {
          usuarioId: c.usuarioId,
          tiendaId: creada.id,
          accion: 'ALTA',
          tabla: 'tienda',
          registroId: creada.id,
          detalle: `Alta de la tienda ${creada.nombre_comercial}.`,
        });
        return this.tiendaDto(creada);
      });
    } catch (e) {
      return this.conflictoTienda(e);
    }
  }

  async editarTienda(c: Contexto, id: bigint, dto: EditarTiendaDto) {
    if (dto.cokTea !== undefined) exigirCok(dto.cokTea);
    try {
      return await this.bd.transaccionGlobal(async (tx) => {
        if (!(await tx.tienda.findUnique({ where: { id } }))) throw noExiste('La tienda');
        const t = await tx.tienda.update({
          where: { id },
          data: {
            ruc: dto.ruc,
            razon_social: dto.razonSocial,
            nombre_comercial: dto.nombreComercial,
            giro: dto.giro,
            telefono: vacioANull(dto.telefono),
            direccion: vacioANull(dto.direccion),
            cok_tea: dto.cokTea === undefined ? undefined : aDecimalBd(dto.cokTea, 9),
          },
          include: { usuario: true },
        });
        await this.bd.auditarEn(tx, {
          usuarioId: c.usuarioId,
          tiendaId: id,
          accion: 'CAMBIO',
          tabla: 'tienda',
          registroId: id,
          detalle: `Edición de la tienda ${t.nombre_comercial}.`,
        });
        return this.tiendaDto(t);
      });
    } catch (e) {
      return this.conflictoTienda(e);
    }
  }

  /** La baja es lógica. El dueño queda INACTIVO si no le quedan tiendas activas (A04). */
  async estadoTienda(c: Contexto, id: bigint, estado: 'ACTIVO' | 'INACTIVO') {
    return this.bd.transaccionGlobal(async (tx) => {
      const actual = await tx.tienda.findUnique({ where: { id }, include: { usuario: true } });
      if (!actual) throw noExiste('La tienda');
      if (actual.estado === estado) return this.tiendaDto(actual); // Nada cambió: no se audita otra baja.
      const t = await tx.tienda.update({ where: { id }, data: { estado }, include: { usuario: true } });
      // Nunca reactiva al dueño: pudo estar dado de baja por otro motivo. Eso se hace aparte en A04.
      let dueno = t.usuario;
      const activas = await tx.tienda.count({ where: { duenio_id: t.duenio_id, estado: 'ACTIVO' } });
      if (estado === 'INACTIVO' && activas === 0 && dueno.estado === 'ACTIVO') {
        dueno = await tx.usuario.update({ where: { id: t.duenio_id }, data: { estado: 'INACTIVO' } });
        await this.bd.auditarEn(tx, {
          usuarioId: c.usuarioId,
          tiendaId: id,
          accion: 'BAJA',
          tabla: 'usuario',
          registroId: dueno.id,
          detalle: `Baja del usuario ${dueno.username}: se quedó sin tiendas activas.`,
        });
      }
      await this.bd.auditarEn(tx, {
        usuarioId: c.usuarioId,
        tiendaId: id,
        accion: estado === 'INACTIVO' ? 'BAJA' : 'CAMBIO',
        tabla: 'tienda',
        registroId: id,
        detalle: `${estado === 'INACTIVO' ? 'Baja' : 'Reactivación'} de la tienda ${t.nombre_comercial}.`,
      });
      return this.tiendaDto({ ...t, usuario: dueno });
    });
  }

  private async usuarioDto(u: usuario) {
    const bd = this.bd.global();
    const tienda =
      u.perfil === 'DUENO'
        ? await bd.tienda.findFirst({ where: { duenio_id: u.id }, orderBy: { id: 'asc' } })
        : u.perfil === 'CLIENTE'
          ? (await bd.cliente.findFirst({ where: { usuario_id: u.id }, include: { tienda: true } }))?.tienda
          : null;
    const acceso = await bd.auditoria.findFirst({
      where: { usuario_id: u.id, accion: 'LOGIN' },
      orderBy: { fecha_hora: 'desc' },
    });
    return {
      id: aId(u.id),
      username: u.username,
      nombres: u.nombres,
      perfil: u.perfil,
      tienda: tienda ? { id: aId(tienda.id), nombreComercial: tienda.nombre_comercial } : null,
      ultimoAcceso: acceso ? fechaHoraIso(acceso.fecha_hora) : null,
      estado: u.estado,
    };
  }

  async listarUsuarios(f: FiltroUsuariosDto) {
    const tiendaId = f.tiendaId ? BigInt(f.tiendaId) : undefined;
    const where: Prisma.usuarioWhereInput = {
      perfil: f.perfil,
      AND: [
        ...(f.texto ? [{ OR: [{ username: { contains: f.texto } }, { nombres: { contains: f.texto } }] }] : []),
        ...(tiendaId ? [{ OR: [{ tienda: { some: { id: tiendaId } } }, { cliente: { some: { tienda_id: tiendaId } } }] }] : []),
      ],
    };
    const usuarios = await this.bd.global().usuario.findMany({
      where,
      orderBy: { id: 'asc' },
      ...paginar(f),
    });
    const items = await Promise.all(usuarios.map((u) => this.usuarioDto(u)));
    return { items, total: await this.bd.global().usuario.count({ where }) };
  }

  /** La cuenta CLIENTE solo nace en C02, para confirmar que quien crea la clave es la persona inscrita (6.1.1). */
  async crearUsuario(c: Contexto, dto: CrearUsuarioDto) {
    if (dto.perfil !== 'ADMIN_SISTEMA' && dto.perfil !== 'DUENO') {
      throw new ErrorNegocio(400, 'PERFIL_NO_PERMITIDO', 'Las cuentas de cliente se crean solo al activarlas.');
    }
    const hash = await bcrypt.hash(dto.claveTemporal, COSTO_BCRYPT);
    try {
      const u = await this.bd.transaccionGlobal(async (tx) => {
        const nuevo = await tx.usuario.create({
          data: { perfil: dto.perfil, username: dto.username, password_hash: hash, nombres: dto.nombres },
        });
        if (dto.tiendaId && dto.perfil === 'DUENO') await this.asignarTienda(tx, BigInt(dto.tiendaId), nuevo.id);
        await this.bd.auditarEn(tx, {
          usuarioId: c.usuarioId,
          accion: 'ALTA',
          tabla: 'usuario',
          registroId: nuevo.id,
          detalle: `Alta del usuario ${nuevo.username}.`,
        });
        return nuevo;
      });
      return this.usuarioDto(u);
    } catch (e) {
      if (restriccionUnica(e)?.includes('usuario')) {
        throw new ErrorNegocio(409, 'USUARIO_DUPLICADO', 'Ya existe un usuario con ese nombre.');
      }
      throw e;
    }
  }

  private async asignarTienda(tx: Prisma.TransactionClient, tiendaId: bigint, duenioId: bigint) {
    if (!(await tx.tienda.findUnique({ where: { id: tiendaId } }))) throw noExiste('La tienda');
    await tx.tienda.update({ where: { id: tiendaId }, data: { duenio_id: duenioId } });
  }

  private async exigirUsuario(tx: Prisma.TransactionClient, id: bigint) {
    const u = await tx.usuario.findUnique({ where: { id } });
    if (!u) throw noExiste('El usuario');
    return u;
  }

  async editarUsuario(c: Contexto, id: bigint, dto: EditarUsuarioDto) {
    const u = await this.bd.transaccionGlobal(async (tx) => {
      const actual = await this.exigirUsuario(tx, id);
      if (dto.tiendaId && actual.perfil === 'DUENO') await this.asignarTienda(tx, BigInt(dto.tiendaId), id);
      const editado = await tx.usuario.update({ where: { id }, data: { nombres: dto.nombres } });
      await this.bd.auditarEn(tx, {
        usuarioId: c.usuarioId,
        accion: 'CAMBIO',
        tabla: 'usuario',
        registroId: id,
        detalle: `Edición del usuario ${editado.username}.`,
      });
      return editado;
    });
    return this.usuarioDto(u);
  }

  async restablecerClave(c: Contexto, id: bigint, clave: string) {
    const hash = await bcrypt.hash(clave, COSTO_BCRYPT);
    await this.bd.transaccionGlobal(async (tx) => {
      const u = await this.exigirUsuario(tx, id);
      await tx.usuario.update({ where: { id }, data: { password_hash: hash } });
      await this.bd.auditarEn(tx, {
        usuarioId: c.usuarioId,
        accion: 'CAMBIO',
        tabla: 'usuario',
        registroId: id,
        detalle: `Restablecimiento de la contraseña de ${u.username}.`,
      });
    });
  }

  async estadoUsuario(c: Contexto, id: bigint, estado: 'ACTIVO' | 'INACTIVO') {
    if (id === c.usuarioId && estado === 'INACTIVO') {
      throw new ErrorNegocio(409, 'AUTOBAJA', 'No puedes dar de baja tu propio usuario.');
    }
    const u = await this.bd.transaccionGlobal(async (tx) => {
      await this.exigirUsuario(tx, id);
      const editado = await tx.usuario.update({ where: { id }, data: { estado } });
      await this.bd.auditarEn(tx, {
        usuarioId: c.usuarioId,
        accion: estado === 'INACTIVO' ? 'BAJA' : 'CAMBIO',
        tabla: 'usuario',
        registroId: id,
        detalle: `${estado === 'INACTIVO' ? 'Baja' : 'Reactivación'} del usuario ${editado.username}.`,
      });
      return editado;
    });
    return this.usuarioDto(u);
  }

  async auditoria(f: FiltroAuditoriaDto) {
        const where: Prisma.auditoriaWhereInput = {
      accion: f.accion,
      tienda_id: f.tiendaId ? BigInt(f.tiendaId) : undefined,
      usuario_id: f.usuarioId ? BigInt(f.usuarioId) : undefined,
      fecha_hora: {
        gte: f.desde ? aFechaBd(f.desde) : undefined,
        lt: f.hasta ? aFechaBd(sumarDias(f.hasta, 1)) : undefined,
      },
    };
    const bd = this.bd.global();
    const [filas, total] = await Promise.all([
      bd.auditoria.findMany({
        where,
        include: { usuario: true, tienda: true },
        orderBy: [{ fecha_hora: 'desc' }, { id: 'desc' }],
        ...paginar(f),
      }),
      bd.auditoria.count({ where }),
    ]);
    return {
      total,
      items: filas.map((a) => ({
        id: aId(a.id),
        fechaHora: fechaHoraIso(a.fecha_hora),
        usuario: a.usuario?.username ?? null,
        tienda: a.tienda?.nombre_comercial ?? null,
        accion: a.accion,
        tabla: a.tabla,
        registroId: aId(a.registro_id),
        detalle: detalleParaAdmin(a.detalle),
      })),
    };
  }

  /** A02. Sin importes ni tasas (6.2.1). */
  async resumen() {
    const bd = this.bd.global();
    const hoy = partesLima(this.reloj.ahora()).fecha;
    const inicioSemana = sumarDias(hoy, -6);
    const [tiendasActivas, usuariosActivos, clientesRegistrados, altas, recientes, giros, ultimas] = await Promise.all([
      bd.tienda.count({ where: { estado: 'ACTIVO' } }),
      bd.usuario.count({ where: { estado: 'ACTIVO' } }),
      bd.cliente.count(),
      bd.auditoria.findMany({ where: { accion: 'ALTA', tabla: 'tienda' }, select: { fecha_hora: true, registro_id: true } }),
      bd.auditoria.findMany({
        where: { fecha_hora: { gte: aFechaBd(inicioSemana), lt: aFechaBd(sumarDias(hoy, 1)) } },
        select: { fecha_hora: true },
      }),
      bd.tienda.groupBy({ by: ['giro'], where: { estado: 'ACTIVO' }, _count: { _all: true }, orderBy: { giro: 'asc' } }),
      bd.auditoria.findMany({
        include: { usuario: true, tienda: true },
        orderBy: [{ fecha_hora: 'desc' }, { id: 'desc' }],
        take: 10,
      }),
    ]);

    const porMes = new Map<string, Set<string>>();
    for (const a of altas) {
      const mes = sinHora(a.fecha_hora).slice(0, 7);
      if (!porMes.has(mes)) porMes.set(mes, new Set());
      porMes.get(mes)?.add(String(a.registro_id));
    }
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(inicioSemana, i));
    return {
      tiendasActivas,
      usuariosActivos,
      clientesRegistrados,
      operacionesHoy: recientes.filter((a) => sinHora(a.fecha_hora) === hoy).length,
      altasPorMes: [...porMes.entries()].sort().map(([mes, ids]) => ({ mes, cantidad: ids.size })),
      operacionesPorDia: dias.map((fecha) => ({
        fecha,
        cantidad: recientes.filter((a) => sinHora(a.fecha_hora) === fecha).length,
      })),
      tiendasPorGiro: giros.map((g) => ({ giro: g.giro, cantidad: g._count._all })),
      ultimasOperaciones: ultimas.map((a) => ({
        fechaHora: fechaHoraIso(a.fecha_hora),
        usuario: a.usuario?.username ?? null,
        tienda: a.tienda?.nombre_comercial ?? null,
        accion: a.accion,
        tabla: a.tabla,
      })),
    };
  }
}
