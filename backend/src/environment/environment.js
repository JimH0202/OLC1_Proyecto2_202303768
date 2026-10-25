import { InfrastructureResource } from '../infrastructure/resource.js';

export class RuntimeEnvironmentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RuntimeEnvironmentError';
  }
}

export class Environment {
  constructor(parent = null, state = null, scopeName = 'global') {
    if (parent !== null && !(parent instanceof Environment)) {
      throw new TypeError('El ámbito padre debe ser un Environment o null.');
    }

    this.parent = parent;
    this.variables = new Map();
    this.state = state ?? {
      resources: new Map(),
      symbols: [],
    };
    this.scope = parent ? `${parent.scope}/${scopeName}` : scopeName;
  }

  createChild(scopeName = 'block') {
    return new Environment(this, this.state, scopeName);
  }

  defineVariable(name, value, { category = 'variable', type = null } = {}) {
    this.variables.set(name, value);
    const symbol = [...this.state.symbols]
      .reverse()
      .find((entry) => entry.scope === this.scope
        && entry.identifier === name
        && entry.category === category);
    if (symbol) {
      symbol.category = category;
      symbol.type = type;
      symbol.value = value;
    } else {
      this.recordSymbol(name, category, type, value);
    }
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
      const symbol = [...this.state.symbols]
        .reverse()
        .find((entry) => entry.scope === this.scope
          && entry.identifier === name
          && (entry.category === 'variable' || entry.category === 'parameter'));
      if (symbol) {
        symbol.value = value;
      }
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
    this.recordSymbol(name, 'resource', kind, resource);
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

  recordSymbol(identifier, category, type, value) {
    this.state.symbols.push({
      identifier,
      category,
      type,
      scope: this.scope,
      value,
    });
  }

  listSymbols() {
    return this.state.symbols.map(({
      identifier,
      category,
      type,
      scope,
      value,
    }) => ({
      identifier,
      category,
      type,
      scope,
      value: serializeSymbolValue(value),
    }));
  }
}

function serializeSymbolValue(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(serializeSymbolValue);
  }
  if (typeof value.kind === 'string' && typeof value.name === 'string'
    && value.properties !== null && typeof value.properties === 'object') {
    return {
      kind: value.kind,
      name: value.name,
      status: value.state?.status,
      properties: serializeSymbolValue(value.properties),
    };
  }
  if (typeof value.toJSON === 'function') {
    return serializeSymbolValue(value.toJSON());
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, serializeSymbolValue(item)]),
  );
}
