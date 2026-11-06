import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { usuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { BdService } from '../bd/bd.service';
import { aId, Contexto, Perfil } from '../comun/utilidades';
import { ErrorNegocio, noExiste } from '../comun/error-negocio';
import { conflictoDeDni, ERROR_DNI_ACTIVADO } from './activacion.politica';
import { restriccionUnica } from '../bd/errores-bd';
import { ActivarDto, CambiarContrasenaDto, LoginDto } from './auth.dto';
import { CargaToken } from './guardias';

// Hash fijo: un usuario inexistente tarda lo mismo y no se revela si existe.
const HASH_FALSO = bcrypt.hashSync('no-es-una-clave-real', 10);
const CREDENCIALES = 'Usuario, contraseña o perfil incorrectos.';
export const COSTO_BCRYPT = 10;

export const numeroCuenta = (clienteId: bigint) => clienteId.toString().padStart(8, '0');

@Injectable()
export class AuthService {
  constructor(
    private readonly bd: BdService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const bd = this.bd.global();
    const usuario = await bd.usuario.findUnique({ where: { username: dto.username } });
    const claveOk = await bcrypt.compare(dto.password, usuario?.password_hash ?? HASH_FALSO);

    const sesion =
      usuario && claveOk && usuario.estado === 'ACTIVO' && usuario.perfil === dto.perfil
        ? await this.datosDeSesion(usuario)
        : null;

    if (!usuario || !sesion) {
      await this.bd.auditarEn(bd, {
        usuarioId: usuario?.id ?? null,
        accion: 'RECHAZO',
        tabla: 'usuario',
        registroId: usuario?.id ?? null,
        detalle: 'Inicio de sesión rechazado.',
      });
      throw new ErrorNegocio(401, 'CREDENCIALES', CREDENCIALES);
    }
    await this.bd.auditarEn(bd, {
      usuarioId: usuario.id,
      tiendaId: sesion.tiendaId,
      accion: 'LOGIN',
      tabla: 'usuario',
      registroId: usuario.id,
      detalle: `Inicio de sesión como ${usuario.perfil}.`,
    });
    return { token: await this.firmar(usuario.id, usuario.perfil as Perfil, sesion.tiendaId), expiraEn: '8h', ...sesion.publico };
  }

  /** Null si no puede entrar: tienda o cliente inactivos, o sin tienda. */
  private async datosDeSesion(u: usuario, tiendaActual?: bigint) {
    const bd = this.bd.global();
    const usuarioPublico = { id: aId(u.id), username: u.username, nombres: u.nombres, perfil: u.perfil };
    if (u.perfil === 'ADMIN_SISTEMA') {
      return { tiendaId: null, publico: { usuario: usuarioPublico, tiendas: [] as object[] } };
    }
    if (u.perfil === 'DUENO') {
      const tiendas = await bd.tienda.findMany({ where: { duenio_id: u.id, estado: 'ACTIVO' }, orderBy: { id: 'asc' } });
      if (tiendas.length === 0) return null;
      const lista = tiendas.map((t) => ({ id: aId(t.id), nombreComercial: t.nombre_comercial }));
      const actual = tiendas.find((t) => t.id === tiendaActual) ?? tiendas[0];
      return {
        tiendaId: actual.id,
        publico: {
          usuario: usuarioPublico,
          tienda: { id: aId(actual.id), nombreComercial: actual.nombre_comercial },
          tiendas: lista,
        },
      };
    }
    const cliente = await bd.cliente.findFirst({
      where: { usuario_id: u.id, estado: 'ACTIVO', tienda: { estado: 'ACTIVO' } },
      include: { tienda: true },
    });
    if (!cliente) return null;
    const tienda = { id: aId(cliente.tienda_id), nombreComercial: cliente.tienda.nombre_comercial };
    return {
      tiendaId: cliente.tienda_id,
      publico: {
        usuario: usuarioPublico,
        tienda,
        tiendas: [tienda],
        cliente: { id: aId(cliente.id), numeroCuenta: numeroCuenta(cliente.id) },
      },
    };
  }

  private firmar(usuarioId: bigint, perfil: Perfil, tiendaId: bigint | null) {
    const carga: CargaToken = { sub: usuarioId.toString(), perfil };
    if (perfil === 'DUENO' && tiendaId !== null) carga.tiendaId = tiendaId.toString();
    return this.jwt.signAsync(carga);
  }

  async yo(c: Contexto) {
    const usuario = await this.bd.global().usuario.findUniqueOrThrow({ where: { id: c.usuarioId } });
    const sesion = await this.datosDeSesion(usuario, 'tiendaId' in c ? c.tiendaId : undefined);
    if (!sesion) throw new ErrorNegocio(401, 'SIN_SESION', 'Tu sesión ya no es válida.');
    return sesion.publico;
  }

  /** C02: quien conoce su código confirma que es la persona inscrita. Crea la cuenta y consume el código. */
  async activar(dto: ActivarDto) {
    if (!dto.aceptaDatos) {
      throw new ErrorNegocio(400, 'DATOS_NO_ACEPTADOS', 'Debes aceptar el tratamiento de tus datos personales para activar la cuenta.');
    }
    if (dto.password !== dto.passwordConfirmacion) {
      throw new ErrorNegocio(400, 'CLAVES_DISTINTAS', 'Las contraseñas no coinciden.');
    }
    const hash = await bcrypt.hash(dto.password, COSTO_BCRYPT);

    const resultado = await this.bd.transaccionGlobal(async (tx) => {
      const cliente = await tx.cliente.findFirst({
        where: {
          dni: dto.dni,
          codigo_activacion: dto.codigo,
          usuario_id: null,
          estado: 'ACTIVO',
          tienda: { estado: 'ACTIVO' },
        },
      });
      if (!cliente) {
        await this.bd.auditarEn(tx, {
          usuarioId: null,
          accion: 'RECHAZO',
          tabla: 'cliente',
          detalle: 'Activación de cuenta rechazada.',
        });
        return new ErrorNegocio(400, 'ACTIVACION_INVALIDA', 'El DNI o el código de activación no son válidos.');
      }
      await this.bd.bloquearClienteEn(tx, cliente.id);
      const conflicto = await conflictoDeDni(tx, dto.dni);
      if (conflicto) {
        // Se confirma solo el rechazo: el código no se consume.
        await this.bd.auditarEn(tx, {
          usuarioId: null,
          tiendaId: cliente.tienda_id,
          accion: 'RECHAZO',
          tabla: 'cliente',
          registroId: cliente.id,
          detalle: 'Activación rechazada: el DNI ya tiene una cuenta en otra tienda.',
        });
        return conflicto;
      }
      const nuevo = await tx.usuario.create({
        data: {
          perfil: 'CLIENTE',
          username: dto.dni,
          password_hash: hash,
          nombres: `${cliente.nombres} ${cliente.apellidos}`,
        },
      });
      const consumido = await tx.cliente.updateMany({
        where: { id: cliente.id, usuario_id: null, codigo_activacion: dto.codigo },
        data: { usuario_id: nuevo.id, celular: dto.celular, codigo_activacion: null },
      });
      if (consumido.count !== 1) throw new ErrorNegocio(400, 'ACTIVACION_INVALIDA', 'El DNI o el código de activación no son válidos.');
      await this.bd.auditarEn(tx, {
        usuarioId: nuevo.id,
        tiendaId: cliente.tienda_id,
        accion: 'ALTA',
        tabla: 'usuario',
        registroId: nuevo.id,
        detalle: 'Cliente activó su cuenta y aceptó el tratamiento de datos personales.',
      });
      return { username: nuevo.username };
    }).catch((e) => {
      // Dos activaciones simultáneas del mismo DNI en tiendas distintas: choca UQ_usuario_username.
      if (restriccionUnica(e)?.includes('usuario')) throw ERROR_DNI_ACTIVADO();
      throw e;
    });
    if (resultado instanceof ErrorNegocio) throw resultado;
    return resultado;
  }

  async cambiarContrasena(c: Contexto, dto: CambiarContrasenaDto) {
    const bd = this.bd.global();
    const u = await bd.usuario.findUniqueOrThrow({ where: { id: c.usuarioId } });
    if (!(await bcrypt.compare(dto.actual, u.password_hash))) {
      throw new ErrorNegocio(400, 'CLAVE_ACTUAL', 'La contraseña actual no es correcta.');
    }
    const hash = await bcrypt.hash(dto.nueva, COSTO_BCRYPT);
    await this.bd.transaccionGlobal(async (tx) => {
      await tx.usuario.update({ where: { id: u.id }, data: { password_hash: hash } });
      await this.bd.auditarEn(tx, {
        usuarioId: u.id,
        tiendaId: 'tiendaId' in c ? c.tiendaId : null,
        accion: 'CAMBIO',
        tabla: 'usuario',
        registroId: u.id,
        detalle: 'Cambio de contraseña.',
      });
    });
  }

  async cambiarTienda(c: Contexto, tiendaId: bigint) {
    const tienda = await this.bd.global().tienda.findFirst({
      where: { id: tiendaId, duenio_id: c.usuarioId, estado: 'ACTIVO' },
    });
    if (!tienda) throw noExiste('La tienda');
    return {
      token: await this.firmar(c.usuarioId, 'DUENO', tienda.id),
      tienda: { id: aId(tienda.id), nombreComercial: tienda.nombre_comercial },
    };
  }
}
