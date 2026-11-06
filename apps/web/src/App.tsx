import { useEffect, useState } from 'react';

interface Salud {
  estado: string;
  zonaHoraria: string;
  fechaLima: string;
  horaLima: string;
  horaCorte: string;
  fechaOperativa: string;
}

export default function App() {
  const [salud, setSalud] = useState<Salud | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/salud')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setSalud)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl bg-white shadow p-6">
        <h1 className="text-2xl font-bold text-vecino-oscuro">VecinoPay</h1>
        <p className="text-sm text-gray-500 mb-4">Fase 0: el sistema está levantado</p>
        {error && <p className="text-red-600">No responde la API: {error}</p>}
        {!salud && !error && <p className="text-gray-500">Consultando la API…</p>}
        {salud && (
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">Estado de la API</dt>
            <dd className="font-medium text-vecino">{salud.estado}</dd>
            <dt className="text-gray-500">Zona horaria</dt>
            <dd>{salud.zonaHoraria}</dd>
            <dt className="text-gray-500">Hora en Lima</dt>
            <dd>
              {salud.fechaLima} {salud.horaLima}
            </dd>
            <dt className="text-gray-500">Hora de corte</dt>
            <dd>{salud.horaCorte}</dd>
            <dt className="text-gray-500">Fecha operativa</dt>
            <dd className="font-medium">{salud.fechaOperativa}</dd>
          </dl>
        )}
      </section>
    </main>
  );
}
