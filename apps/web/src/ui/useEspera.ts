import { useEffect, useState } from 'react';

/** Devuelve el valor después de una pausa, para no consultar la API en cada tecla. */
export function useEspera<T>(valor: T, ms: number): T {
  const clave = JSON.stringify(valor);
  const [enEspera, setEnEspera] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setEnEspera(valor), ms);
    return () => clearTimeout(t);
    // El objeto cambia de identidad en cada render: manda su contenido.
  }, [clave, ms]);
  return enEspera;
}
