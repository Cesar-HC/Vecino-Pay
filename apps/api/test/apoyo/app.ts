import { INestApplication } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule, configurarApp } from '../../src/app.module';
import { GuardIntentos } from '../../src/auth/guardias';
import { RELOJ, Reloj } from '../../src/reloj/reloj';

/** Reloj que las pruebas mueven. Vive aquí y nunca en src/. */
export class RelojControlable implements Reloj {
  readonly fijo = true;
  private instante = new Date('2026-09-22T17:00:00.000Z');
  ahora() {
    return new Date(this.instante);
  }
  /** Hora de Lima: '2026-08-22T09:15:00'. */
  fijar(lima: string) {
    this.instante = new Date(`${lima}-05:00`);
  }
}

export type Cuerpo = Record<string, unknown> | undefined;

export class Prueba {
  readonly reloj = new RelojControlable();
  app: INestApplication;
  /** Solo para comprobar lo que quedó en la BD. */
  readonly bd = new PrismaClient();

  async iniciar() {
    const modulo = await Test.createTestingModule({ imports: [AppModule, DiscoveryModule] })
      .overrideProvider(RELOJ)
      .useValue(this.reloj)
      .overrideGuard(GuardIntentos)
      .useValue({ canActivate: () => true })
      .compile();
    this.app = modulo.createNestApplication();
    configurarApp(this.app);
    await this.app.init();
    return this;
  }

  async cerrar() {
    await this.app.close();
    await this.bd.$disconnect();
  }

  private servidor() {
    return request(this.app.getHttpServer());
  }

  get(ruta: string, token?: string) {
    const r = this.servidor().get(`/api${ruta}`);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  }

  post(ruta: string, token: string | undefined, cuerpo: Cuerpo = {}) {
    const r = this.servidor().post(`/api${ruta}`);
    return (token ? r.set('Authorization', `Bearer ${token}`) : r).send(cuerpo);
  }

  patch(ruta: string, token: string | undefined, cuerpo: Cuerpo = {}) {
    const r = this.servidor().patch(`/api${ruta}`);
    return (token ? r.set('Authorization', `Bearer ${token}`) : r).send(cuerpo);
  }

  async login(username: string, password: string, perfil: string): Promise<string> {
    const r = await this.post('/auth/login', undefined, { username, password, perfil }).expect(200);
    return r.body.token;
  }

  admin() {
    return this.login('admin@vecinopay.test', 'Admin#2026', 'ADMIN_SISTEMA');
  }
  rosa() {
    return this.login('rosa@vecinopay.test', 'Tienda#2026', 'DUENO');
  }

  /** Crea una tienda por A03 con el catálogo de las semillas. Devuelve el token del dueño y los productos. */
  async crearTienda(nombre: string, admin: string, tokenCatalogo: string) {
    const unico = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9);
    const usuarioDueno = `dueno${unico}@prueba.test`;
    const clave = 'Clave#2026';
    const t = await this.post('/tiendas', admin, {
      ruc: `10${unico}`,
      razonSocial: nombre,
      nombreComercial: nombre,
      giro: 'Minimarket',
      cokTea: '0.20',
      usuarioDueno,
      claveTemporal: clave,
    }).expect(201);
    const token = await this.login(usuarioDueno, clave, 'DUENO');
    const catalogo = (await this.get('/productos', tokenCatalogo).expect(200)).body.items;
    const productos: Record<string, string> = {};
    for (const p of catalogo) {
      const creado = await this.post('/productos', token, {
        codigo: p.codigo,
        nombre: p.nombre,
        unidad: p.unidad,
        precioContado: p.precioContado,
        precioLista: p.precioLista,
        permiteFinMes: p.permiteFinMes,
        permiteCuotas: p.permiteCuotas,
      }).expect(201);
      productos[p.codigo] = creado.body.id;
    }
    return { tiendaId: t.body.id as string, token, productos, usuarioDueno, clave };
  }
}

export const dniUnico = () => `${Date.now()}${Math.floor(Math.random() * 90 + 10)}`.slice(-8);

export const LUIS = (dni: string) => ({
  dni,
  nombres: 'Luis',
  apellidos: 'Quispe',
  aceptaDatos: true,
  moneda: 'PEN',
  limiteCredito: '500.00',
  maxMeses: 3,
  diaCorte: 20,
  diaPago: 26,
  tasa: { tipo: 'EFECTIVA', valor: '0.45', plazo: 360 },
  tasaMora: { tipo: 'EFECTIVA', valor: '0.10', plazo: 360 },
});

export const MARIA = (dni: string) => ({
  dni,
  nombres: 'María',
  apellidos: 'Huamán',
  aceptaDatos: true,
  moneda: 'PEN',
  limiteCredito: '600.00',
  maxMeses: 3,
  diaCorte: 20,
  diaPago: 26,
  tasa: { tipo: 'NOMINAL', valor: '0.42', plazo: 360, capitalizacion: 30 },
  tasaMora: { tipo: 'EFECTIVA', valor: '0.12', plazo: 360 },
});
