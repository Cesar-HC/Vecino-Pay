import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { BdService } from '../bd/bd.service';
import { CLAVE_PUBLICO, CLAVE_ROLES, Contexto, Perfil } from '../comun/utilidades';

export interface CargaToken {
  sub: string;
  perfil: Perfil;
  tiendaId?: string;
}

/** Verifica el JWT y lee el estado real en la BD en cada petición: una baja corta el acceso de inmediato. */
@Injectable()
export class GuardAutenticacion implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly bd: BdService,
  ) {}

  async canActivate(c: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [c.getHandler(), c.getClass()])) return true;
    const req = c.switchToHttp().getRequest();
    const [tipo, token] = String(req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Inicia sesión para continuar.');
    let carga: CargaToken;
    try {
      carga = await this.jwt.verifyAsync<CargaToken>(token);
    } catch {
      throw new UnauthorizedException('Tu sesión venció. Inicia sesión de nuevo.');
    }
    req.contexto = await this.armarContexto(carga);
    return true;
  }

  private async armarContexto(carga: CargaToken): Promise<Contexto> {
    const invalida = new UnauthorizedException('Tu sesión ya no es válida.');
    const usuarioId = BigInt(carga.sub);
    const bd = this.bd.global();
    const usuario = await bd.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario || usuario.estado !== 'ACTIVO' || usuario.perfil !== carga.perfil) throw invalida;

    if (carga.perfil === 'ADMIN_SISTEMA') return { perfil: 'ADMIN_SISTEMA', usuarioId };
    if (carga.perfil === 'DUENO') {
      if (!carga.tiendaId) throw invalida;
      const tienda = await bd.tienda.findFirst({
        where: { id: BigInt(carga.tiendaId), duenio_id: usuarioId, estado: 'ACTIVO' },
      });
      if (!tienda) throw invalida;
      return { perfil: 'DUENO', usuarioId, tiendaId: tienda.id };
    }
    const cliente = await bd.cliente.findFirst({
      where: { usuario_id: usuarioId, estado: 'ACTIVO', tienda: { estado: 'ACTIVO' } },
    });
    if (!cliente) throw invalida;
    return { perfil: 'CLIENTE', usuarioId, tiendaId: cliente.tienda_id, clienteId: cliente.id };
  }
}

/** Por defecto, denegar: una ruta sin @Publico ni @Roles responde 403. */
@Injectable()
export class GuardRoles implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(c: ExecutionContext): boolean {
    const objetivos = [c.getHandler(), c.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos)) return true;
    const roles = this.reflector.getAllAndOverride<Perfil[]>(CLAVE_ROLES, objetivos);
    const contexto: Contexto | undefined = c.switchToHttp().getRequest().contexto;
    if (!roles?.length || !contexto || !roles.includes(contexto.perfil)) {
      throw new ForbiddenException('No tienes permiso para esta operación.');
    }
    return true;
  }
}

/**
 * Por usuario o DNI, normalizado como lo compara la BD (ignora mayúsculas, ancho y espacios finales): detrás del nginx
 * todas las peticiones llegan con la misma IP. Además hay un límite por IP, ante el rociado de claves entre usuarios.
 */
@Injectable()
export class GuardIntentos extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const cuerpo = (req.body ?? {}) as { username?: unknown; dni?: unknown };
    return String(cuerpo.username ?? cuerpo.dni ?? '').normalize('NFKC').trim().toLowerCase();
  }
}
