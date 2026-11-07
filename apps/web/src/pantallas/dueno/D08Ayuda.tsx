import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { normalizar, TEMAS, textoDelTema } from '../../contenido/formulas';
import { claseEntrada, Tarjeta, Vacio } from '../../ui/base';

export default function D08Ayuda() {
  const { tema } = useParams();
  const [texto, setTexto] = useState('');
  const buscado = normalizar(texto.trim());
  const visibles = TEMAS.filter((t) => !buscado || normalizar(textoDelTema(t)).includes(buscado));
  const actual = TEMAS.find((t) => t.id === tema) ?? TEMAS[0];
  return (
    <>
      <h1 className="text-2xl font-bold text-vecino-oscuro">Ayuda y fórmulas</h1>
      <div className="grid gap-4 lg:grid-cols-4">
        <Tarjeta>
          <input
            aria-label="Buscar en la ayuda"
            placeholder="Buscar un tema"
            className={`${claseEntrada} mb-3`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          {!visibles.length && <Vacio texto="No hay temas con esa búsqueda." />}
          <nav className="space-y-1">
            {visibles.map((t) => (
              <NavLink
                key={t.id}
                to={`/dueno/ayuda/${t.id}`}
                className={() =>
                  `block rounded-lg px-3 py-2 text-sm ${t.id === actual.id ? 'bg-vecino/10 font-semibold text-vecino-oscuro' : 'hover:bg-gray-100'}`
                }
              >
                {t.titulo}
              </NavLink>
            ))}
          </nav>
        </Tarjeta>
        <Tarjeta titulo={actual.titulo} className="lg:col-span-3">
          <div className="space-y-3 text-sm text-gray-800">
            <p>{actual.explicacion}</p>
            {actual.formulas.length > 0 && (
              <div className="space-y-1">
                {actual.formulas.map((f) => (
                  <p key={f} className="overflow-x-auto rounded-lg bg-gray-100 px-3 py-2 font-mono">
                    {f}
                  </p>
                ))}
              </div>
            )}
            <div>
              <h3 className="mb-1 font-semibold text-vecino-oscuro">
                {actual.id === 'glosario' ? 'Términos' : 'Qué significa cada término'}
              </h3>
              <dl className="space-y-1">
                {actual.leyenda.map(([termino, definicion]) => (
                  <div key={termino}>
                    <dt className="inline font-semibold">{termino}: </dt>
                    <dd className="inline">{definicion}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {actual.caso && (
              <div className="rounded-lg border border-vecino/30 bg-vecino/5 p-3">
                <h3 className="mb-1 font-semibold text-vecino-oscuro">
                  Ejemplo: {actual.caso.titulo}
                </h3>
                <ol className="list-decimal space-y-1 pl-5">
                  {actual.caso.pasos.map((paso) => (
                    <li key={paso}>{paso}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
