// Línea de comandos de la base de datos de VecinoPay (PostgreSQL local, sin Docker).
//   node scripts/db.mjs roles | crear | iniciar | recrear --confirmar | verificar | estado
import { join } from 'node:path';
import {
  RAIZ,
  borrarBdDesarrollo,
  borrarBdDesechable,
  cfg,
  crearBd,
  existeBd,
  inicializar,
  psql,
  urlApp,
  verificar,
} from './lib/pg.mjs';

const [, , orden, ...resto] = process.argv;
const c = cfg();

function exigirClaves() {
  if (!c.claveDueno || !c.claveApp) {
    throw new Error('Faltan DB_OWNER_PASSWORD y APP_DB_PASSWORD. Copia .env.example como .env.');
  }
}

const ordenes = {
  roles() {
    exigirClaves();
    console.log(
      `Crea los roles ${c.dueno} y ${c.app}. psql pedirá la contraseña del superusuario postgres.`,
    );
    console.log('(O define $env:PGPASSWORD en esta terminal para no escribirla.)');
    psql({
      usuario: process.env.PGSUPERUSER || 'postgres',
      clave: process.env.PGPASSWORD,
      interactivo: !process.env.PGPASSWORD,
      archivo: join(RAIZ, 'db', 'roles.sql'),
      vars: { owner_user: c.dueno, owner_pw: c.claveDueno, app_user: c.app, app_pw: c.claveApp },
    });
    console.log('Roles listos.');
  },

  crear() {
    exigirClaves();
    if (!existeBd(c.bd)) {
      crearBd(c.bd);
      console.log(`Base ${c.bd} creada.`);
    }
    inicializar(c.bd);
    console.log(`Base ${c.bd} lista (esquema, semillas y privilegios).`);
  },

  iniciar() {
    exigirClaves();
    inicializar(c.bd);
    console.log(`Esquema y semillas aplicados en ${c.bd} (idempotente).`);
  },

  recrear() {
    exigirClaves();
    if (!resto.includes('--confirmar')) {
      console.error(
        `Esto BORRA la base "${c.bd}" y todos sus datos. Repite con: npm run db:recrear -- --confirmar`,
      );
      process.exit(1);
    }
    console.log(`Borrando y recreando ${c.bd}...`);
    borrarBdDesarrollo(c.bd);
    crearBd(c.bd);
    inicializar(c.bd);
    console.log(`Base ${c.bd} recreada con las semillas.`);
  },

  /** Pruebas: recrea una base desechable (vecinopay_test o vecinopay_e2e) con las semillas. */
  desechable() {
    exigirClaves();
    borrarBdDesechable(resto[0]);
    crearBd(resto[0]);
    inicializar(resto[0]);
    console.log(`Base desechable ${resto[0]} lista.`);
  },

  'borrar-desechable'() {
    exigirClaves();
    borrarBdDesechable(resto[0]);
    console.log(`Base desechable ${resto[0]} borrada.`);
  },

  /** Imprime la URL de la API (rol de pocos privilegios) para una base; la usan las pruebas de navegador. */
  'url-app'() {
    exigirClaves();
    console.log(urlApp(resto[0] ?? c.bd));
  },

  verificar() {
    exigirClaves();
    console.log(verificar(c.bd));
  },

  estado() {
    exigirClaves();
    const q = (db, sql) =>
      psql({ usuario: c.dueno, clave: c.claveDueno, db, sql, silencioso: true });
    console.log('Servidor:', q('postgres', 'SHOW server_version'));
    console.log('Zona del servidor:', q('postgres', 'SHOW timezone'));
    if (!existeBd(c.bd)) {
      console.log(`La base ${c.bd} no existe. Ejecuta: npm run db:crear`);
      return;
    }
    console.log(
      'Base:',
      q(
        'postgres',
        `SELECT datname || ' | codificacion ' || pg_encoding_to_char(encoding) || ' | proveedor ' || datlocprovider::text || ' | ' || coalesce(datlocale, datcollate) FROM pg_database WHERE datname = '${c.bd}'`,
      ),
    );
    console.log(
      'Tablas:',
      q(c.bd, "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"),
    );
    console.log('Hora de Lima:', q(c.bd, "SELECT now() AT TIME ZONE 'America/Lima'"));
  },
};

try {
  if (!ordenes[orden]) {
    console.error(
      'Uso: node scripts/db.mjs roles | crear | iniciar | recrear --confirmar | verificar | estado',
    );
    process.exit(1);
  }
  ordenes[orden]();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
