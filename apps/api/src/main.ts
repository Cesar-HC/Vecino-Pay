import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Settings } from 'luxon';
import { ZONA_HORARIA } from '@vecinopay/finance';
import { AppModule } from './app.module';

async function bootstrap() {
  // Todo el sistema trabaja en hora de Lima, sin importar la zona del servidor.
  Settings.defaultZone = ZONA_HORARIA;

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('VecinoPay API')
    .setDescription('API de VecinoPay (FIE 7651)')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const puerto = Number(process.env.PORT ?? 3000);
  await app.listen(puerto);
  console.log(`VecinoPay API en http://localhost:${puerto}/api (docs en /api/docs)`);
}

bootstrap();
