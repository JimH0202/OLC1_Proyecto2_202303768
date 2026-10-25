export const RESOURCE_KINDS = Object.freeze([
  'server',
  'service',
  'database',
]);

const resourceKinds = new Set(RESOURCE_KINDS);

export class InfrastructureResource {
  constructor({ kind, name, properties }) {
    if (!resourceKinds.has(kind)) {
      throw new TypeError(`Tipo de recurso no soportado: ${kind}.`);
    }
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('El recurso requiere un nombre no vacío.');
    }
    if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) {
      throw new TypeError('Las propiedades del recurso deben ser un objeto.');
    }

    this.kind = kind;
    this.name = name;
    this.properties = { ...properties };
    this.state = {
      status: 'stopped',
    };
  }

  toJSON() {
    return {
      kind: this.kind,
      name: this.name,
      properties: { ...this.properties },
      state: { ...this.state },
    };
  }
}
