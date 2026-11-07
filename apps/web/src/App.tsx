import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorApi } from './api/cliente';
import A01Login from './pantallas/admin/A01Login';
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
import { Plantilla } from './plantillas/Plantilla';
import { Guarda, inicioDe, ProveedorSesion, useSesion } from './sesion/Sesion';
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

function Inicio() {
  const { sesion, cargando } = useSesion();
  if (cargando) return <Cargando />;
  return <Navigate to={sesion ? inicioDe(sesion.usuario.perfil) : '/login'} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={consultas}>
      <BrowserRouter>
        <ProveedorSesion>
          <FronteraError>
            <Suspense fallback={<Cargando />}>
              <Routes>
                <Route path="/" element={<Inicio />} />
                <Route path="/login" element={<A01Login />} />
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
                  path="/m/*"
                  element={
                    <Vacio texto="La vista móvil del cliente estará disponible en la fase 5." />
                  }
                />
                <Route path="*" element={<Vacio texto="Esta página no existe." />} />
              </Routes>
            </Suspense>
          </FronteraError>
        </ProveedorSesion>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
