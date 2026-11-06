// Orden alfabético: 01-semillas debe correr antes de que otras pruebas ejecuten cortes, que alcanzan a todas las tiendas.
const Secuenciador = require('@jest/test-sequencer').default;

class OrdenAlfabetico extends Secuenciador {
  sort(pruebas) {
    return [...pruebas].sort((a, b) => (a.path < b.path ? -1 : 1));
  }
}

module.exports = OrdenAlfabetico;
