import 'reflect-metadata';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Settings } from 'luxon';
import { ZONA_HORARIA } from '@vecinopay/finance';
import { AppModule, configurarApp } from './app.module';
import { cargarEnv } from './config/cargar-env';
import { cargarConfiguracion, ConfiguracionInvalida } from './config/configuracion';

async function bootstrap() {
  // En desarrollo local toma ../../.env; en Docker no existe y manda "environment".
  cargarEnv(resolve(__dirname, '../../../.env'));

  let config;
  try {
    config = cargarConfiguracion(process.env);
  } catch (e) {
    if (!(e instanceof ConfiguracionInvalida)) throw e;
    console.error(e.message);
    process.exit(1);
  }

  config.avisos.forEach((a) => console.warn(a));

  // Todo el sistema trabaja en hora de Lima, sin importar la zona del servidor.
  Settings.defaultZone = ZONA_HORARIA;

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Solo nginx llega a la API (publicada en 127.0.0.1): su cabecera da la IP real para el límite de intentos.
  app.set('trust proxy', 1);
  configurarApp(app);
  app.use(helmet());
  app.enableCors({ origin: config.corsOrigenes });

  if (config.entorno !== 'production') {
    const documento = new DocumentBuilder()
      .setTitle('VecinoPay API')
      .setDescription('API de VecinoPay (FIE 7651)')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, documento));
  }

  await app.listen(config.puerto);
  console.log(`VecinoPay API en http://localhost:${config.puerto}/api (docs en /api/docs)`);
}

bootstrap();
