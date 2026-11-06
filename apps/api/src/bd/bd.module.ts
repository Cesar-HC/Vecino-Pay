import { Global, Module } from '@nestjs/common';
import { cargarConfiguracion } from '../config/configuracion';
import { RELOJ, RelojFijo, RelojSistema } from '../reloj/reloj';
import { BdService } from './bd.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    BdService,
    {
      provide: RELOJ,
      useFactory: () => {
        const { relojFijo } = cargarConfiguracion(process.env);
        return relojFijo ? new RelojFijo(relojFijo) : new RelojSistema();
      },
    },
  ],
  exports: [BdService, RELOJ],
})
export class BdModule {}
