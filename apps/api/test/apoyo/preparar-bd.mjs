// Levanta una BD desechable para las pruebas de integración, sin tocar la de desarrollo.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '../../../..');
const env = { ...process.env, DB_PORT: '14333', MSYS_NO_PATHCONV: '1' };
const compose = (...args) => {
  const r = spawnSync('docker', ['compose', '-p', 'vecinopay_test', ...args], {
    cwd: raiz,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { ok: r.status === 0, salida: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
};
const exigir = (paso, r) => {
  if (!r.ok) {
    console.error(`Falló ${paso}:\n${r.salida}`);
    process.exit(1);
  }
};

if (process.env.CONSERVAR_BD !== '1') exigir('down', compose('down', '-v'));
exigir('up', compose('up', '-d', 'db', 'db-init'));

// db-init termina al aplicar los scripts; se espera a que salga con código 0.
for (let i = 0; ; i++) {
  const r = compose('ps', '-a', '--format', '{{.Service}} {{.State}} {{.ExitCode}}');
  const fila = r.salida.split('\n').find((l) => l.startsWith('db-init '));
  if (fila?.includes('exited')) {
    if (!fila.endsWith(' 0')) {
      console.error(compose('logs', 'db-init').salida);
      process.exit(1);
    }
    break;
  }
  if (i > 60) {
    console.error('db-init no terminó a tiempo.');
    process.exit(1);
  }
  spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},3000)']);
}

if (process.env.CONSERVAR_BD !== '1') {
  exigir('verificación', compose('run', '--rm', '--entrypoint', '/bin/bash', 'db-init', '/db/verificar.sh'));
}
console.log('BD de pruebas lista en localhost,14333.');
