import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HORA_CORTE, ZONA_HORARIA, fechaOperativa, partesLima } from '@vecinopay/finance';
import { Publico } from './comun/utilidades';
import { RELOJ, Reloj } from './reloj/reloj';

@ApiTags('salud')
@Controller('salud')
export class SaludController {
  constructor(@Inject(RELOJ) private readonly reloj: Reloj) {}

  /** Comprueba que la API responde, con qué hora trabaja y si esa hora es la fija de la demo. */
  @Publico()
  @Get()
  estado() {
    const ahora = this.reloj.ahora();
    const { fecha, hora } = partesLima(ahora);
    return {
      estado: 'ok',
      zonaHoraria: ZONA_HORARIA,
      fechaLima: fecha,
      horaLima: hora,
      horaCorte: HORA_CORTE,
      fechaOperativa: fechaOperativa(ahora),
      relojFijo: this.reloj.fijo,
    };
  }
}
