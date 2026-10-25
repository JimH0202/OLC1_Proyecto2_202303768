import { Environment, RuntimeEnvironmentError } from '../environment/environment.js';

const nativeFunctionNames = new Set([
  'start',
  'stop',
  'restart',
  'install',
  'uninstall',
  'deploy',
  'scale',
  'connect',
  'disconnect',
  'print',
  'length',
  'status',
]);

export class RuntimeExecutionError extends Error {
  constructor(message, node = null, { type = 'runtime', code } = {}) {
    super(message);
    this.name = 'RuntimeExecutionError';
    this.type = type;
    this.code = code;
    this.line = node?.line;
    this.column = node?.column;
  }

  toJSON() {
    return {
      type: this.type,
      message: this.message,
      ...(this.code === undefined ? {} : { code: this.code }),
      ...(this.line === undefined ? {} : { line: this.line }),
      ...(this.column === undefined ? {} : { column: this.column }),
    };
  }
}

class ReturnSignal {
  constructor(value) {
    this.value = value;
  }
}

class BreakSignal {}
class ContinueSignal {}

export class Interpreter {
  constructor(environment = new Environment()) {
    if (!(environment instanceof Environment)) {
      throw new TypeError('El intérprete requiere un Environment válido.');
    }

    this.environment = environment;
    this.globalEnvironment = environment;
    this.functions = new Map();
    this.tasks = new Map();
    this.console = [];
    this.log = [];
  }

  interpret(program) {
    if (program?.type !== 'Program') {
      throw new TypeError('El intérprete requiere un nodo raíz Program.');
    }

    this.console = [];
    this.log = [];
    try {
      this.registerCallableDeclarations(program.body);
      this.registerResources(program.body);
      for (const declaration of program.body) {
        if (declaration.type !== 'MainDeclaration'
          && declaration.type !== 'FunctionDeclaration'
          && declaration.type !== 'TaskDeclaration') {
          if (declaration.type === 'ResourceDeclaration') {
            this.initializeResource(declaration, this.environment);
          } else {
            this.executeDeclaration(declaration, this.environment);
          }
        }
      }

      const main = program.body.find(({ type }) => type === 'MainDeclaration');
      if (!main) {
        throw new RuntimeExecutionError('No se encontró el bloque main.', program);
      }

      this.executeStatement(main.body, this.environment.createChild('main'));
      return {
        success: true,
        console: [...this.console],
        log: [...this.log],
        errors: [],
        environment: this.environment,
        resources: this.environment.listResources(),
        symbols: this.environment.listSymbols(),
      };
    } catch (error) {
      if (error instanceof RuntimeExecutionError) {
        return {
          success: false,
          console: [...this.console],
          log: [...this.log],
          environment: this.environment,
          resources: this.environment.listResources(),
          symbols: this.environment.listSymbols(),
          errors: [error.toJSON()],
        };
      }
      if (error instanceof ReturnSignal || error instanceof BreakSignal
        || error instanceof ContinueSignal) {
        const message = error instanceof ReturnSignal
          ? 'return se ejecutó fuera de una función.'
          : error instanceof BreakSignal
            ? 'break se ejecutó fuera de un ciclo.'
            : 'continue se ejecutó fuera de un ciclo.';
        const runtimeError = new RuntimeExecutionError(message, program);
        return {
          success: false,
          console: [...this.console],
          log: [...this.log],
          environment: this.environment,
          resources: this.environment.listResources(),
          symbols: this.environment.listSymbols(),
          errors: [runtimeError.toJSON()],
        };
      }
      if (error instanceof RuntimeEnvironmentError) {
        const runtimeError = new RuntimeExecutionError(error.message, program);
        return {
          success: false,
          console: [...this.console],
          log: [...this.log],
          environment: this.environment,
          resources: this.environment.listResources(),
          symbols: this.environment.listSymbols(),
          errors: [runtimeError.toJSON()],
        };
      }
      throw error;
    }
  }

  registerCallableDeclarations(declarations) {
    for (const declaration of declarations) {
      if (declaration.type === 'FunctionDeclaration') {
        this.functions.set(declaration.name, declaration);
        this.environment.recordSymbol(
          declaration.name,
          'function',
          typeName(declaration.returnType),
          null,
        );
      } else if (declaration.type === 'TaskDeclaration') {
        this.tasks.set(declaration.name, declaration);
        this.environment.recordSymbol(declaration.name, 'task', null, null);
      }
    }
  }

  registerResources(declarations) {
    for (const declaration of declarations) {
      if (declaration.type !== 'ResourceDeclaration') {
        continue;
      }
      this.environment.defineResource({
        kind: declaration.kind,
        name: declaration.name,
        properties: [],
      });
      this.recordNativeAction('register', declaration.name);
    }
  }

  initializeResource(declaration, environment) {
    const resource = environment.getResource(declaration.name);
    resource.properties = Object.fromEntries(declaration.properties.map(({ name, value }) => [
      name,
      this.evaluateExpression(value, environment),
    ]));
  }

  executeDeclaration(declaration, environment) {
    switch (declaration.type) {
      case 'VariableDeclaration':
        environment.defineVariable(
          declaration.name,
          declaration.initializer
            ? this.evaluateExpression(declaration.initializer, environment)
            : defaultValue(declaration.dataType),
          { type: typeName(declaration.dataType) },
        );
        return;
      case 'ResourceDeclaration':
        return this.initializeResource(declaration, environment);
      default:
        throw this.runtimeError(`Declaración no soportada: ${declaration.type}.`, declaration);
    }
  }

  executeStatement(statement, environment) {
    switch (statement.type) {
      case 'BlockStatement':
        return this.executeBlock(statement, environment);
      case 'VariableDeclaration':
        return this.executeDeclaration(statement, environment);
      case 'ExpressionStatement':
        return this.evaluateExpression(statement.expression, environment);
      case 'AssignmentStatement':
        return this.executeAssignment(statement, environment);
      case 'IfStatement':
        return this.executeIf(statement, environment);
      case 'WhileStatement':
        return this.executeWhile(statement, environment);
      case 'ForStatement':
        return this.executeFor(statement, environment);
      case 'RunStatement':
        return this.executeRun(statement);
      case 'ReturnStatement':
        throw new ReturnSignal(
          statement.value ? this.evaluateExpression(statement.value, environment) : null,
        );
      case 'BreakStatement':
        throw new BreakSignal();
      case 'ContinueStatement':
        throw new ContinueSignal();
      default:
        throw this.runtimeError(`Sentencia no soportada: ${statement.type}.`, statement);
    }
  }

  executeBlock(block, parentEnvironment) {
    const environment = parentEnvironment.createChild(`block:${block.line}:${block.column}`);
    for (const statement of block.statements) {
      this.executeStatement(statement, environment);
    }
  }

  executeAssignment(statement, environment) {
    const { target, value } = statement;
    const assignedValue = this.evaluateExpression(value, environment);

    if (target.type === 'Identifier') {
      try {
        environment.assignVariable(target.name, assignedValue);
      } catch (error) {
        if (!(error instanceof RuntimeEnvironmentError)) {
          throw error;
        }
        throw this.runtimeError(error.message, target);
      }
      return;
    }

    const object = this.evaluateExpression(target.object, environment);
    if (target.type === 'MemberExpression') {
      if (isResource(object)) {
        object.properties[target.property] = assignedValue;
      } else if (object && typeof object === 'object') {
        object[target.property] = assignedValue;
      } else {
        throw this.runtimeError('No se puede asignar una propiedad en este valor.', target);
      }
      return;
    }

    const index = this.evaluateExpression(target.index, environment);
    if (!Array.isArray(object)) {
      throw this.runtimeError('El destino de índice no es un arreglo.', target);
    }
    object[index] = assignedValue;
  }

  executeIf(statement, environment) {
    const branch = this.evaluateExpression(statement.condition, environment)
      ? statement.thenBranch
      : statement.elseBranch;
    if (branch) {
      this.executeStatement(branch, environment);
    }
  }

  executeWhile(statement, environment) {
    while (this.evaluateExpression(statement.condition, environment)) {
      try {
        this.executeStatement(statement.body, environment);
      } catch (signal) {
        if (signal instanceof BreakSignal) {
          break;
        }
        if (!(signal instanceof ContinueSignal)) {
          throw signal;
        }
      }
    }
  }

  executeFor(statement, environment) {
    const loopEnvironment = environment.createChild(`for:${statement.line}:${statement.column}`);
    if (statement.initializer) {
      this.executeForClause(statement.initializer, loopEnvironment);
    }

    while (!statement.condition
      || this.evaluateExpression(statement.condition, loopEnvironment)) {
      try {
        this.executeStatement(statement.body, loopEnvironment);
      } catch (signal) {
        if (signal instanceof BreakSignal) {
          break;
        }
        if (!(signal instanceof ContinueSignal)) {
          throw signal;
        }
      }
      if (statement.update) {
        this.executeForClause(statement.update, loopEnvironment);
      }
    }
  }

  executeForClause(clause, environment) {
    if (clause.type === 'VariableDeclaration') {
      this.executeDeclaration(clause, environment);
    } else if (clause.type === 'AssignmentStatement') {
      this.executeAssignment(clause, environment);
    } else if (clause.type === 'ExpressionStatement') {
      this.evaluateExpression(clause.expression, environment);
    } else {
      throw this.runtimeError(`Cláusula for no soportada: ${clause.type}.`, clause);
    }
  }

  executeRun(statement) {
    const task = this.tasks.get(statement.task);
    if (!task) {
      throw this.runtimeError(`Tarea no definida: ${statement.task}.`, statement);
    }
    if (statement.arguments.length > 0) {
      throw this.runtimeError('Las tareas simuladas no reciben argumentos.', statement);
    }

    const taskEnvironment = this.globalEnvironment.createChild(`task:${task.name}`);
    for (const childStatement of task.body.statements) {
      this.executeStatement(childStatement, taskEnvironment);
    }
  }

  evaluateExpression(expression, environment) {
    switch (expression.type) {
      case 'Literal':
        return expression.value;
      case 'Identifier':
        return this.resolveIdentifier(expression.name, environment, expression);
      case 'ArrayExpression':
        return expression.elements.map((element) => this.evaluateExpression(element, environment));
      case 'UnaryExpression':
        return this.evaluateUnary(expression, environment);
      case 'BinaryExpression':
        return this.evaluateBinary(expression, environment);
      case 'MemberExpression':
        return this.evaluateMember(expression, environment);
      case 'IndexExpression':
        return this.evaluateIndex(expression, environment);
      case 'CallExpression':
        return this.evaluateCall(expression, environment);
      default:
        throw this.runtimeError(`Expresión no soportada: ${expression.type}.`, expression);
    }
  }

  resolveIdentifier(name, environment, node) {
    try {
      return environment.getVariable(name);
    } catch (error) {
      if (!(error instanceof RuntimeEnvironmentError)) {
        throw error;
      }
    }

    try {
      return environment.getResource(name);
    } catch (error) {
      if (!(error instanceof RuntimeEnvironmentError)) {
        throw error;
      }
    }

    throw this.runtimeError(`Identificador no definido: ${name}.`, node);
  }

  evaluateUnary(expression, environment) {
    const operand = this.evaluateExpression(expression.operand, environment);
    if (expression.operator === '!') {
      return !operand;
    }
    if (expression.operator === '-') {
      return -operand;
    }
    throw this.runtimeError(`Operador unario no soportado: ${expression.operator}.`, expression);
  }

  evaluateBinary(expression, environment) {
    const left = this.evaluateExpression(expression.left, environment);

    if (expression.operator === '&&') {
      return left && this.evaluateExpression(expression.right, environment);
    }
    if (expression.operator === '||') {
      return left || this.evaluateExpression(expression.right, environment);
    }

    const right = this.evaluateExpression(expression.right, environment);
    if ((expression.operator === '/' || expression.operator === '%') && right === 0) {
      throw this.runtimeError('No se puede dividir entre cero.', expression);
    }
    switch (expression.operator) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return left / right;
      case '%': return left % right;
      case '>': return left > right;
      case '>=': return left >= right;
      case '<': return left < right;
      case '<=': return left <= right;
      case '==': return left === right;
      case '!=': return left !== right;
      default:
        throw this.runtimeError(`Operador binario no soportado: ${expression.operator}.`, expression);
    }
  }

  evaluateMember(expression, environment) {
    const object = this.evaluateExpression(expression.object, environment);
    if (isResource(object)) {
      if (expression.property === 'status') {
        return object.state.status;
      }
      if (object.kind === 'server' && expression.property === 'packages') {
        return object.state.installed ?? [];
      }
      if (object.kind === 'service' && expression.property === 'replicas') {
        return object.state.replicas ?? object.properties.replicas;
      }
      if (object.kind === 'service' && expression.property === 'host') {
        return object.state.deployedTo
          ? environment.getResource(object.state.deployedTo)
          : null;
      }
      return object.properties[expression.property];
    }
    if (object === null || object === undefined) {
      throw this.runtimeError('No se puede acceder a una propiedad de un valor nulo.', expression);
    }
    return object[expression.property];
  }

  evaluateIndex(expression, environment) {
    const object = this.evaluateExpression(expression.object, environment);
    const index = this.evaluateExpression(expression.index, environment);
    if (object === null || object === undefined) {
      throw this.runtimeError('No se puede indexar un valor nulo.', expression);
    }
    return object[index];
  }

  evaluateCall(expression, environment) {
    if (expression.callee.type !== 'Identifier') {
      throw this.runtimeError('Solo se pueden invocar funciones identificadas por nombre.', expression);
    }

    if (nativeFunctionNames.has(expression.callee.name)) {
      return this.evaluateNativeCall(expression, environment);
    }

    const declaration = this.functions.get(expression.callee.name);
    if (!declaration) {
      throw this.runtimeError(`Función no definida: ${expression.callee.name}.`, expression);
    }

    const args = expression.arguments.map((argument) => this.evaluateExpression(argument, environment));
    const functionEnvironment = this.globalEnvironment.createChild(
      `function:${declaration.name}`,
    );
    declaration.parameters.forEach((parameter, index) => {
      functionEnvironment.defineVariable(parameter.name, args[index] ?? null, {
        category: 'parameter',
        type: typeName(parameter.dataType),
      });
    });

    try {
      for (const statement of declaration.body.statements) {
        this.executeStatement(statement, functionEnvironment);
      }
    } catch (signal) {
      if (signal instanceof ReturnSignal) {
        return signal.value;
      }
      throw signal;
    }

    return null;
  }

  evaluateNativeCall(expression, environment) {
    const name = expression.callee.name;
    const args = expression.arguments.map((argument) => this.evaluateExpression(argument, environment));

    switch (name) {
      case 'start': {
        const [resource] = this.requireNativeArguments(name, args, 1, expression);
        this.requireResourceArgument(resource, name, expression);
        resource.state.status = 'running';
        this.recordNativeAction(name, resource.name);
        return true;
      }
      case 'stop': {
        const [resource] = this.requireNativeArguments(name, args, 1, expression);
        this.requireResourceArgument(resource, name, expression);
        if (resource.state.status === 'stopped') {
          return false;
        }
        resource.state.status = 'stopped';
        this.recordNativeAction(name, resource.name);
        return true;
      }
      case 'restart': {
        const [resource] = this.requireNativeArguments(name, args, 1, expression);
        this.requireResourceArgument(resource, name, expression);
        if (resource.state.status !== 'running') {
          return false;
        }
        this.recordNativeAction(name, resource.name);
        return true;
      }
      case 'install': {
        const [server, software] = this.requireNativeArguments(name, args, 2, expression);
        this.requireResourceKind(server, 'server', name, expression);
        if (typeof software !== 'string') {
          throw this.runtimeError('install requiere el nombre del software como cadena.', expression);
        }
        server.state.installed ??= [];
        server.state.installed.push(software);
        this.recordNativeAction(name, server.name, software);
        return true;
      }
      case 'uninstall': {
        const [server, software] = this.requireNativeArguments(name, args, 2, expression);
        this.requireResourceKind(server, 'server', name, expression);
        if (typeof software !== 'string') {
          throw this.runtimeError('uninstall requiere el nombre del software como cadena.', expression);
        }
        const installed = server.state.installed ?? [];
        const packageIndex = installed.indexOf(software);
        if (packageIndex === -1) {
          return false;
        }
        installed.splice(packageIndex, 1);
        this.recordNativeAction(name, server.name, software);
        return true;
      }
      case 'deploy': {
        const [server, service] = this.requireNativeArguments(name, args, 2, expression);
        this.requireResourceKind(server, 'server', name, expression);
        this.requireResourceKind(service, 'service', name, expression);
        const dependencies = service.properties.dependsOn ?? [];
        if (!Array.isArray(dependencies)) {
          throw this.runtimeError('dependsOn debe ser un arreglo de recursos.', expression);
        }
        for (const dependency of dependencies) {
          if (!isResource(dependency)) {
            throw this.runtimeError('dependsOn debe contener recursos.', expression);
          }
          if (dependency.state.status !== 'running') {
            throw new RuntimeExecutionError(
              `No se puede desplegar '${service.name}'. Dependencia '${dependency.name}' se encuentra en estado ${dependency.state.status}.`,
              expression,
              { type: 'infrastructure', code: 'INFRA-004' },
            );
          }
        }
        service.state.deployedTo = server.name;
        service.state.status = 'running';
        this.recordNativeAction(name, service.name, server.name);
        return true;
      }
      case 'scale': {
        const [resource, replicas] = this.requireNativeArguments(name, args, 2, expression);
        this.requireResourceKind(resource, 'service', name, expression);
        if (typeof replicas !== 'number' || !Number.isFinite(replicas)) {
          throw this.runtimeError('scale requiere una cantidad numérica de réplicas.', expression);
        }
        const previousReplicas = resource.state.replicas ?? resource.properties.replicas;
        resource.state.replicas = replicas;
        this.recordNativeAction(name, resource.name, replicas, previousReplicas);
        return true;
      }
      case 'connect': {
        const [source, target] = this.requireNativeArguments(name, args, 2, expression);
        this.requireResourceArgument(source, name, expression);
        this.requireResourceArgument(target, name, expression);
        source.state.connections ??= [];
        source.state.connections.push(target.name);
        this.recordNativeAction(name, source.name, target.name);
        return true;
      }
      case 'disconnect': {
        const [source, target] = this.requireNativeArguments(name, args, 2, expression);
        this.requireResourceArgument(source, name, expression);
        this.requireResourceArgument(target, name, expression);
        const connections = source.state.connections ?? [];
        const connectionIndex = connections.indexOf(target.name);
        if (connectionIndex === -1) {
          return false;
        }
        connections.splice(connectionIndex, 1);
        this.recordNativeAction(name, source.name, target.name);
        return true;
      }
      case 'print':
        this.console.push(args.map(formatConsoleValue).join(' '));
        return null;
      case 'length': {
        const [value] = this.requireNativeArguments(name, args, 1, expression);
        if (typeof value !== 'string' && !Array.isArray(value)) {
          throw this.runtimeError('length requiere una cadena o un arreglo.', expression);
        }
        return value.length;
      }
      case 'status': {
        const [resource] = this.requireNativeArguments(name, args, 1, expression);
        this.requireResourceArgument(resource, name, expression);
        return resource.state.status;
      }
      default:
        throw this.runtimeError(`Función nativa no soportada: ${name}.`, expression);
    }
  }

  requireNativeArguments(name, args, expectedCount, expression) {
    if (args.length !== expectedCount) {
      throw this.runtimeError(
        `${name} requiere ${expectedCount} argumento(s); recibió ${args.length}.`,
        expression,
      );
    }
    return args;
  }

  requireResourceArgument(value, action, expression) {
    if (!isResource(value)) {
      throw this.runtimeError(`${action} requiere un recurso como argumento.`, expression);
    }
  }

  requireResourceKind(value, kind, action, expression) {
    this.requireResourceArgument(value, action, expression);
    if (value.kind !== kind) {
      throw this.runtimeError(`${action} requiere un recurso de tipo ${kind}.`, expression);
    }
  }

  recordNativeAction(action, resource, value = null, previousValue = null) {
    this.log.push({
      action,
      resource,
      ...(value === null ? {} : { value }),
      ...(previousValue === null ? {} : { previousValue }),
    });
  }

  runtimeError(message, node) {
    return new RuntimeExecutionError(message, node);
  }
}

function defaultValue(dataType) {
  if (dataType.dimensions > 0) {
    return [];
  }
  switch (dataType.name) {
    case 'int':
    case 'float':
      return 0;
    case 'string':
      return '';
    case 'bool':
      return false;
    default:
      return null;
  }
}

function typeName(dataType) {
  return `${dataType.name}${'[]'.repeat(dataType.dimensions)}`;
}

function isResource(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.kind === 'string'
    && typeof value.name === 'string'
    && value.properties !== null
    && typeof value.properties === 'object';
}

function formatConsoleValue(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (value !== null && typeof value === 'object' && typeof value.toJSON === 'function') {
    return JSON.stringify(value.toJSON());
  }
  if (value !== null && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
