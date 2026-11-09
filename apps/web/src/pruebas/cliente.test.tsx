import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import C03InicioCliente from '../pantallas/cliente/C03InicioCliente';
import C07MisPagos from '../pantallas/cliente/C07MisPagos';
import C09AyudaCliente from '../pantallas/cliente/C09AyudaCliente';

vi.mock('../ui/Graficos', () => ({ GraficoBarras: () => null, GraficoCirculo: () => null }));

function apiFalsa(rutas: Record<string, unknown>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const clave = Object.keys(rutas).find((r) => String(url).includes(r));
    return clave
      ? new Response(JSON.stringify(rutas[clave]), { status: 200 })
      : new Response(JSON.stringify({ codigo: 'NO_EXISTE', mensaje: String(url) }), {
          status: 404,
        });
  });
}

function montar(hijo: React.ReactNode) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>{hijo}</MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

const RESUMEN_LUIS = {
  cliente: { nombre: 'Luis Quispe', numeroCuenta: '00000001' },
  tienda: { nombreComercial: 'Minimarket Doña Rosa' },
  moneda: 'PEN',
  proximoPago: {
    total: '228.42',
    capital: '223.62',
    interes: '4.80',
    mora: '0.00',
    totalALaFecha: '228.42',
    fecha: '2026-09-26',
    diasRestantes: 4,
    proyectado: false,
  },
  credito: { limite: '500.00', usado: '244.92', disponible: '255.08', usoPorcentaje: '49.0' },
  comprasPorSemana: [],
  comprasDelCiclo: 5,
  tasa: { tipo: 'EFECTIVA', valor: '0.450000000', plazo: 360, capitalizacion: null },
};

describe('C03 Inicio del cliente (juego 1, Luis)', () => {
  it('muestra 228.42, 223.62, 4.80, 255.08 y 49.0 %; sin mora no hay fila de mora', async () => {
    apiFalsa({ '/mi/resumen': RESUMEN_LUIS });
    montar(<C03InicioCliente />);
    expect(await screen.findByText('S/ 228.42')).toBeInTheDocument();
    expect(screen.getByText('S/ 223.62')).toBeInTheDocument();
    expect(screen.getByText('S/ 4.80')).toBeInTheDocument();
    expect(screen.getByText('S/ 255.08')).toBeInTheDocument();
    expect(screen.getByText(/49\.0 % del límite/)).toBeInTheDocument();
    expect(screen.getByText('TEA 45 %')).toBeInTheDocument();
    expect(screen.queryByText('Interés moratorio')).not.toBeInTheDocument();
  });

  it('no muestra VAN, COK ni precio contado (RF09)', async () => {
    apiFalsa({ '/mi/resumen': RESUMEN_LUIS });
    const { container } = montar(<C03InicioCliente />);
    await screen.findByText('S/ 228.42');
    expect(container.textContent).not.toMatch(/VAN|COK|contado/i);
  });

  it('con mora muestra el interés moratorio y los días de atraso', async () => {
    apiFalsa({
      '/mi/resumen': {
        ...RESUMEN_LUIS,
        proximoPago: {
          ...RESUMEN_LUIS.proximoPago,
          mora: '0.30',
          totalALaFecha: '228.72',
          diasRestantes: -5,
        },
      },
    });
    montar(<C03InicioCliente />);
    expect(await screen.findByText('Interés moratorio')).toBeInTheDocument();
    expect(screen.getByText('S/ 0.30')).toBeInTheDocument();
    expect(screen.getByText('5 d de atraso')).toBeInTheDocument();
  });

  it('un error de la API se explica con un reintento', async () => {
    apiFalsa({});
    montar(<C03InicioCliente />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('C07 Mis pagos (imputación mora, interés, capital)', () => {
  it('muestra la imputación 0.30, 4.80 y 223.62 del pago de 228.72', async () => {
    apiFalsa({
      '/mi/pagos': {
        disponible: '500.00',
        pagos: [
          {
            fecha: '2026-10-01T12:00:00-05:00',
            medioPago: 'EFECTIVO',
            numeroOperacion: null,
            monto: '228.72',
            diasMora: 5,
            imputacion: { mora: '0.30', interes: '4.80', capital: '223.62' },
            listadoNumero: 'EC-202609-00001',
          },
        ],
      },
    });
    montar(<C07MisPagos />);
    expect((await screen.findAllByText('S/ 228.72')).length).toBeGreaterThan(0);
    expect(screen.getByText('S/ 0.30')).toBeInTheDocument();
    expect(screen.getByText('S/ 4.80')).toBeInTheDocument();
    expect(screen.getByText('S/ 223.62')).toBeInTheDocument();
  });
});

describe('C09 Ayuda del cliente', () => {
  it('formatea la TED del ejemplo con 7 decimales en porcentaje y 10 en tanto por uno', async () => {
    apiFalsa({
      '/mi/ayuda/ejemplo': {
        ticket: 'T-000231',
        capital: '44.20',
        ted: '0.001032653810255',
        dias: 35,
        factor: '0.0368',
        interes: '1.63',
        total: '45.83',
      },
    });
    montar(<C09AyudaCliente />);
    expect(await screen.findByText(/0\.1032654 % \(0\.0010326538\)/)).toBeInTheDocument();
    expect(screen.getByText('S/ 45.83')).toBeInTheDocument();
  });
});
