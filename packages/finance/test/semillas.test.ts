import { readFileSync } from 'fs';
import { join } from 'path';
import {
  asignarCiclo,
  cuantizarTasa,
  Dec,
  diasEntre,
  fechaOperativaLocal,
  interesCompra,
  simularVentaEnCuotas,
  tasaEfectivaDiaria,
  tem,
} from '../src';

const sql = readFileSync(join(__dirname, '../../../db/init/02_semillas.sql'), 'utf8');

/** Valor literal de una constante declarada en el archivo de semillas. */
function literal(nombre: string): string {
  const m = new RegExp(`${nombre}\\s+CONSTANT NUMERIC\\(\\d+,\\d+\\) := ([0-9.]+);`).exec(sql);
  if (!m) throw new Error(`No se encontró ${nombre} en 02_semillas.sql`);
  return m[1];
}

/** Importe como patrón de regex, con el punto escapado. */
const monto = (x: Dec) => x.toFixed(2).replace('.', '\\.');

const ted = (t: Parameters<typeof tasaEfectivaDiaria>[0]) =>
  cuantizarTasa(tasaEfectivaDiaria(t)).toFixed(15);
const tedMaria = ted({ tipo: 'NOMINAL', valor: '0.42', plazo: 360, capitalizacion: 30 });

describe('Tiendas de demostración', () => {
  it('su lote no agrega nada de operación: los juegos 1 y 2 siguen solo en Doña Rosa', () => {
    const inicio = sql.indexOf('-- Tiendas de demostración para A02 a A05');
    expect(inicio).toBeGreaterThan(0);
    const lote = sql.slice(inicio);
    for (const tabla of ['cliente', 'compra', 'compra_detalle', 'cuota', 'listado_pago', 'listado_item', 'pago']) {
      expect(lote).not.toContain(`INSERT INTO ${tabla} `);
    }
  });
});

describe('Las semillas coinciden con el motor', () => {
  it('TED guardadas', () => {
    expect(literal('ted_luis')).toBe(ted({ tipo: 'EFECTIVA', valor: '0.45', plazo: 360 }));
    expect(literal('tedm_luis')).toBe(ted({ tipo: 'EFECTIVA', valor: '0.10', plazo: 360 }));
    expect(literal('ted_maria')).toBe(tedMaria);
    expect(literal('tedm_maria')).toBe(ted({ tipo: 'EFECTIVA', valor: '0.12', plazo: 360 }));
  });
  it('TEM y TCEA de la compra en cuotas, y su VAN', () => {
    expect(literal('tem_maria')).toBe(cuantizarTasa(tem(tedMaria)).toFixed(15));
    const s = simularVentaEnCuotas({
      p: '257.80',
      pContado: '249.80',
      ted: tedMaria,
      n: 3,
      maxMeses: 3,
      cok: '0.20',
      fechaOperativa: '2026-09-15',
      diaCorte: 20,
      diaPago: 26,
    });
    expect(literal('tcea_maria')).toBe(cuantizarTasa(s.indicadores.tcea, 10).toFixed(10));
    expect(sql).toContain(
      `3, ${s.plan.g}, ${s.plan.capitalCapitalizado.toFixed(2)}, tem_maria, ${s.plan.cuotaFija.toFixed(2)}, tcea_maria, ${s.indicadores.van.toFixed(2)}`,
    );
    for (const f of s.plan.filas) {
      const importes = [f.interes, f.amortizacion, f.cuota].map(monto).join(', ');
      const fila = new RegExp(
        `\\(${f.k}, CAST\\('${f.vence}' AS DATE\\),\\s+${monto(f.saldoInicial)}, ${importes},\\s+${monto(f.saldoFinal)}\\)`,
      );
      expect(sql).toMatch(fila);
    }
  });
  it('fechas de ciclo y líneas del listado de cada compra a fin de mes', () => {
    const tedLuis = literal('ted_luis');
    const compra =
      /\(v_tienda, v_luis, '(T-\d+)', '(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})', 'FIN_MES', ([\d.]+), [\d.]+, '([\d-]+)', '([\d-]+)'\)/g;
    let revisadas = 0;
    for (const [, ticket, fecha, hora, capital, fechaCorte, fechaPago] of sql.matchAll(compra)) {
      const fechaOperativa = fechaOperativaLocal(fecha, hora);
      expect(asignarCiclo({ fechaOperativa, diaCorte: 20, diaPago: 26 })).toEqual({
        fechaCorte,
        fechaPago,
      });
      if (ticket !== 'T-000301') {
        const dias = diasEntre(fechaOperativa, fechaPago);
        const interes = monto(interesCompra(capital, tedLuis, dias));
        expect(sql).toMatch(
          new RegExp(
            `'${ticket}', CAST\\('${fechaOperativa}' AS DATE\\), +${dias}, ${capital.replace('.', '\\.')}, ${interes},`,
          ),
        );
      }
      revisadas++;
    }
    expect(revisadas).toBe(6);
  });
});
