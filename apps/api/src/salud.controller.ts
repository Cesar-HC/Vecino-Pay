import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HORA_CORTE, ZONA_HORARIA, fechaOperativa, partesLima } from '@vecinopay/finance';

@ApiTags('salud')
@Controller('salud')
export class SaludController {
  /** Comprueba que la API responde y que trabaja con la hora de Lima. */
  @Get()
  estado() {
    const ahora = new Date();
    const { fecha, hora } = partesLima(ahora);
    return {
      estado: 'ok',
      zonaHoraria: ZONA_HORARIA,
      fechaLima: fecha,
      horaLima: hora,
      horaCorte: HORA_CORTE,
      fechaOperativa: fechaOperativa(ahora),
    };
  }
}
