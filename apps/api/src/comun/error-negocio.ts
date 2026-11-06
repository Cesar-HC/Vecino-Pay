import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorFinanciero } from '@vecinopay/finance';
import type { Response } from 'express';
import { FueraDeAmbito } from '../bd/ambito-tienda';

export class ErrorNegocio extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalles: Record<string, unknown> = {},
  ) {
    super(mensaje);
  }
}

export const noExiste = (que = 'El recurso') => new ErrorNegocio(404, 'NO_EXISTE', `${que} no existe.`);

/** Todas las respuestas de error tienen la forma { codigo, mensaje, detalles }. */
@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly log = new Logger('API');

  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (e instanceof ErrorNegocio) {
      res.status(e.estado).json({ codigo: e.codigo, mensaje: e.message, detalles: e.detalles });
    } else if (e instanceof ErrorFinanciero) {
      res.status(HttpStatus.BAD_REQUEST).json({ codigo: e.codigo, mensaje: e.message, detalles: {} });
    } else if (e instanceof HttpException) {
      const estado = e.getStatus();
      const cuerpo = e.getResponse();
      const mensaje =
        typeof cuerpo === 'object' && 'message' in cuerpo
          ? [cuerpo.message].flat().join('; ')
          : e.message;
      const codigos: Record<number, string> = {
        400: 'ENTRADA_INVALIDA',
        401: 'SIN_SESION',
        403: 'SIN_PERMISO',
        404: 'NO_EXISTE',
        429: 'DEMASIADOS_INTENTOS',
      };
      res.status(estado).json({ codigo: codigos[estado] ?? 'ERROR', mensaje, detalles: {} });
    } else {
      // Un cruce de tienda no debe revelar nada: se registra y se responde como cualquier fallo interno.
      this.log.error(e instanceof FueraDeAmbito ? `Fuera de ámbito: ${e.message}` : e);
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error interno.', detalles: {} });
    }
  }
}
