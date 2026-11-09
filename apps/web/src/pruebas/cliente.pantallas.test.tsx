import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import C01LoginCliente from '../pantallas/cliente/C01LoginCliente';
import C05MiListado from '../pantallas/cliente/C05MiListado';
import C06MisCuotas from '../pantallas/cliente/C06MisCuotas';
import C08MiPerfil from '../pantallas/cliente/C08MiPerfil';
import { Guarda, ProveedorSesion } from '../sesion/Sesion';

vi.mock('../ui/Graficos', () => ({ GraficoBarras: () => null, GraficoCirculo: () => null }));

/** API simulada: responde por fragmento de ruta; lo demás es 404. Las cifras salen de 6.4. */
function apiFalsa(rutas: Record<string, unknown>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const ruta = String(url);
    const clave = Object.keys(rutas)
      .sort((a, b) => b.length - a.length)
      .find((r) => ruta.includes(r));
    return clave
      ? new Response(JSON.stringify(rutas[clave]), { status: 200 })
      : new Response(JSON.stringify({ codigo: 'NO_EXISTE', mensaje: ruta }), { status: 404 });
  });
}

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

const SIN_SESION = { codigo: 'SIN_SESION', mensaje: 'x' };

const LISTADO_VENCIDO = {
  id: '1',
  numero: 'EC-202609-00001',
  clienteId: '1',
  fechaCorte: '2026-09-20',
  horaCorte: '17:00:00',
  fechaPago: '2026-09-26',
  totalCapital: '223.62',
  totalInteres: '4.80',
  totalMora: '0.00',
  total: '228.42',
  estado: 'EMITIDO',
  estadoEfectivo: 'VENCIDO',
  fechaPagoReal: null,
  diasMora: null,
  moneda: 'PEN',
  cliente: 'Luis Quispe',
  tasa: '0.45',
  items: [
    {
      orden: 1,
      tipo: 'COMPRA',
      ticket: 'T-000245',
      cuotaNumero: null,
      detalle: [],
      fechaHoraRegistro: '2026-08-29T18:40:00',
      fecha: '2026-08-30',
      posteriorAlCorte: true,
      capital: '32.80',
      interes: '0.93',
      total: '33.73',
      dias: 27,
    },
  ],
  comprasPosteriores: [
    {
      ticket: 'T-000301',
      fechaHora: '2026-09-20T17:45:00',
      fechaOperativa: '2026-09-21',
      monto: '21.30',
      fechaPago: '2026-10-26',
    },
  ],
  moraALaFecha: { diasMora: 5, mora: '0.30', totalALaFecha: '228.72' },
};

describe('Guarda del cliente', () => {
  it('sin sesión lleva a /m/login y no al login del dueño', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(JSON.stringify(SIN_SESION), { status: 401 }),
    );
    montar(
      <Routes>
        <Route path="/login" element={<p>Login del dueño</p>} />
        <Route path="/m/login" element={<p>Login del cliente</p>} />
        <Route
          path="/m/*"
          element={
            <Guarda perfil="CLIENTE" login="/m/login">
              <p>Privado</p>
            </Guarda>
          }
        />
      </Routes>,
      '/m/listado',
    );
    expect(await screen.findByText('Login del cliente')).toBeInTheDocument();
    expect(screen.queryByText('Login del dueño')).not.toBeInTheDocument();
  });
});

describe('C05 Mi listado (juego 1)', () => {
  it('vencido: suma la mora (228.72) y avisa la compra posterior al corte con hora y fecha de pago', async () => {
    apiFalsa({
      '/mi/listados': { items: [LISTADO_VENCIDO], total: 1 },
      '/mi/listados/1': LISTADO_VENCIDO,
    });
    montar(<C05MiListado />);
    expect(await screen.findByText('S/ 228.72')).toBeInTheDocument();
    expect(screen.getByText('S/ 0.30')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Tu compra del 20\/09\/2026 a las 17:45 \(S\/ 21\.30\) fue después del corte\. La pagarás el 26\/10\/2026\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Compra registrada después de las 17:00/)).toBeInTheDocument();
  });

  it('si la API falla no dice que no hay listados', async () => {
    apiFalsa({});
    montar(<C05MiListado />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/Aún no tienes listados/)).not.toBeInTheDocument();
  });
});

describe('C06 Mis cuotas (juego 2, María)', () => {
  it('muestra 93.25, 93.25 y 93.26, TCEA 51.09 % y los 11 días de gracia', async () => {
    apiFalsa({
      '/mi/cuotas': {
        compras: [
          {
            ticket: 'T-000284',
            cuotaFija: '93.25',
            tcea: '0.5109',
            tceaPorcentaje: '51.09',
            proximaCuota: { numero: 1, vence: '2026-10-26', monto: '93.25' },
            filas: [
              { numero: 1, vence: '2026-10-26', monto: '93.25', estado: 'PENDIENTE' },
              { numero: 2, vence: '2026-11-26', monto: '93.25', estado: 'PENDIENTE' },
              { numero: 3, vence: '2026-12-26', monto: '93.26', estado: 'PENDIENTE' },
            ],
            explicacion: {
              fechaCompra: '2026-09-15',
              fechaPago: '2026-09-26',
              g: 11,
              interesGracia: '3.27',
              montoLista: '257.80',
              capitalCapitalizado: '261.07',
            },
          },
        ],
      },
    });
    const { container } = montar(<C06MisCuotas />);
    expect(await screen.findByText('Compra T-000284 · 3 cuotas')).toBeInTheDocument();
    expect(screen.getByText('TCEA: 51.09 %')).toBeInTheDocument();
    expect(screen.getAllByText('S/ 93.25').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('S/ 93.26')).toBeInTheDocument();
    expect(screen.getByText('¿Por qué 11 días de gracia?')).toBeInTheDocument();
    expect(container.textContent).toContain('S/ 3.27');
    expect(container.textContent).toContain('S/ 261.07');
    expect(container.textContent).not.toMatch(/VAN|COK|contado/i);
  });
});

describe('C08 Mi perfil', () => {
  it('muestra moneda, límite, tasas, corte y pago pactados', async () => {
    apiFalsa({
      '/mi/perfil': {
        id: '1',
        numeroCuenta: '00000001',
        dni: '45872316',
        nombres: 'Luis',
        apellidos: 'Quispe',
        celular: '951284736',
        direccion: null,
        moneda: 'PEN',
        limiteCredito: '500.00',
        maxMeses: 3,
        diaCorte: 20,
        horaCorte: '17:00:00',
        diaPago: 26,
        tasa: { tipo: 'EFECTIVA', valor: '0.450000000', plazo: 360, capitalizacion: null },
        tasaMora: { tipo: 'EFECTIVA', valor: '0.100000000' },
      },
    });
    montar(<C08MiPerfil />);
    expect(await screen.findByText('Soles (PEN)')).toBeInTheDocument();
    expect(screen.getByText('S/ 500.00')).toBeInTheDocument();
    expect(screen.getByText('TEA 45 %')).toBeInTheDocument();
    expect(screen.getByText('TEA 10 %')).toBeInTheDocument();
    expect(screen.getByText('Día 20 de cada mes')).toBeInTheDocument();
    expect(screen.getByText('Día 26 de cada mes')).toBeInTheDocument();
  });
});

describe('C01 Login del cliente', () => {
  it('un DNI mal escrito se explica y no llama al login', async () => {
    const espia = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify(SIN_SESION), { status: 401 }));
    montar(<C01LoginCliente />);
    await userEvent.type(await screen.findByLabelText(/DNI/), '123');
    await userEvent.click(screen.getByRole('button', { name: /Ingresar/ }));
    expect(await screen.findByText('El DNI debe tener 8 dígitos numéricos.')).toBeInTheDocument();
    expect(espia.mock.calls.filter(([u]) => String(u).includes('auth/login'))).toHaveLength(0);
  });
});
