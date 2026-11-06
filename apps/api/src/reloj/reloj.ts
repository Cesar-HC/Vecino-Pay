export const RELOJ = Symbol('RELOJ');

/** Única fuente de la hora de una operación. No existe ruta que la cambie. */
export interface Reloj {
  ahora(): Date;
  readonly fijo: boolean;
}

export class RelojSistema implements Reloj {
  readonly fijo = false;
  ahora(): Date {
    return new Date();
  }
}

export class RelojFijo implements Reloj {
  readonly fijo = true;
  private readonly instante: Date;
  constructor(iso: string) {
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(iso) || Number.isNaN(Date.parse(iso))) {
      throw new Error('RELOJ_FIJO debe ser ISO 8601 con desplazamiento.');
    }
    this.instante = new Date(iso);
  }
  ahora(): Date {
    return new Date(this.instante);
  }
}
