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
      properties: serializeProperties(this.properties),
      state: serializeProperties(this.state),
    };
  }
}

function serializeProperties(properties) {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, serializeProperty(value)]),
  );
}

function serializeProperty(value) {
  if (Array.isArray(value)) {
    return value.map(serializeProperty);
  }
  if (value !== null && typeof value === 'object'
    && typeof value.kind === 'string'
    && typeof value.name === 'string'
    && value.properties !== null
    && typeof value.properties === 'object') {
    return { kind: value.kind, name: value.name };
  }
  return value;
}
