import { cuantizarTasa, Dec, tasaEfectivaDiaria } from '../src';

const completas = {
  tedLuis: tasaEfectivaDiaria({ tipo: 'EFECTIVA', valor: '0.45', plazo: 360 }),
  tedmLuis: tasaEfectivaDiaria({ tipo: 'EFECTIVA', valor: '0.10', plazo: 360 }),
  tedMaria: tasaEfectivaDiaria({ tipo: 'NOMINAL', valor: '0.42', plazo: 360, capitalizacion: 30 }),
  tedmMaria: tasaEfectivaDiaria({ tipo: 'EFECTIVA', valor: '0.12', plazo: 360 }),
};

/** Toda cifra que usa TED se prueba con la tasa completa y con la que guarda la BD, DECIMAL(18,15). */
export const VARIANTES_TED: [string, typeof completas][] = [
  ['TED completa', completas],
  [
    'TED de 15 decimales',
    {
      tedLuis: cuantizarTasa(completas.tedLuis),
      tedmLuis: cuantizarTasa(completas.tedmLuis),
      tedMaria: cuantizarTasa(completas.tedMaria),
      tedmMaria: cuantizarTasa(completas.tedmMaria),
    },
  ],
];

/**
 * Importe a 2 decimales para comparar con el informe, sin tolerancia.
 * Falla si el valor no viene redondeado, para detectar que falte Red en un hito.
 */
export const f2 = (x: Dec) => {
  if (x.decimalPlaces() > 2) throw new Error(`Importe sin redondear: ${x.toString()}`);
  return x.toFixed(2);
};

/** Tasa o valor intermedio con los decimales que imprime el informe; aquí sí se redondea. */
export const fN = (x: Dec, decimales: number) => x.toFixed(decimales);
