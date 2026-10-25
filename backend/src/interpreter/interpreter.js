import { AST_NODE_TYPES } from '../ast/nodes.js';
import { Environment, RuntimeEnvironmentError } from '../environment/environment.js';

const nodeTypes = new Set(AST_NODE_TYPES);

export class RuntimeExecutionError extends Error {
  constructor(message, node = null) {
    super(message);
    this.name = 'RuntimeExecutionError';
    this.type = 'runtime';
    this.line = node?.line;
    this.column = node?.column;
  }

  toJSON() {
    return {
      type: this.type,
      message: this.message,
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
    this.functions = new Map();
    this.tasks = new Map();
  }

  interpret(program) {
    if (program?.type !== 'Program') {
      throw new TypeError('El intérprete requiere un nodo raíz Program.');
    }

    try {
      this.registerCallableDeclarations(program.body);
      for (const declaration of program.body) {
        if (declaration.type !== 'MainDeclaration'
          && declaration.type !== 'FunctionDeclaration'
          && declaration.type !== 'TaskDeclaration') {
          this.executeDeclaration(declaration, this.environment);
        }
      }

      const main = program.body.find(({ type }) => type === 'MainDeclaration');
      if (!main) {
        throw new RuntimeExecutionError('No se encontró el bloque main.', program);
      }

      this.executeStatement(main.body, this.environment);
      return {
        success: true,
        environment: this.environment,
        resources: this.environment.listResources(),
      };
    } catch (error) {
      if (error instanceof RuntimeExecutionError) {
        return {
          success: false,
          environment: this.environment,
          resources: this.environment.listResources(),
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
          environment: this.environment,
          resources: this.environment.listResources(),
          errors: [runtimeError.toJSON()],
        };
      }
      if (error instanceof RuntimeEnvironmentError) {
        const runtimeError = new RuntimeExecutionError(error.message, program);
        return {
          success: false,
          environment: this.environment,
          resources: this.environment.listResources(),
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
      } else if (declaration.type === 'TaskDeclaration') {
        this.tasks.set(declaration.name, declaration);
      }
    }
  }

  executeDeclaration(declaration, environment) {
    switch (declaration.type) {
      case 'VariableDeclaration':
        environment.defineVariable(
          declaration.name,
          declaration.initializer
            ? this.evaluateExpression(declaration.initializer, environment)
            : null,
        );
        return;
      case 'ResourceDeclaration':
        environment.defineResource({
          kind: declaration.kind,
          name: declaration.name,
          properties: declaration.properties.map(({ name, value }) => ({
            name,
            value: this.evaluateExpression(value, environment),
          })),
        });
        return;
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
        return this.executeRun(statement, environment);
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
    const environment = parentEnvironment.createChild();
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
    const loopEnvironment = environment.createChild();
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

  executeRun(statement, environment) {
    const task = this.tasks.get(statement.task);
    if (!task) {
      throw this.runtimeError(`Tarea no definida: ${statement.task}.`, statement);
    }
    if (statement.arguments.length > 0) {
      throw this.runtimeError('Las tareas simuladas no reciben argumentos.', statement);
    }

    const taskEnvironment = environment.createChild();
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

    const declaration = this.functions.get(expression.callee.name);
    if (!declaration) {
      throw this.runtimeError(`Función no definida: ${expression.callee.name}.`, expression);
    }

    const args = expression.arguments.map((argument) => this.evaluateExpression(argument, environment));
    const functionEnvironment = environment.createChild();
    declaration.parameters.forEach((parameter, index) => {
      functionEnvironment.defineVariable(parameter.name, args[index] ?? null);
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

  runtimeError(message, node) {
    return new RuntimeExecutionError(message, node);
  }
}

function isResource(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.kind === 'string'
    && typeof value.name === 'string'
    && value.properties !== null
    && typeof value.properties === 'object';
}
