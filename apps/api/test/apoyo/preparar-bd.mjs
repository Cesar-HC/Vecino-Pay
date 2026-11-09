// Prepara una base desechable (vecinopay_test) en el PostgreSQL local para las pruebas de integración.
// Nunca toca la base de desarrollo: borrarBdDesechable solo acepta vecinopay_test o vecinopay_e2e.
import {
  borrarBdDesechable,
  crearBd,
  inicializar,
  verificar,
} from '../../../../scripts/lib/pg.mjs';

const BD = process.env.BD_PRUEBAS || 'vecinopay_test';

try {
  if (process.env.CONSERVAR_BD !== '1') {
    borrarBdDesechable(BD);
    crearBd(BD);
    inicializar(BD);
    console.log(verificar(BD));
  } else {
    inicializar(BD);
  }
  console.log(`BD de pruebas lista: ${BD}.`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
