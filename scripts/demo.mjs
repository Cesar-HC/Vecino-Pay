// Demo sin Docker: compila una vez y levanta la API (PORT, 3000) y la web (WEB_PORT, 8080) juntas.
// Se detienen con Ctrl+C. La base debe existir: npm run db:crear
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { RAIZ } from './lib/pg.mjs';

const env = { ...process.env, TZ: 'America/Lima' };
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const web = Number(process.env.WEB_PORT ?? 8080);
const api = Number(process.env.PORT ?? 3000);

function paso(titulo, comando, args) {
  console.log(`\n== ${titulo}`);
  const r = spawnSync(comando, args, {
    cwd: RAIZ,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    console.error(`Falló: ${titulo}`);
    process.exit(r.status ?? 1);
  }
}

if (!process.env.SIN_BUILD) paso('Compilando (motor, API y web)', npm, ['run', 'build']);

const hijos = [];
function lanzar(prefijo, comando, args, { shell = false } = {}) {
  const h = spawn(comando, args, { cwd: RAIZ, env, shell });
  const salida = (d) =>
    String(d)
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((l) => console.log(`[${prefijo}] ${l}`));
  h.stdout.on('data', salida);
  h.stderr.on('data', salida);
  h.on('exit', (codigo) => {
    console.log(`[${prefijo}] terminó (${codigo}).`);
    detener(codigo ?? 0);
  });
  hijos.push(h);
}

let cerrando = false;
function detener(codigo = 0) {
  if (cerrando) return;
  cerrando = true;
  for (const h of hijos) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(h.pid), '/T', '/F']);
    else h.kill();
  }
  process.exit(codigo);
}
process.on('SIGINT', () => detener(0));
process.on('SIGTERM', () => detener(0));

lanzar('api', process.execPath, [join(RAIZ, 'apps', 'api', 'dist', 'main.js')]);
lanzar('web', npm, ['run', 'preview', '-w', 'apps/web'], { shell: process.platform === 'win32' });
console.log(
  `\nAPI en http://127.0.0.1:${api}/api/docs · Web en http://localhost:${web} (Ctrl+C para detener)`,
);
