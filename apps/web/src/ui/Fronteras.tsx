import { Component, ReactNode } from 'react';
import { Boton, Franja } from './base';

/** Un fallo al mostrar (por ejemplo, un monto mal formado) se ve como mensaje, no como pantalla en blanco. */
export class FronteraError extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div className="space-y-2 p-4">
        <Franja tipo="error">No se pudo mostrar esta pantalla.</Franja>
        <Boton variante="secundario" onClick={() => location.reload()}>
          Recargar
        </Boton>
      </div>
    );
  }
}
