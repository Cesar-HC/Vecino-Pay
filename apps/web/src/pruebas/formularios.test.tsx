import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode, useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mayorQueCero } from '../lib/entrada';
import Ingreso from '../pantallas/comun/Ingreso';
import A03Tiendas from '../pantallas/admin/A03Tiendas';
import A04Usuarios from '../pantallas/admin/A04Usuarios';
import A05Auditoria from '../pantallas/admin/A05Auditoria';
import D02Productos from '../pantallas/dueno/D02Productos';
import { D03Ficha, D03Lista } from '../pantallas/dueno/D03Clientes';
import D04NuevaCompra from '../pantallas/dueno/D04NuevaCompra';
import { Plantilla } from '../plantillas/Plantilla';
import { ProveedorSesion } from '../sesion/Sesion';
import { Ayuda } from '../ui/base';

type Ruta = { metodo?: string; ruta: RegExp; estado?: number; cuerpo: unknown };

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

const envios = <T extends { metodo: string }>(l: T[]) => l.filter((x) => x.metodo !== 'GET');

describe('entrada', () => {
  it('mayorQueCero no lanza error con un texto que no es número', () => {
    expect(mayorQueCero('')).toBe(false);
    expect(mayorQueCero('abc')).toBe(false);
    expect(mayorQueCero('0')).toBe(false);
    expect(mayorQueCero('0.01')).toBe(true);
  });
});

describe('globo de ayuda', () => {
  it('un toque lo abre: mouseenter, focus y click no lo cierran', () => {
    render(<Ayuda texto="Texto de ayuda" />);
    const b = screen.getByRole('button');
    fireEvent.mouseEnter(b);
    fireEvent.focus(b);
    fireEvent.click(b);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Texto de ayuda');
    fireEvent.keyDown(b, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('globo de ayuda en el borde', () => {
  const rect = (left: number, right: number) => ({
    left,
    right,
    top: 0,
    bottom: 0,
    width: right - left,
    height: 0,
    x: left,
    y: 0,
    toJSON: () => ({}),
  });

  it('se mueve lo justo para entrar en la ventana; si cabe, no se mueve', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(375);
    const medida = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(rect(300, 556));
    render(<Ayuda texto="Texto" />);
    fireEvent.focus(screen.getByRole('button'));
    // 556 − (375 − 8) = 189, sin pasarse del margen izquierdo.
    expect(screen.getByRole('tooltip').style.transform).toBe('translateX(-189px)');
    cleanup();

    medida.mockReturnValue(rect(10, 266));
    render(<Ayuda texto="Texto" />);
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip').style.transform).toBe('');
  });
});

describe('sesión', () => {
  it('el token va a sessionStorage y no a localStorage', async () => {
    apiFalsa([
      {
        metodo: 'POST',
        ruta: /auth\/login/,
        cuerpo: {
          token: 'abc',
          usuario: { id: '1', username: 'r', nombres: 'R', perfil: 'DUENO' },
          tiendas: [],
        },
      },
      { ruta: /salud/, cuerpo: { relojFijo: false } },
    ]);
    montar(
      <Routes>
        <Route path="/login" element={<Ingreso modoInicial="comercio" />} />
        <Route path="/dueno" element={<p>Inicio del dueño</p>} />
      </Routes>,
      '/login',
    );
    await userEvent.type(screen.getByLabelText('Usuario'), 'r');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Inicio del dueño')).toBeInTheDocument();
    expect(sessionStorage.getItem('vecinopay.token')).toBe('abc');
    expect(globalThis.localStorage?.getItem('vecinopay.token') ?? null).toBeNull();
  });

  it('un fallo pasajero de /auth/yo no borra el token y avisa; un 401 sí lo borra', async () => {
    sessionStorage.setItem('vecinopay.token', 'x');
    apiFalsa([
      { ruta: /auth\/yo/, estado: 500, cuerpo: { codigo: 'ERROR_INTERNO', mensaje: 'x' } },
    ]);
    const { unmount } = montar(<p>hola</p>);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(sessionStorage.getItem('vecinopay.token')).toBe('x');
    unmount();
    vi.restoreAllMocks();
    apiFalsa([{ ruta: /auth\/yo/, estado: 401, cuerpo: { codigo: 'SIN_SESION', mensaje: 'x' } }]);
    montar(<p>hola</p>);
    await waitFor(() => expect(sessionStorage.getItem('vecinopay.token')).toBeNull());
  });

  it('el selector aparece con 2 tiendas: al cambiar guarda el token nuevo y vuelve al inicio, sin la pantalla anterior', async () => {
    sessionStorage.setItem('vecinopay.token', 'viejo');
    const tiendas = [
      { id: '3', nombreComercial: 'Bodega' },
      { id: '5', nombreComercial: 'Pollería' },
    ];
    apiFalsa([
      {
        ruta: /auth\/yo/,
        cuerpo: {
          usuario: { id: '1', username: 'c', nombres: 'Carlos', perfil: 'DUENO' },
          tienda: tiendas[0],
          tiendas,
        },
      },
      { ruta: /salud/, cuerpo: { relojFijo: false } },
      { metodo: 'POST', ruta: /cambiar-tienda/, cuerpo: { token: 'nuevo', tienda: tiendas[1] } },
    ]);
    montar(
      <Routes>
        <Route path="/dueno" element={<Plantilla tipo="dueno" />}>
          <Route index element={<p>Inicio</p>} />
          <Route path="clientes" element={<p>Ficha de otra tienda</p>} />
        </Route>
      </Routes>,
      '/dueno/clientes',
    );
    const selector = await screen.findByLabelText('Tienda');
    expect(screen.getByText('Ficha de otra tienda')).toBeInTheDocument();
    await userEvent.selectOptions(selector, '5');
    expect(await screen.findByText('Inicio')).toBeInTheDocument();
    expect(screen.queryByText('Ficha de otra tienda')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('vecinopay.token')).toBe('nuevo');
  });
});

describe('cambio de tienda', () => {
  it('vuelve a montar la pantalla aunque ya estuviera en el inicio', async () => {
    sessionStorage.setItem('vecinopay.token', 'viejo');
    const tiendas = [
      { id: '3', nombreComercial: 'Bodega' },
      { id: '5', nombreComercial: 'Pollería' },
    ];
    apiFalsa([
      {
        ruta: /auth\/yo/,
        cuerpo: {
          usuario: { id: '1', username: 'c', nombres: 'Carlos', perfil: 'DUENO' },
          tienda: tiendas[0],
          tiendas,
        },
      },
      { ruta: /salud/, cuerpo: { relojFijo: false } },
      { metodo: 'POST', ruta: /cambiar-tienda/, cuerpo: { token: 'nuevo', tienda: tiendas[1] } },
    ]);
    let montajes = 0;
    function Hija() {
      useEffect(() => {
        montajes++;
      }, []);
      return <p>Inicio</p>;
    }
    montar(
      <Routes>
        <Route path="/dueno" element={<Plantilla tipo="dueno" />}>
          <Route index element={<Hija />} />
        </Route>
      </Routes>,
      '/dueno',
    );
    const selector = await screen.findByLabelText('Tienda');
    await waitFor(() => expect(screen.getByText('Inicio')).toBeInTheDocument());
    const antes = montajes;
    await userEvent.selectOptions(selector, '5');
    await waitFor(() => expect(montajes).toBe(antes + 1));
  });
});

describe('A03', () => {
  const TIENDA = {
    id: '2',
    ruc: '20999000001',
    razonSocial: 'S',
    nombreComercial: 'Peluquería Estilo',
    giro: 'Peluquería',
    telefono: null,
    direccion: null,
    cokTea: '0.200000000',
    estado: 'INACTIVO',
    duenio: { id: '4', username: 'e', nombres: 'Elena', estado: 'INACTIVO' },
  };

  it('INACTIVO se ve como BAJA', async () => {
    apiFalsa([{ ruta: /tiendas/, cuerpo: { items: [TIENDA], total: 1 } }]);
    montar(<A03Tiendas />);
    expect(await screen.findByText('BAJA')).toBeInTheDocument();
    expect(screen.queryByText('INACTIVO')).not.toBeInTheDocument();
  });

  it('el alta vacía muestra todos los errores a la vez, también el del dueño', async () => {
    const llamadas = apiFalsa([{ ruta: /tiendas/, cuerpo: { items: [], total: 0 } }]);
    montar(<A03Tiendas />);
    await screen.findByLabelText('COK de la tienda (TEA, %)');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('El RUC debe tener 11 dígitos.')).toBeInTheDocument();
    expect(screen.getByText('Escribe la razón social.')).toBeInTheDocument();
    expect(screen.getByText('Escribe el nombre comercial.')).toBeInTheDocument();
    expect(screen.getByText('Escribe el giro.')).toBeInTheDocument();
    expect(screen.getByText('Escribe el usuario del dueño.')).toBeInTheDocument();
    expect(envios(llamadas)).toHaveLength(0);
  });

  it('una clave temporal corta se avisa junto con los demás errores', async () => {
    apiFalsa([{ ruta: /tiendas/, cuerpo: { items: [], total: 0 } }]);
    montar(<A03Tiendas />);
    await userEvent.type(await screen.findByLabelText('Clave temporal'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('La clave temporal debe tener 8 caracteres o más.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Escribe el usuario del dueño.')).toBeInTheDocument();
  });

  it('el RUC repetido sale debajo de su campo; el COK vacío da mensaje y no falla en silencio', async () => {
    const llamadas = apiFalsa([
      { ruta: /tiendas/, cuerpo: { items: [], total: 0 } },
      {
        metodo: 'POST',
        ruta: /tiendas/,
        estado: 409,
        cuerpo: { codigo: 'RUC_DUPLICADO', mensaje: 'Ya existe una tienda con ese RUC.' },
      },
    ]);
    montar(<A03Tiendas />);
    const cok = await screen.findByLabelText('COK de la tienda (TEA, %)');
    await userEvent.clear(cok);
    await userEvent.type(screen.getByLabelText('RUC'), '20999000001');
    await userEvent.type(screen.getByLabelText('Razón social'), 'X');
    await userEvent.type(screen.getByLabelText('Nombre comercial'), 'X');
    await userEvent.type(screen.getByLabelText('Giro'), 'X');
    await userEvent.type(screen.getByLabelText('Usuario del dueño'), 'x@y.z');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/Escribe el COK en porcentaje/)).toBeInTheDocument();
    expect(envios(llamadas)).toHaveLength(0);
    await userEvent.type(cok, '20');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    const error = await screen.findByText('Ya existe una tienda con ese RUC.');
    expect(error.closest('div')).toContainElement(screen.getByLabelText('RUC'));
    expect(envios(llamadas)[0].cuerpo).toMatchObject({ cokTea: '0.2' });
  });
});

describe('A04', () => {
  const USUARIO = {
    id: '5',
    username: 'c',
    nombres: 'Carlos',
    perfil: 'DUENO',
    tienda: null,
    tiendas: [],
    ultimoAcceso: null,
    estado: 'ACTIVO',
  };

  it('Enter en el modal restablece la clave y no guarda el formulario de edición', async () => {
    const llamadas = apiFalsa([
      { ruta: /usuarios/, cuerpo: { items: [USUARIO], total: 1 } },
      { ruta: /tiendas/, cuerpo: { items: [], total: 0 } },
      { metodo: 'POST', ruta: /restablecer-clave/, cuerpo: {} },
    ]);
    montar(<A04Usuarios />);
    await userEvent.click(await screen.findByRole('button', { name: 'Carlos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer clave' }));
    const clave = screen.getAllByLabelText('Clave temporal').at(-1) as HTMLElement;
    await userEvent.type(clave, 'Nueva#2026{Enter}');
    await waitFor(() => expect(envios(llamadas)).toHaveLength(1));
    expect(envios(llamadas)[0]).toMatchObject({
      metodo: 'POST',
      cuerpo: { claveTemporal: 'Nueva#2026' },
    });
  });

  it('Guardar sin cambios no llama a la API', async () => {
    const llamadas = apiFalsa([
      { ruta: /usuarios/, cuerpo: { items: [USUARIO], total: 1 } },
      { ruta: /tiendas/, cuerpo: { items: [], total: 0 } },
    ]);
    montar(<A04Usuarios />);
    await userEvent.click(await screen.findByRole('button', { name: 'Carlos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('No hay cambios que guardar.')).toBeInTheDocument();
    expect(envios(llamadas)).toHaveLength(0);
  });
});

describe('A05', () => {
  const rutas: Ruta[] = [
    { ruta: /auditoria/, cuerpo: { items: [], total: 0 } },
    { ruta: /tiendas/, cuerpo: { items: [{ id: '7', nombreComercial: 'Bodega' }], total: 1 } },
    { ruta: /usuarios/, cuerpo: { items: [], total: 0 } },
  ];

  it('el filtro de tienda llega desde el enlace de A03', async () => {
    const llamadas = apiFalsa(rutas);
    montar(
      <Routes>
        <Route path="/admin/auditoria" element={<A05Auditoria />} />
      </Routes>,
      '/admin/auditoria?tiendaId=7',
    );
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.ruta.includes('/auditoria') && l.ruta.includes('tiendaId=7')),
      ).toBe(true),
    );
  });

  it('con la fecha inicial posterior a la final avisa y no consulta', async () => {
    const llamadas = apiFalsa(rutas);
    montar(<A05Auditoria />);
    await userEvent.type(await screen.findByLabelText('Fecha inicial'), '2026-09-20');
    const consultas = llamadas.filter((l) => l.ruta.includes('/auditoria')).length;
    await userEvent.type(screen.getByLabelText('Fecha final'), '2026-09-10');
    expect(
      await screen.findByText('La fecha inicial no puede ser posterior a la final.'),
    ).toBeInTheDocument();
    const despues = llamadas.filter(
      (l) => l.ruta.includes('/auditoria') && l.ruta.includes('hasta=2026-09-10'),
    );
    expect(despues).toHaveLength(0);
    expect(consultas).toBeGreaterThan(0);
  });
});

describe('D02', () => {
  const PRODUCTO = {
    id: '1',
    codigo: 'P001',
    nombre: 'Pollo',
    marca: 'M',
    descripcion: null,
    unidad: 'KG',
    proveedor: null,
    imagenUrl: null,
    precioContado: '8.50',
    precioLista: '9.00',
    permiteFinMes: true,
    permiteCuotas: false,
    estado: 'ACTIVO',
  };
  const rutas = (extra: Ruta[] = []): Ruta[] => [
    { ruta: /productos/, cuerpo: { items: [PRODUCTO], total: 1 } },
    ...extra,
  ];

  it('el PATCH lleva solo lo que cambió; "" vacía una columna opcional', async () => {
    const llamadas = apiFalsa(rutas([{ metodo: 'PATCH', ruta: /productos\/1/, cuerpo: PRODUCTO }]));
    montar(<D02Productos />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pollo' }));
    await userEvent.clear(screen.getByLabelText('Marca'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(envios(llamadas)).toHaveLength(1));
    expect(envios(llamadas)[0].cuerpo).toEqual({ marca: '' });
  });

  it('precio vacío o no numérico muestra el mensaje, sin llamar a la API', async () => {
    const llamadas = apiFalsa(rutas());
    montar(<D02Productos />);
    await screen.findByRole('button', { name: 'Pollo' });
    await userEvent.type(screen.getByLabelText('Código'), 'X1');
    await userEvent.type(screen.getByLabelText('Nombre'), 'X');
    await userEvent.type(screen.getByLabelText('Precio contado (S/)'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      (
        await screen.findAllByText(
          'Escribe el precio solo con números y hasta 2 decimales. Ejemplo: 25.50.',
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(envios(llamadas)).toHaveLength(0);
  });

  it('precio vacío dice "Escribe el precio", no una regla de decimales', async () => {
    const llamadas = apiFalsa(rutas());
    montar(<D02Productos />);
    await screen.findByRole('button', { name: 'Pollo' });
    await userEvent.type(screen.getByLabelText('Código'), 'X1');
    await userEvent.type(screen.getByLabelText('Nombre'), 'X');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Escribe el precio contado.')).toBeInTheDocument();
    expect(screen.getByText('Escribe el precio de lista.')).toBeInTheDocument();
    expect(envios(llamadas)).toHaveLength(0);
  });

  it('precio de lista menor que el contado: explica la regla', async () => {
    apiFalsa(rutas());
    montar(<D02Productos />);
    await screen.findByRole('button', { name: 'Pollo' });
    await userEvent.type(screen.getByLabelText('Código'), 'X1');
    await userEvent.type(screen.getByLabelText('Nombre'), 'X');
    await userEvent.type(screen.getByLabelText('Precio contado (S/)'), '10');
    await userEvent.type(screen.getByLabelText('Precio de lista (S/)'), '9');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('El precio de lista debe ser mayor o igual que el precio contado.'),
    ).toBeInTheDocument();
  });
});

describe('D03', () => {
  const LUIS = {
    id: '1',
    dni: '45872316',
    nombres: 'Luis',
    apellidos: 'Quispe',
    celular: null,
    direccion: null,
    moneda: 'PEN',
    limiteCredito: '500.00',
    maxMeses: 3,
    diaCorte: 20,
    horaCorte: '17:00:00',
    diaPago: 26,
    tipoTasa: 'EFECTIVA',
    valorTasa: '0.450000000',
    plazoTasa: 360,
    capitalizacion: null,
    tipoTasaMora: 'EFECTIVA',
    valorTasaMora: '0.100000000',
    ted: '0.001032653810255',
    tedMora: '0.000264785548963',
    activado: true,
    estado: 'ACTIVO',
    su: '244.92',
    disponible: '255.08',
    usoPorcentaje: '49.0',
  };
  const abrir = (cliente: object, extra: Ruta[] = []) => {
    const llamadas = apiFalsa([
      { ruta: /clientes\/1$/, cuerpo: cliente },
      {
        metodo: 'POST',
        ruta: /calcular-tasas/,
        cuerpo: { ted: '0.001032653810255', tem: '0.03', tea: '0.45' },
      },
      { metodo: 'PATCH', ruta: /clientes\/1$/, cuerpo: cliente },
      ...extra,
    ]);
    montar(
      <Routes>
        <Route path="/dueno/clientes/:id" element={<D03Ficha />} />
      </Routes>,
      '/dueno/clientes/1',
    );
    return llamadas;
  };

  it('con deuda: condiciones bloqueadas con el motivo; cambiar el límite envía solo el límite', async () => {
    const llamadas = abrir(LUIS);
    expect(
      await screen.findByText(/No se pueden cambiar tasas, moneda ni días/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Valor de la tasa (%)')).toBeDisabled();
    expect(screen.getByLabelText('Día de corte')).toBeDisabled();
    const limite = screen.getByLabelText('Límite de crédito');
    expect(limite).toBeEnabled();
    await userEvent.clear(limite);
    await userEvent.type(limite, '600.00');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(envios(llamadas).filter((l) => l.metodo === 'PATCH')).toHaveLength(1),
    );
    expect(envios(llamadas).find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({
      limiteCredito: '600.00',
    });
  });

  it('sin deuda: cambiar la mora exige indicar su plazo, que nunca se asume', async () => {
    const llamadas = abrir({ ...LUIS, su: '0.00' });
    const mora = await screen.findByLabelText('Tasa moratoria (%)');
    await userEvent.clear(mora);
    await userEvent.type(mora, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('Indica el plazo de la tasa moratoria que estás cambiando.'),
    ).toBeInTheDocument();
    expect(llamadas.filter((l) => l.metodo === 'PATCH')).toHaveLength(0);
    await userEvent.selectOptions(screen.getByLabelText('Plazo de la mora'), '360');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(llamadas.filter((l) => l.metodo === 'PATCH')).toHaveLength(1));
    expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({
      tasaMora: { tipo: 'EFECTIVA', valor: '0.12', plazo: 360 },
    });
  });

  it('una tasa no enviada si no cambió, y un límite vacío da mensaje', async () => {
    const llamadas = abrir({ ...LUIS, su: '0.00' });
    const limite = await screen.findByLabelText('Límite de crédito');
    await userEvent.clear(limite);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Escribe el límite de crédito.')).toBeInTheDocument();
    expect(llamadas.filter((l) => l.metodo === 'PATCH')).toHaveLength(0);
    // Un límite negativo se explica con la regla que no cumple, no con "decimales".
    await userEvent.type(limite, '-100');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText(
        'Escribe el límite solo con números y hasta 2 decimales, sin signo. Ejemplo: 500.00.',
      ),
    ).toBeInTheDocument();
    await userEvent.clear(limite);
    await userEvent.type(limite, '700.00');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(llamadas.filter((l) => l.metodo === 'PATCH')).toHaveLength(1));
    expect(llamadas.find((l) => l.metodo === 'PATCH')?.cuerpo).toEqual({ limiteCredito: '700.00' });
  });
});

describe('D03 alta de cliente', () => {
  // calcular-tasas es la vista previa de las tasas, no un guardado.
  const guardados = (l: { metodo: string; ruta: string }[]) =>
    envios(l).filter((x) => !x.ruta.includes('calcular-tasas'));

  async function abrirAlta() {
    const llamadas = apiFalsa([{ ruta: /clientes/, cuerpo: { items: [], total: 0 } }]);
    montar(<D03Lista />);
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente' }));
    await screen.findByLabelText('DNI');
    return llamadas;
  }

  it('el consentimiento se exige junto con los demás campos, no después', async () => {
    const llamadas = await abrirAlta();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('El DNI debe tener 8 dígitos.')).toBeInTheDocument();
    expect(screen.getByText('Escribe los nombres.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Debe constar que el cliente aceptó el tratamiento de sus datos personales.',
      ),
    ).toBeInTheDocument();
    expect(guardados(llamadas)).toHaveLength(0);
  });

  it('un celular de 2 dígitos se rechaza con la regla; vacío sí se admite', async () => {
    const llamadas = await abrirAlta();
    await userEvent.type(screen.getByLabelText('DNI'), '70123456');
    await userEvent.type(screen.getByLabelText('Nombres'), 'Pedro');
    await userEvent.type(screen.getByLabelText('Apellidos'), 'Ruiz');
    await userEvent.type(screen.getByLabelText('Celular'), '12');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText(
        'El celular debe tener entre 9 y 15 dígitos, sin espacios ni signos.',
      ),
    ).toBeInTheDocument();
    expect(guardados(llamadas)).toHaveLength(0);
  });
});

describe('D04', () => {
  const LUIS = { id: '1', nombres: 'Luis', apellidos: 'Quispe', moneda: 'PEN', maxMeses: 3 };
  const P = {
    id: '3',
    codigo: 'P003',
    nombre: 'Aceite',
    precioLista: '10.00',
    precioContado: '9.50',
    permiteFinMes: true,
    permiteCuotas: false,
  };
  const SIM = {
    lineas: [
      {
        productoId: '3',
        codigo: 'P003',
        nombre: 'Aceite',
        cantidad: '1.000',
        precioLista: '10.00',
        precioContado: '9.50',
        subtotal: '10.00',
        subtotalContado: '9.50',
      },
    ],
    montoLista: '10.00',
    montoContado: '9.50',
    fechaOperativa: '2026-09-22',
    fechaCorte: '2026-10-20',
    fechaPago: '2026-10-26',
    limite: {
      aceptada: true,
      disponible: '255.08',
      limite: '500.00',
      su: '244.92',
      usoActualPorcentaje: '49.0',
      usoConCompraPorcentaje: '51.0',
    },
    finMes: { dias: 34, interes: '0.36', total: '10.36' },
  };

  it('muestra el precio contado; con una simulación vieja Confirmar se apaga', async () => {
    apiFalsa([
      { ruta: /clientes/, cuerpo: { items: [LUIS], total: 1 } },
      { ruta: /productos/, cuerpo: { items: [P], total: 1 } },
      { metodo: 'POST', ruta: /compras\/simular/, cuerpo: SIM },
    ]);
    montar(<D04NuevaCompra />);
    await userEvent.selectOptions(await screen.findByLabelText('Cliente'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Producto'), '3');
    expect(await screen.findByText(/Contado S\/ 9.50/)).toBeInTheDocument();
    const confirmar = screen.getByRole('button', { name: 'Confirmar compra' });
    await waitFor(() => expect(confirmar).toBeEnabled(), { timeout: 2000 });
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } });
    expect(confirmar).toBeDisabled();
  });

  it('el rechazo anterior desaparece al cambiar la compra; una simulación fallida no deja cifras ni Confirmar', async () => {
    const llamadas = apiFalsa([
      { ruta: /clientes/, cuerpo: { items: [LUIS], total: 1 } },
      { ruta: /productos/, cuerpo: { items: [P], total: 1 } },
      { metodo: 'POST', ruta: /compras\/simular/, cuerpo: SIM },
      {
        metodo: 'POST',
        ruta: /compras$/,
        estado: 422,
        cuerpo: { codigo: 'LIMITE_EXCEDIDO', mensaje: 'Compra rechazada de prueba.' },
      },
    ]);
    montar(<D04NuevaCompra />);
    await userEvent.selectOptions(await screen.findByLabelText('Cliente'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Producto'), '3');
    const confirmar = screen.getByRole('button', { name: 'Confirmar compra' });
    await waitFor(() => expect(confirmar).toBeEnabled(), { timeout: 2000 });
    await userEvent.click(confirmar);
    expect(await screen.findByText(/Compra rechazada de prueba/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } });
    await waitFor(() =>
      expect(screen.queryByText(/Compra rechazada de prueba/)).not.toBeInTheDocument(),
    );
    expect(llamadas.filter((l) => l.ruta.endsWith('/compras'))).toHaveLength(1);
  });

  it('dos clics seguidos registran una sola compra', async () => {
    const llamadas = apiFalsa([
      { ruta: /clientes/, cuerpo: { items: [LUIS], total: 1 } },
      { ruta: /productos/, cuerpo: { items: [P], total: 1 } },
      { metodo: 'POST', ruta: /compras\/simular/, cuerpo: SIM },
      {
        metodo: 'POST',
        ruta: /compras$/,
        estado: 201,
        cuerpo: { id: '9', ticket: 'T-000302', modalidad: 'FIN_MES', fechaPago: '2026-10-26' },
      },
    ]);
    montar(<D04NuevaCompra />);
    await userEvent.selectOptions(await screen.findByLabelText('Cliente'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Producto'), '3');
    const confirmar = screen.getByRole('button', { name: 'Confirmar compra' });
    await waitFor(() => expect(confirmar).toBeEnabled(), { timeout: 2000 });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    expect(
      await screen.findByText(/ticket T-000302, fecha de pago 26\/10\/2026/),
    ).toBeInTheDocument();
    expect(llamadas.filter((l) => l.metodo === 'POST' && l.ruta.endsWith('/compras'))).toHaveLength(
      1,
    );
  });
});
