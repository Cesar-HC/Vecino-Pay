import { Inject, Injectable } from '@nestjs/common';
import { Prisma, tienda } from '@prisma/client';
import { partesLima, PartesLima } from '@vecinopay/finance';
import { Reloj, RELOJ } from '../reloj/reloj';
import { Ambito, ClienteBd, crearAmbito } from './ambito-tienda';
import { aInstanteBd } from './conversiones';
import { PrismaService } from './prisma.service';

export type AccionAuditoria = 'ALTA' | 'BAJA' | 'CAMBIO' | 'LOGIN' | 'RECHAZO';

export interface EntradaAuditoria {
  usuarioId: bigint | null;
  tiendaId?: bigint | null;
  accion: AccionAuditoria;
  tabla: string;
  registroId?: bigint | null;
  detalle: string;
}

/** Lo que recibe una operación de una tienda dentro de su transacción. */
export interface TrabajoTienda {
  bd: Ambito;
  tiendaId: bigint;
  tienda(): Promise<tienda>;
  /** Orden de bloqueo fijo: tienda, cliente, listado. Se mantienen hasta el fin de la transacción. */
  bloquearTienda(): Promise<void>;
  bloquearCliente(clienteId: bigint): Promise<void>;
  bloquearListado(listadoId: bigint): Promise<void>;
  /** Hora de Lima, leída en el momento de llamar: después del bloqueo. */
  ahora(): PartesLima;
  auditar(entrada: Omit<EntradaAuditoria, 'tiendaId'>): Promise<void>;
}

const OPCIONES_TX = { maxWait: 15000, timeout: 15000 };

@Injectable()
export class BdService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  /** Lecturas de una tienda, sin transacción. */
  enTienda(tiendaId: bigint): Ambito {
    return crearAmbito(this.prisma, tiendaId);
  }

  /** Solo auth, auditoría, plataforma y cortes (regla de ESLint). */
  global(): ClienteBd {
    return this.prisma;
  }

  async transaccionEnTienda<T>(tiendaId: bigint, trabajo: (t: TrabajoTienda) => Promise<T>): Promise<T> {
    return this.conReintento(() =>
      this.prisma.$transaction(
        (tx) =>
          trabajo({
            bd: crearAmbito(tx, tiendaId),
            tiendaId,
            tienda: () => tx.tienda.findUniqueOrThrow({ where: { id: tiendaId } }),
            bloquearTienda: async () => {
              await tx.$queryRaw`SELECT id FROM tienda WHERE id = ${tiendaId} FOR NO KEY UPDATE`;
            },
            bloquearCliente: async (id) => {
              await tx.$queryRaw`SELECT id FROM cliente WHERE id = ${id} AND tienda_id = ${tiendaId} FOR NO KEY UPDATE`;
            },
            bloquearListado: async (id) => {
              await tx.$queryRaw`SELECT id FROM listado_pago WHERE id = ${id} AND tienda_id = ${tiendaId} FOR NO KEY UPDATE`;
            },
            ahora: () => partesLima(this.reloj.ahora()),
            auditar: (e) => this.auditarEn(tx, { ...e, tiendaId }),
          }),
        OPCIONES_TX,
      ),
    );
  }

  /** Solo auth, plataforma y cortes. */
  async transaccionGlobal<T>(trabajo: (tx: ClienteBd) => Promise<T>): Promise<T> {
    return this.conReintento(() => this.prisma.$transaction(trabajo, OPCIONES_TX));
  }

  /** Para la activación, que aún no conoce la tienda antes de encontrar al cliente. */
  async bloquearClienteEn(tx: ClienteBd, clienteId: bigint): Promise<void> {
    await tx.$queryRaw`SELECT id FROM cliente WHERE id = ${clienteId} FOR NO KEY UPDATE`;
  }

  /** La fecha_hora sale del reloj, para que los filtros de A02 y A05 coincidan con la fecha de la demo. */
  async auditarEn(tx: ClienteBd, e: EntradaAuditoria): Promise<void> {
    await tx.auditoria.create({
      data: {
        usuario_id: e.usuarioId,
        tienda_id: e.tiendaId ?? null,
        fecha_hora: aInstanteBd(partesLima(this.reloj.ahora())),
        accion: e.accion,
        tabla: e.tabla,
        registro_id: e.registroId ?? null,
        detalle: e.detalle,
      },
    });
  }

  private async conReintento<T>(hacer: () => Promise<T>): Promise<T> {
    for (let intento = 1; ; intento++) {
      try {
        return await hacer();
      } catch (e) {
        const interbloqueo =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === 'P2034' || e.message.includes('deadlock') || e.message.includes('could not serialize'));
        if (!interbloqueo || intento >= 3) throw e;
      }
    }
  }
}
