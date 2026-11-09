import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import A02Resumen from '../pantallas/admin/A02Resumen';
import D04NuevaCompra from '../pantallas/dueno/D04NuevaCompra';
import { D07Pago } from '../pantallas/dueno/D07Pago';
import { FranjaReloj } from '../plantillas/Plantilla';
import { Guarda, ProveedorSesion } from '../sesion/Sesion';

vi.mock('../ui/Graficos', () => ({ GraficoBarras: () => null, GraficoCirculo: () => null }));

type Ruta = { metodo?: string; ruta: RegExp; estado?: number; cuerpo: unknown };

/** API simulada: las cifras coinciden con 6.4. Devuelve qué se llamó, para comprobar los envíos. */
function apiFalsa(rutas: Ruta[]) {
  const llamadas: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, op) => {
    const ruta = String(url);
    const metodo = op?.method ?? 'GET';
    llamadas.push({ metodo, ruta, cuerpo: op?.body ? JSON.parse(String(op.body)) : undefined });
    const r = rutas.find((x) => x.ruta.test(ruta) && (x.metodo ?? 'GET') === metodo);
    if (!r)
      return new Response(
        JSON.stringify({ codigo: 'NO_EXISTE', mensaje: `Sin simular: ${ruta}` }),
        { status: 404 },
      );
    return new Response(JSON.stringify(r.cuerpo), { status: r.estado ?? 200 });
  });
  return llamadas;
}

const SIN_SESION: Ruta = {
  ruta: /auth\/yo/,
  estado: 401,
  cuerpo: { codigo: 'SIN_SESION', mensaje: 'x' },
};

function montar(hijo: ReactNode, inicio = '/') {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[inicio]}>
        <ProveedorSesion>{hijo}</ProveedorSesion>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('Guarda', () => {
  const rutas = (
    <Routes>
      <Route path="/login" element={<p>Pantalla de login</p>} />
      <Route path="/admin" element={<p>Pantalla de admin</p>} />
      <Route
        path="/dueno"
        element={
          <Guarda perfil="DUENO">
            <p>Solo dueño</p>
          </Guarda>
        }
      />
    </Routes>
  );

  it('sin sesión va al login', async () => {
    apiFalsa([SIN_SESION]);
    montar(rutas, '/dueno');
    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
  });

  it('con otro perfil va a su inicio', async () => {
    sessionStorage.setItem('vecinopay.token', 'x');
    apiFalsa([
      {
        ruta: /auth\/yo/,
        cuerpo: {
          usuario: { id: '1', username: 'a', nombres: 'A', perfil: 'ADMIN_SISTEMA' },
          tiendas: [],
        },
      },
    ]);
    montar(rutas, '/dueno');
    expect(await screen.findByText('Pantalla de admin')).toBeInTheDocument();
    expect(screen.queryByText('Solo dueño')).not.toBeInTheDocument();
  });
});

describe('franja de reloj', () => {
  it('con hora real no aparece', async () => {
    apiFalsa([
      {
        ruta: /salud/,
        cuerpo: {
          relojFijo: false,
          fechaLima: '2026-09-22',
          horaLima: '12:00:00',
          fechaOperativa: '2026-09-22',
        },
      },
    ]);
    const { container } = montar(<FranjaReloj />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
  it('con reloj fijo avisa la fecha y si cuenta como del día siguiente', async () => {
    apiFalsa([
      {
        ruta: /salud/,
        cuerpo: {
          relojFijo: true,
          fechaLima: '2026-09-26',
          horaLima: '17:30:00',
          fechaOperativa: '2026-09-27',
        },
      },
    ]);
    montar(<FranjaReloj />);
    expect(await screen.findByText(/reloj fijo en 26\/09\/2026 17:30:00/)).toHaveTextContent(
      'Cuenta como del 27/09/2026',
    );
  });
});

describe('A02', () => {
  const RESUMEN = {
    tiendasActivas: 5,
    usuariosActivos: 6,
    clientesRegistrados: 2,
    operacionesHoy: 5,
    altasPorMes: [],
    operacionesPorDia: [],
    tiendasPorGiro: [],
    ultimasOperaciones: [],
  };

  it('sin reloj fijo no ofrece el corte', async () => {
    apiFalsa([
      { ruta: /plataforma/, cuerpo: RESUMEN },
      { ruta: /salud/, cuerpo: { relojFijo: false } },
    ]);
    montar(<A02Resumen />);
    expect(await screen.findByText('Tiendas activas')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('Ejecutar corte de hoy')).not.toBeInTheDocument();
  });

  it('el resultado del corte no muestra importes', async () => {
    apiFalsa([
      { ruta: /plataforma/, cuerpo: RESUMEN },
      {
        ruta: /salud/,
        cuerpo: {
          relojFijo: true,
          fechaLima: '2026-10-20',
          horaLima: '17:00:01',
          fechaOperativa: '2026-10-21',
        },
      },
      {
        metodo: 'POST',
        ruta: /cortes/,
        cuerpo: {
          fecha: '2026-10-20',
          listadosEmitidos: [
            {
              numero: 'EC-202610-00001',
              clienteId: '1',
              total: '93.25',
              tienda: 'Minimarket Doña Rosa',
            },
            {
              numero: 'EC-202610-00001',
              clienteId: '9',
              total: '56.96',
              tienda: 'Ferretería Prueba',
            },
          ],
          omitidos: 3,
          vencidos: 1,
          errores: [],
        },
      },
    ]);
    montar(<A02Resumen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ejecutar corte de hoy' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));
    const r = await screen.findByText(/EC-202610-00001/);
    expect(r.textContent).not.toContain('93.25');
    expect(r.textContent).not.toContain('56.96');
    // Dos tiendas pueden tener el mismo número: cada listado dice de cuál es.
    expect(r.textContent).toContain('2 listados emitidos');
    expect(r.textContent).toContain('EC-202610-00001 de Minimarket Doña Rosa');
    expect(r.textContent).toContain('EC-202610-00001 de Ferretería Prueba');
    // Quien ya tenía su listado no está "sin listado": no tiene nada nuevo por listar.
    expect(r.textContent).toContain('3 clientes sin nada nuevo por listar');
    expect(r.textContent).toContain('1 listado vencido');
    expect(r.textContent).toContain('0 errores');
  });
});

const LUIS = {
  id: '1',
  nombres: 'Luis',
  apellidos: 'Quispe',
  moneda: 'PEN',
  maxMeses: 3,
  tedMora: '0.000264785548963',
};
const P003 = {
  id: '30',
  codigo: 'P003',
  nombre: 'Arroz',
  precioLista: '10.00',
  precioContado: '9.00',
  permiteFinMes: true,
  permiteCuotas: false,
};
const SIMULACION = {
  lineas: [
    {
      productoId: '30',
      codigo: 'P003',
      nombre: 'Arroz',
      cantidad: '99.900',
      precioLista: '10.00',
      precioContado: '9.00',
      subtotal: '999.00',
      subtotalContado: '899.10',
    },
  ],
  montoLista: '999.00',
  montoContado: '899.10',
  fechaOperativa: '2026-09-22',
  fechaCorte: '2026-10-20',
  fechaPago: '2026-10-26',
  limite: {
    aceptada: false,
    disponible: '255.08',
    limite: '500.00',
    su: '244.92',
    usoActualPorcentaje: '49.0',
    usoConCompraPorcentaje: '248.8',
    mensaje: 'Compra rechazada: supera el crédito disponible de S/ 255.08.',
  },
  finMes: { dias: 34, interes: '35.00', total: '1034.00' },
};

describe('D04', () => {
  const rutas = (extra: Ruta[] = []) => [
    { ruta: /clientes/, cuerpo: { items: [LUIS], total: 1 } },
    { ruta: /productos/, cuerpo: { items: [P003], total: 1 } },
    { metodo: 'POST', ruta: /compras\/simular/, cuerpo: SIMULACION },
    ...extra,
  ];
  const llenar = async () => {
    montar(<D04NuevaCompra />);
    await userEvent.selectOptions(await screen.findByLabelText('Cliente'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Producto'), '30');
    const cantidad = screen.getByLabelText('Cantidad');
    await userEvent.clear(cantidad);
    await userEvent.type(cantidad, '99.900');
  };

  it('no muestra subtotal hasta recibir la simulación y lo toma de la API', async () => {
    apiFalsa(rutas());
    await llenar();
    expect(screen.queryByText('S/ 999.00')).not.toBeInTheDocument();
    expect((await screen.findAllByText('S/ 999.00', {}, { timeout: 2000 })).length).toBeGreaterThan(
      0,
    );
  });

  it('sobre el límite: avisa, Confirmar sigue activo y el 422 llega a la franja', async () => {
    const llamadas = apiFalsa(
      rutas([
        {
          metodo: 'POST',
          ruta: /compras$/,
          estado: 422,
          cuerpo: {
            codigo: 'LIMITE_EXCEDIDO',
            mensaje: 'Compra rechazada: supera el crédito disponible de S/ 255.08.',
          },
        },
      ]),
    );
    await llenar();
    expect(
      await screen.findByText(/supera el crédito disponible/, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    const confirmar = screen.getByRole('button', { name: 'Confirmar compra' });
    await waitFor(() => expect(confirmar).toBeEnabled());
    await userEvent.click(confirmar);
    expect(await screen.findByText(/quedó registrado en la auditoría/)).toBeInTheDocument();
    expect(llamadas.filter((l) => l.metodo === 'POST' && l.ruta.endsWith('/compras'))).toHaveLength(
      1,
    );
  });
});

describe('D07', () => {
  const LISTADO = {
    id: '9',
    numero: 'EC-202609-00001',
    clienteId: '1',
    cliente: 'Luis Quispe',
    moneda: 'PEN',
    fechaPago: '2026-09-26',
    total: '228.42',
    estado: 'EMITIDO',
    items: [],
  };
  const LIQUIDACION = {
    fechaReal: '2026-10-01',
    horaReal: '12:00:00',
    fechaOperativaPago: '2026-10-01',
    diasMora: 5,
    mora: '0.30',
    totalALaFecha: '228.72',
    imputacion: { mora: '0.30', interes: '4.80', capital: '223.62' },
    disponibleDespues: '478.70',
  };
  const rutas = (extra: Ruta[] = []): Ruta[] => [
    { ruta: /listados\/9\/liquidacion/, cuerpo: LIQUIDACION },
    { ruta: /listados\/9$/, cuerpo: LISTADO },
    { ruta: /clientes\/1$/, cuerpo: LUIS },
    ...extra,
  ];
  const abrir = () =>
    montar(
      <Routes>
        <Route path="/dueno/listados/:id/pago" element={<D07Pago />} />
      </Routes>,
      '/dueno/listados/9/pago',
    );

  it('muestra total, imputación y disponible de la API; fecha y hora sin campo editable', async () => {
    apiFalsa(rutas());
    abrir();
    expect(await screen.findByText('01/10/2026 12:00:00')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Fecha/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Monto pagado')).toHaveValue('228.72');
    expect(screen.getByText('S/ 478.70')).toBeInTheDocument();
    expect(screen.getByText('S/ 223.62')).toBeInTheDocument();
  });

  it('con 200.00 envía igual; el 422 muestra la franja y el monto correcto', async () => {
    const llamadas = apiFalsa(
      rutas([
        {
          metodo: 'POST',
          ruta: /listados\/9\/pago/,
          estado: 422,
          cuerpo: {
            codigo: 'PAGO_NO_EXACTO',
            mensaje: 'Pago rechazado: debe pagar el total de S/ 228.72.',
            detalles: { totalALaFecha: '228.72' },
          },
        },
      ]),
    );
    abrir();
    const monto = await screen.findByLabelText('Monto pagado');
    await userEvent.clear(monto);
    await userEvent.type(monto, '200.00');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(
      await screen.findByText('Pago rechazado: debe pagar el total de S/ 228.72.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Monto correcto: S/ 228.72')).toBeInTheDocument();
    expect(llamadas.find((l) => l.metodo === 'POST')?.cuerpo).toMatchObject({
      montoPagado: '200.00',
      medioPago: 'Efectivo',
    });
  });

  it('aceptado: muestra el recibo', async () => {
    apiFalsa(
      rutas([
        {
          metodo: 'POST',
          ruta: /listados\/9\/pago/,
          estado: 201,
          cuerpo: {
            pago: {
              id: '1',
              fecha: '2026-10-01',
              hora: '12:00:00',
              monto: '228.72',
              medioPago: 'Yape',
              numeroOperacion: null,
              diasMora: 5,
            },
            imputacion: LIQUIDACION.imputacion,
            listado: { id: '9', numero: 'EC-202609-00001', estado: 'PAGADO', total: '228.72' },
            disponible: '478.70',
          },
        },
      ]),
    );
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    expect(await screen.findByText('Pago registrado')).toBeInTheDocument();
    expect(screen.getByText('S/ 478.70')).toBeInTheDocument();
  });
});
