import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Ingreso from '../pantallas/comun/Ingreso';
import { Inicio } from '../pantallas/comun/Landing';
import { ProveedorSesion } from '../sesion/Sesion';

function usuario(perfil: string) {
  return {
    token: 't',
    usuario: { id: '1', username: 'u', nombres: 'U', perfil },
    tiendas: [],
  };
}

/** Responde el login con el perfil pedido y registra el cuerpo enviado. */
function apiFalsa(perfilSesion?: string) {
  const logins: unknown[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, op) => {
    const ruta = String(url);
    if (ruta.includes('auth/login')) {
      const cuerpo = JSON.parse(String(op?.body));
      logins.push(cuerpo);
      return new Response(JSON.stringify(usuario(cuerpo.perfil)), { status: 200 });
    }
    if (ruta.includes('auth/yo') && perfilSesion) {
      return new Response(JSON.stringify(usuario(perfilSesion)), { status: 200 });
    }
    if (ruta.includes('salud'))
      return new Response(JSON.stringify({ relojFijo: false }), { status: 200 });
    return new Response(JSON.stringify({ codigo: 'SIN_SESION', mensaje: 'x' }), { status: 401 });
  });
  return logins;
}

function montar(hijo: ReactNode, inicio: string, estado?: unknown) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[{ pathname: inicio, state: estado }]}>
        <ProveedorSesion>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/ingresar" element={hijo} />
            <Route path="/m" element={<p>Inicio del cliente</p>} />
            <Route path="/dueno" element={<p>Inicio del dueño</p>} />
            <Route path="/admin" element={<p>Inicio del admin</p>} />
            <Route path="/m/activar" element={<p>Pantalla de activación</p>} />
          </Routes>
        </ProveedorSesion>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('Ingreso único', () => {
  it('modo cliente: envía el DNI como usuario con perfil CLIENTE y va a /m', async () => {
    const logins = apiFalsa();
    montar(<Ingreso modoInicial="cliente" />, '/ingresar');
    await userEvent.type(screen.getByLabelText('DNI'), '12345678');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave1234');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Inicio del cliente')).toBeInTheDocument();
    expect(logins).toEqual([{ username: '12345678', password: 'clave1234', perfil: 'CLIENTE' }]);
  });

  it('modo comercio: DUENO por defecto y ADMIN_SISTEMA al elegirlo', async () => {
    const logins = apiFalsa();
    const { unmount } = montar(<Ingreso modoInicial="comercio" />, '/ingresar');
    await userEvent.type(screen.getByLabelText('Usuario'), 'rosa@vecinopay.test');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave1234');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Inicio del dueño')).toBeInTheDocument();
    expect((logins[0] as { perfil: string }).perfil).toBe('DUENO');
    unmount();
    sessionStorage.clear();

    montar(<Ingreso modoInicial="comercio" />, '/ingresar');
    await userEvent.type(screen.getByLabelText('Usuario'), 'admin@vecinopay.test');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave1234');
    await userEvent.selectOptions(screen.getByLabelText('Perfil'), 'ADMIN_SISTEMA');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Inicio del admin')).toBeInTheDocument();
    expect((logins[1] as { perfil: string }).perfil).toBe('ADMIN_SISTEMA');
  });

  it('alternar entre las pestañas muestra los campos correctos y limpia los errores', async () => {
    apiFalsa();
    montar(<Ingreso modoInicial="cliente" />, '/ingresar');
    expect(screen.getByLabelText('DNI')).toBeInTheDocument();
    expect(screen.queryByLabelText('Perfil')).toBeNull();
    await userEvent.type(screen.getByLabelText('DNI'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('El DNI debe tener 8 dígitos numéricos.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Soy dueño' }));
    expect(screen.getByRole('tab', { name: 'Soy dueño' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
    expect(screen.getByLabelText('Perfil')).toBeInTheDocument();
    expect(screen.queryByLabelText('DNI')).toBeNull();
    expect(screen.queryByText('El DNI debe tener 8 dígitos numéricos.')).toBeNull();
  });

  it('con sesión abierta redirige al inicio de su perfil', async () => {
    sessionStorage.setItem('vecinopay.token', 't');
    apiFalsa('DUENO');
    montar(<Ingreso modoInicial="cliente" />, '/ingresar');
    expect(await screen.findByText('Inicio del dueño')).toBeInTheDocument();
  });

  it('muestra «Cuenta creada» al venir de activar la cuenta', () => {
    apiFalsa();
    montar(<Ingreso modoInicial="cliente" />, '/ingresar', { activada: true });
    expect(
      screen.getByText('Cuenta creada. Ingresa con tu DNI y tu nueva contraseña.'),
    ).toBeInTheDocument();
  });

  it('no ofrece registro abierto y enlaza a activar la cuenta', () => {
    apiFalsa();
    montar(<Ingreso modoInicial="cliente" />, '/ingresar');
    expect(screen.queryByText(/registr/i, { selector: 'a, button' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Activa tu cuenta' })).toHaveAttribute(
      'href',
      '/m/activar',
    );
  });
});

describe('Landing en «/»', () => {
  it('sin sesión muestra Ingresar y el enlace para activar la cuenta, sin registro', async () => {
    apiFalsa();
    montar(<p />, '/');
    expect(await screen.findByRole('link', { name: 'Ingresar' })).toHaveAttribute(
      'href',
      '/ingresar',
    );
    expect(screen.getByRole('link', { name: 'Activa tu cuenta' })).toHaveAttribute(
      'href',
      '/m/activar',
    );
    expect(screen.queryByText(/registr/i, { selector: 'a, button' })).toBeNull();
  });

  it('con sesión redirige al inicio de su perfil', async () => {
    sessionStorage.setItem('vecinopay.token', 't');
    apiFalsa('CLIENTE');
    montar(<p />, '/');
    expect(await screen.findByText('Inicio del cliente')).toBeInTheDocument();
  });
});
