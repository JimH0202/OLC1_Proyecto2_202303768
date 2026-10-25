import { InfrastructureResource } from '../infrastructure/resource.js';

export class RuntimeEnvironmentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RuntimeEnvironmentError';
  }
}

export class Environment {
  constructor(parent = null, state = null) {
    if (parent !== null && !(parent instanceof Environment)) {
      throw new TypeError('El ámbito padre debe ser un Environment o null.');
    }

    this.parent = parent;
    this.variables = new Map();
    this.state = state ?? {
      resources: new Map(),
    };
  }

  createChild() {
    return new Environment(this, this.state);
  }

  defineVariable(name, value) {
    this.variables.set(name, value);
    return value;
  }

  getVariable(name) {
    if (this.variables.has(name)) {
      return this.variables.get(name);
    }
    if (this.parent) {
      return this.parent.getVariable(name);
    }
    throw new RuntimeEnvironmentError(`Variable no definida: ${name}.`);
  }

  assignVariable(name, value) {
    if (this.variables.has(name)) {
      this.variables.set(name, value);
      return value;
    }
    if (this.parent) {
      return this.parent.assignVariable(name, value);
    }
    throw new RuntimeEnvironmentError(`Variable no definida: ${name}.`);
  }

  defineResource({ kind, name, properties }) {
    if (!Array.isArray(properties)) {
      throw new TypeError('Las propiedades del recurso deben ser una lista.');
    }

    const resource = new InfrastructureResource({
      kind,
      name,
      properties: Object.fromEntries(properties.map(({ name: propertyName, value }) => [
        propertyName,
        value,
      ])),
    });
    this.state.resources.set(name, resource);
    return resource;
  }

  getResource(name) {
    const resource = this.state.resources.get(name);
    if (!resource) {
      throw new RuntimeEnvironmentError(`Recurso no definido: ${name}.`);
    }
    return resource;
  }

  listResources() {
    return [...this.state.resources.values()].map((resource) => resource.toJSON());
  }
}
