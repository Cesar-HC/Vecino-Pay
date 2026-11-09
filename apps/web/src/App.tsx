import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ErrorApi } from './api/cliente';
import { Inicio } from './pantallas/comun/Landing';
import Ingreso from './pantallas/comun/Ingreso';
import A03Tiendas from './pantallas/admin/A03Tiendas';
import A04Usuarios from './pantallas/admin/A04Usuarios';
import A05Auditoria from './pantallas/admin/A05Auditoria';
import D02Productos from './pantallas/dueno/D02Productos';
import { D03Ficha, D03Lista } from './pantallas/dueno/D03Clientes';
import D04NuevaCompra from './pantallas/dueno/D04NuevaCompra';
import { D05Detalle, D05Lista } from './pantallas/dueno/D05Cronograma';
import { D06Detalle, D06Lista } from './pantallas/dueno/D06Listado';
import { D07Lista, D07Pago } from './pantallas/dueno/D07Pago';
import D08Ayuda from './pantallas/dueno/D08Ayuda';
import C02Activar from './pantallas/cliente/C02Activar';
import C03InicioCliente from './pantallas/cliente/C03InicioCliente';
import C04MenuCliente from './pantallas/cliente/C04MenuCliente';
import C05MiListado from './pantallas/cliente/C05MiListado';
import C06MisCuotas from './pantallas/cliente/C06MisCuotas';
import C07MisPagos from './pantallas/cliente/C07MisPagos';
import C08MiPerfil from './pantallas/cliente/C08MiPerfil';
import C09AyudaCliente from './pantallas/cliente/C09AyudaCliente';
import { Plantilla } from './plantillas/Plantilla';
import { PlantillaCliente } from './plantillas/PlantillaCliente';
import { Guarda, ProveedorSesion } from './sesion/Sesion';
import { Cargando, Vacio } from './ui/base';
import { FronteraError } from './ui/Fronteras';

// Recharts pesa: solo se carga en las pantallas con gráficos.
const A02Resumen = lazy(() => import('./pantallas/admin/A02Resumen'));
const D01Resumen = lazy(() => import('./pantallas/dueno/D01Resumen'));

const consultas = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, e) => !(e instanceof ErrorApi && e.estado >= 400 && e.estado < 500) && n < 2,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={consultas}>
      <BrowserRouter>
        <ProveedorSesion>
          <FronteraError>
            <Suspense fallback={<Cargando />}>
              <Routes>
                <Route path="/" element={<Inicio />} />
                <Route path="/login" element={<Ingreso key="comercio" modoInicial="comercio" />} />
                <Route
                  path="/m/login"
                  element={<Ingreso key="cliente-m" modoInicial="cliente" />}
                />
                <Route
                  path="/ingresar"
                  element={<Ingreso key="cliente-i" modoInicial="cliente" />}
                />
                <Route path="/m/activar" element={<C02Activar />} />
                <Route
                  path="/admin"
                  element={
                    <Guarda perfil="ADMIN_SISTEMA">
                      <Plantilla tipo="admin" />
                    </Guarda>
                  }
                >
                  <Route index element={<A02Resumen />} />
                  <Route path="tiendas" element={<A03Tiendas />} />
                  <Route path="usuarios" element={<A04Usuarios />} />
                  <Route path="auditoria" element={<A05Auditoria />} />
                </Route>
                <Route
                  path="/dueno"
                  element={
                    <Guarda perfil="DUENO">
                      <Plantilla tipo="dueno" />
                    </Guarda>
                  }
                >
                  <Route index element={<D01Resumen />} />
                  <Route path="compras/nueva" element={<D04NuevaCompra />} />
                  <Route path="clientes" element={<D03Lista />} />
                  <Route path="clientes/:id" element={<D03Ficha />} />
                  <Route path="listados" element={<D06Lista />} />
                  <Route path="listados/:id" element={<D06Detalle />} />
                  <Route path="pagos" element={<D07Lista />} />
                  <Route path="listados/:id/pago" element={<D07Pago />} />
                  <Route path="cronogramas" element={<D05Lista />} />
                  <Route path="cronogramas/:compraId" element={<D05Detalle />} />
                  <Route path="productos" element={<D02Productos />} />
                  <Route path="ayuda" element={<D08Ayuda />} />
                  <Route path="ayuda/:tema" element={<D08Ayuda />} />
                </Route>
                <Route
                  path="/m"
                  element={
                    <Guarda perfil="CLIENTE" login="/m/login">
                      <PlantillaCliente />
                    </Guarda>
                  }
                >
                  <Route index element={<C03InicioCliente />} />
                  <Route path="menu" element={<C04MenuCliente />} />
                  <Route path="listado" element={<C05MiListado />} />
                  <Route path="cuotas" element={<C06MisCuotas />} />
                  <Route path="pagos" element={<C07MisPagos />} />
                  <Route path="perfil" element={<C08MiPerfil />} />
                  <Route path="ayuda" element={<C09AyudaCliente />} />
                </Route>
                <Route path="*" element={<Vacio texto="Esta página no existe." />} />
              </Routes>
            </Suspense>
          </FronteraError>
        </ProveedorSesion>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
