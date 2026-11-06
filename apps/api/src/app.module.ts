import { BadRequestException, INestApplication, Module, ValidationError, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { GuardAutenticacion, GuardRoles } from './auth/guardias';
import { BdModule } from './bd/bd.module';
import { ClientesController, ClientesService } from './clientes/clientes';
import { FiltroErrores } from './comun/error-negocio';
import { ComprasController, ComprasService } from './compras/compras';
import { cargarConfiguracion } from './config/configuracion';
import { CorteService, CortesController } from './cortes/cortes';
import { ListadosController, ListadosService } from './listados/listados';
import { MiController, MiService } from './mi/mi';
import { NegocioController, NegocioService } from './negocio/negocio';
import { PlataformaController } from './plataforma/plataforma.controller';
import { PlataformaService } from './plataforma/plataforma.service';
import { ProductosController, ProductosService } from './productos/productos';
import { SaludController } from './salud.controller';

@Module({
  imports: [
    BdModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'usuario', ttl: 60000, limit: 10 },
      { name: 'ip', ttl: 60000, limit: 60, getTracker: (req) => String(req.ip) },
    ]),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: cargarConfiguracion(process.env).jwtSecreto,
        signOptions: { algorithm: 'HS256', expiresIn: '8h' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [
    SaludController,
    AuthController,
    PlataformaController,
    ProductosController,
    ClientesController,
    ComprasController,
    CortesController,
    ListadosController,
    NegocioController,
    MiController,
  ],
  providers: [
    AuthService,
    PlataformaService,
    ProductosService,
    ClientesService,
    ComprasService,
    CorteService,
    ListadosService,
    NegocioService,
    MiService,
    { provide: APP_GUARD, useClass: GuardAutenticacion },
    { provide: APP_GUARD, useClass: GuardRoles },
    { provide: APP_FILTER, useClass: FiltroErrores },
  ],
})
export class AppModule {}

/** Los mensajes propios ya están en español; los de la librería se reemplazan (Tabla 11). */
function mensajesEnEspanol(errores: ValidationError[]): string[] {
  return errores.flatMap((e) => {
    if (e.children?.length) return mensajesEnEspanol(e.children);
    return Object.entries(e.constraints ?? {}).map(([regla, mensaje]) => {
      if (regla === 'whitelistValidation') return `El campo ${e.property} no está permitido.`;
      return /\b(must|should)\b/.test(mensaje) ? `El campo ${e.property} no es válido.` : mensaje;
    });
  });
}

/** Lo que comparten el arranque real y las pruebas. */
export function configurarApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errores) => new BadRequestException(mensajesEnEspanol(errores)),
    }),
  );
}
