import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../api/api';
import { formatearMonto, formatearTasaDiaria } from '../../lib/formato';
import { Cargando, PanelError, Titulo } from '../../ui/base';
import { ErrorApi } from '../../api/cliente';

export default function C09AyudaCliente() {
  const [temaAbierto, setTemaAbierto] = useState<string | null>('corte');

  const {
    data: ej,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['mi-ejemplo'],
    queryFn: api.miEjemplo,
  });

  const alternar = (t: string) => {
    setTemaAbierto((actual) => (actual === t ? null : t));
  };

  return (
    <div className="space-y-4">
      <Titulo>Ayuda y educación financiera</Titulo>

      {/* Tarjeta principal: Cómo se calcula el interés de una compra */}
      <section className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-vecino-oscuro">
          Interés de tus compras a fin de mes
        </h2>
        <p className="mt-1 text-xs text-gray-600 leading-relaxed">
          Tu interés crece con los días reales del calendario: cada día se suma a lo que debes.
        </p>

        {/* Fórmula matemática */}
        <div className="my-4 rounded-xl bg-gray-50 p-4 text-center border border-gray-100">
          <div className="font-mono text-base font-bold text-vecino-primario">
            I = P × [(1 + TED)<sup>d</sup> - 1]
          </div>
          <div className="mt-1 text-xs text-gray-400">Total a pagar = P + I</div>
        </div>

        {/* Glosario de la fórmula */}
        <div className="space-y-2 text-xs text-gray-600 border-t border-gray-100 pt-3">
          <div className="flex gap-2">
            <span className="font-mono font-bold text-vecino-oscuro w-10 flex-none">P:</span>
            <span>
              <strong>Capital inicial:</strong> El importe de tu compra según el precio de lista.
            </span>
          </div>
          <div className="flex gap-2">
            <span className="font-mono font-bold text-vecino-oscuro w-10 flex-none">TED:</span>
            <span>
              <strong>Tasa Efectiva Diaria:</strong> Calculada a partir de la tasa pactada con tu
              tienda dividida en base 360 días.
            </span>
          </div>
          <div className="flex gap-2">
            <span className="font-mono font-bold text-vecino-oscuro w-10 flex-none">d:</span>
            <span>
              <strong>Días de financiamiento:</strong> Días exactos entre la fecha operativa de tu
              compra y la fecha límite de pago.
            </span>
          </div>
        </div>
      </section>

      {/* Ejemplo real con una compra del cliente */}
      <section className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-emerald-950">
        <div className="flex items-center gap-2 font-bold text-emerald-900 mb-2">
          <span aria-hidden="true">📊</span>
          <h2 className="text-sm">Ejemplo con una compra real de tu cuenta</h2>
        </div>

        {isLoading && <Cargando />}
        {error instanceof ErrorApi && error.estado === 404 && (
          <p className="text-xs text-emerald-800">
            Aún no tienes compras para mostrar un ejemplo personalizado.
          </p>
        )}
        {error && !(error instanceof ErrorApi && error.estado === 404) && (
          <PanelError error={error} />
        )}

        {ej && (
          <div className="space-y-2 text-xs">
            <p className="text-emerald-900">
              Tomando como ejemplo tu compra con ticket <strong>{ej.ticket}</strong>:
            </p>
            <div className="rounded-xl bg-white/80 p-3.5 space-y-1.5 font-mono text-xs text-emerald-950 border border-emerald-200">
              <div className="flex justify-between">
                <span>Capital (P):</span>
                <span className="font-bold">{formatearMonto(ej.capital)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tasa Diaria (TED):</span>
                <span>{formatearTasaDiaria(ej.ted)}</span>
              </div>
              <div className="flex justify-between">
                <span>Días hasta el pago (d):</span>
                <span>{ej.dias} días</span>
              </div>
              <div className="flex justify-between">
                <span>Factor [(1+TED)ᵈ - 1]:</span>
                <span>{ej.factor}</span>
              </div>
              <div className="flex justify-between border-t border-emerald-200 pt-1 font-bold text-emerald-900">
                <span>Interés resultante (I):</span>
                <span>{formatearMonto(ej.interes)}</span>
              </div>
              <div className="flex justify-between font-bold text-vecino-oscuro">
                <span>Total a pagar (P + I):</span>
                <span>{formatearMonto(ej.total)}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Otros temas de interés */}
      <section className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 divide-y divide-gray-100">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Preguntas frecuentes
        </h2>

        {/* Corte 17:00 */}
        <div className="py-2.5">
          <button
            type="button"
            onClick={() => alternar('corte')}
            className="w-full flex items-center justify-between text-left text-xs font-bold text-gray-800"
          >
            <span>¿Qué es la hora de corte (17:00:00)?</span>
            <span className="text-gray-400">{temaAbierto === 'corte' ? '−' : '+'}</span>
          </button>
          {temaAbierto === 'corte' && (
            <p className="mt-2 text-xs text-gray-600 leading-relaxed">
              Las compras realizadas después de las 17:00:00 se consideran operativamente realizadas
              al día siguiente. Si compras el día del corte después de las 17:00:00, tu compra no
              entra en el cobro inmediato, sino que pasa al siguiente ciclo de pago: se cuenta desde
              el día siguiente al corte.
            </p>
          )}
        </div>

        {/* Mora */}
        <div className="py-2.5">
          <button
            type="button"
            onClick={() => alternar('mora')}
            className="w-full flex items-center justify-between text-left text-xs font-bold text-gray-800"
          >
            <span>¿Cómo funciona el interés moratorio?</span>
            <span className="text-gray-400">{temaAbierto === 'mora' ? '−' : '+'}</span>
          </button>
          {temaAbierto === 'mora' && (
            <p className="mt-2 text-xs text-gray-600 leading-relaxed">
              Si pagas después de tu fecha límite, se genera un cargo diario de interés moratorio
              por cada día de retraso. El sistema imputa tus pagos cancelando primero la mora, luego
              los intereses compensatorios y finalmente el capital.
            </p>
          )}
        </div>

        {/* Cuotas */}
        <div className="py-2.5">
          <button
            type="button"
            onClick={() => alternar('cuotas')}
            className="w-full flex items-center justify-between text-left text-xs font-bold text-gray-800"
          >
            <span>¿Cómo funcionan las compras en cuotas?</span>
            <span className="text-gray-400">{temaAbierto === 'cuotas' ? '−' : '+'}</span>
          </button>
          {temaAbierto === 'cuotas' && (
            <p className="mt-2 text-xs text-gray-600 leading-relaxed">
              En compras en cuotas, pagas una cuota fija mensual que amortiza capital y cubre
              intereses mediante el método francés. Si hay días entre tu compra y tu fecha de pago,
              esos días de gracia se suman a tu deuda para que las cuotas sean iguales. Con la TCEA
              ves cuánto te cuesta el crédito en un año.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
