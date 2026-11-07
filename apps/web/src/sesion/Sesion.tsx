import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../api/api';
import { almacen, avisarSesionExpirada, ErrorApi } from '../api/cliente';
import type { Perfil, Sesion } from '../api/tipos';

interface ValorSesion {
  sesion: Sesion | null;
  cargando: boolean;
  aviso: string | null;
  entrar(datos: { username: string; password: string; perfil: string }): Promise<Sesion>;
  salir(): void;
  cambiarTienda(id: string): Promise<void>;
}

const Contexto = createContext<ValorSesion | null>(null);

export const inicioDe = (perfil: Perfil) =>
  perfil === 'ADMIN_SISTEMA' ? '/admin' : perfil === 'DUENO' ? '/dueno' : '/m';

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const cliente = useQueryClient();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(() => almacen.leer() !== null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Manda la API: nada del perfil se lee del token ni se guarda aparte.
  useEffect(() => {
    if (!almacen.leer()) return;
    api
      .yo()
      .then(setSesion)
      .catch((e) => {
        // Con 401 ya se avisó que la sesión terminó; un fallo pasajero conserva el token.
        if (!(e instanceof ErrorApi && e.estado === 401)) {
          setAviso('No se pudo conectar con el servidor. Recarga la página en un momento.');
        }
      })
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    avisarSesionExpirada(() => {
      setSesion(null);
      setAviso('Tu sesión terminó. Inicia sesión de nuevo.');
      cliente.clear();
    });
  }, [cliente]);

  const entrar = useCallback<ValorSesion['entrar']>(
    async (datos) => {
      const { token, ...resto } = await api.login(datos);
      almacen.guardar(token);
      cliente.clear();
      setAviso(null);
      setSesion(resto);
      return resto;
    },
    [cliente],
  );

  const salir = useCallback(() => {
    almacen.borrar();
    cliente.clear();
    setSesion(null);
  }, [cliente]);

  const cambiarTienda = useCallback(
    async (id: string) => {
      const { token, tienda } = await api.cambiarTienda(id);
      almacen.guardar(token);
      // Sin datos de la tienda anterior en la caché.
      cliente.clear();
      setSesion((s) => (s ? { ...s, tienda } : s));
    },
    [cliente],
  );

  const valor = useMemo(
    () => ({ sesion, cargando, aviso, entrar, salir, cambiarTienda }),
    [sesion, cargando, aviso, entrar, salir, cambiarTienda],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const v = useContext(Contexto);
  if (!v) throw new Error('useSesion fuera de ProveedorSesion');
  return v;
}

/** Es comodidad: la seguridad sigue en la API. */
export function Guarda({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  const { sesion, cargando } = useSesion();
  const ubicacion = useLocation();
  if (cargando) return <p className="p-6 text-gray-500">Cargando…</p>;
  if (!sesion) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  if (sesion.usuario.perfil !== perfil)
    return <Navigate to={inicioDe(sesion.usuario.perfil)} replace />;
  return <>{children}</>;
}
