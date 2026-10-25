import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Environment } from '../environment/environment.js';
import { Lexer } from '../lexer/lexer.js';
import { Parser } from '../parser/parser.js';
import { Interpreter } from './interpreter.js';

function interpret(source) {
  const { tokens, errors: lexicalErrors } = new Lexer(source).scan();
  assert.deepEqual(lexicalErrors, []);
  const { ast, errors: syntaxErrors } = new Parser(tokens).parse();
  assert.deepEqual(syntaxErrors, []);
  return new Interpreter().interpret(ast);
}

test('executes the shared smoke-test file using native actions', async () => {
  const source = await readFile(
    new URL('../../../examples/smoke-test.infra', import.meta.url),
    'utf8',
  );
  const result = interpret(source);

  assert.equal(result.success, true);
  assert.deepEqual(result.console, ['AutoInfra listo']);
  assert.equal(result.resources[0].state.status, 'running');
  assert.deepEqual(result.errors, []);
});

test('walks the program AST and initializes global variables and resources in memory', () => {
  const result = interpret(`
    int replicas = 2;
    server web { cpu = replicas * 2; os = "linux"; }
    main { replicas = replicas + 1; }
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('replicas'), 3);
  assert.deepEqual(result.resources, [{
    kind: 'server',
    name: 'web',
    properties: {
      cpu: 4,
      os: 'linux',
    },
    state: {
      status: 'stopped',
    },
  }]);
});

test('executes initialized and uninitialized global declarations plus local declarations', () => {
  const result = interpret(`
    int initialized = 3;
    string empty;
    main {
      int local = initialized + 1;
      local = local * 2;
      initialized = local;
    }
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('initialized'), 8);
  assert.equal(result.environment.getVariable('empty'), null);
  assert.equal(result.environment.variables.has('local'), false);
});

test('executes assignments to variables and array elements', () => {
  const result = interpret(`
    int total = 1;
    int[] values = [2, 3];
    main {
      total = total + values[0];
      values[1] = total * 2;
    }
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('total'), 3);
  assert.deepEqual(result.environment.getVariable('values'), [2, 6]);
});

test('executes resource property reads and assignments in simulated memory', () => {
  const result = interpret(`
    server web { cpu = 2; }
    main { web.cpu = web.cpu + 2; }
  `);

  assert.equal(result.success, true);
  assert.deepEqual(result.resources, [{
    kind: 'server',
    name: 'web',
    properties: { cpu: 4 },
    state: {
      status: 'stopped',
    },
  }]);
});

test('executes the native start and stop actions against simulated resource state', () => {
  const result = interpret(`
    server web {}
    main {
      start(web);
      stop(web);
    }
  `);

  assert.equal(result.success, true);
  assert.equal(result.resources[0].state.status, 'stopped');
  assert.deepEqual(result.log, [
    { action: 'start', resource: 'web' },
    { action: 'stop', resource: 'web' },
  ]);
});

test('simulates install, deploy and scale without excluded domain restrictions', () => {
  const result = interpret(`
    server web {}
    service api {}
    main {
      install(web, "nginx");
      deploy(api, web);
      scale(api, 0);
    }
  `);

  assert.equal(result.success, true);
  assert.deepEqual(result.resources, [
    {
      kind: 'server',
      name: 'web',
      properties: {},
      state: {
        status: 'stopped',
        installed: ['nginx'],
      },
    },
    {
      kind: 'service',
      name: 'api',
      properties: {},
      state: {
        status: 'deployed',
        deployedTo: 'web',
        replicas: 0,
      },
    },
  ]);
  assert.deepEqual(result.log, [
    { action: 'install', resource: 'web', value: 'nginx' },
    { action: 'deploy', resource: 'api', value: 'web' },
    { action: 'scale', resource: 'api', value: 0 },
  ]);
});

test('prints values to the simulated console and evaluates length for strings and arrays', () => {
  const result = interpret(`
    int textLength = length("AutoInfra");
    int itemCount = length([10, 20, 30]);
    main {
      print("lengths:", textLength, itemCount);
      print([true, "ok"]);
    }
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('textLength'), 9);
  assert.equal(result.environment.getVariable('itemCount'), 3);
  assert.deepEqual(result.console, [
    'lengths: 9 3',
    '[true,"ok"]',
  ]);
});

test('reports invalid native calls as located runtime errors', () => {
  const result = interpret('server web {}\nmain { scale(web, "many"); }');

  assert.equal(result.success, false);
  assert.equal(result.errors[0].type, 'runtime');
  assert.match(result.errors[0].message, /cantidad numérica/);
  assert.equal(result.errors[0].line, 2);
  assert.equal(result.errors[0].column, 13);
});

test('reports an assignment to an undefined variable as a located runtime error', () => {
  const result = interpret('main {\n  missing = 2;\n}');

  assert.equal(result.success, false);
  assert.deepEqual(result.errors, [{
    type: 'runtime',
    message: 'Variable no definida: missing.',
    line: 2,
    column: 3,
  }]);
});

test('evaluates integer, decimal, string and boolean literals', () => {
  const result = interpret(`
    int whole = 42;
    float fraction = 2.5;
    string message = "AutoInfra";
    bool enabled = true;
    main {}
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('whole'), 42);
  assert.equal(result.environment.getVariable('fraction'), 2.5);
  assert.equal(result.environment.getVariable('message'), 'AutoInfra');
  assert.equal(result.environment.getVariable('enabled'), true);
});

test('evaluates arithmetic, comparison, equality, logical and unary operations', () => {
  const result = interpret(`
    int arithmetic = 20 / 2 % 6 + 3 * 2 - 1;
    bool comparison = arithmetic >= 8 && arithmetic != 0;
    bool equality = comparison == true || false;
    int negative = -arithmetic;
    bool inverted = !equality;
    main {}
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('arithmetic'), 9);
  assert.equal(result.environment.getVariable('comparison'), true);
  assert.equal(result.environment.getVariable('equality'), true);
  assert.equal(result.environment.getVariable('negative'), -9);
  assert.equal(result.environment.getVariable('inverted'), false);
});

test('evaluates grouped expressions while preserving arithmetic precedence', () => {
  const result = interpret(`
    int precedence = 1 + 2 * 3;
    int grouped = (1 + 2) * 3;
    main {}
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('precedence'), 7);
  assert.equal(result.environment.getVariable('grouped'), 9);
});

test('short-circuits logical expressions', () => {
  const result = interpret(`
    bool conjunction = false && missing();
    bool disjunction = true || missing();
    main {}
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('conjunction'), false);
  assert.equal(result.environment.getVariable('disjunction'), true);
});

test('traverses function declarations and evaluates their return statements', () => {
  const result = interpret(`
    function twice(int value) int { return value * 2; }
    int answer = 0;
    main { answer = twice(21); }
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('answer'), 42);
});

test('traverses task declarations and executes a task from the main block', () => {
  const result = interpret(`
    int count = 0;
    task increment { count = count + 1; }
    main { run increment; run increment; }
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('count'), 2);
});

test('executes conditional and loop nodes while preserving their AST order', () => {
  const result = interpret(`
    int total = 0;
    main {
      for (int i = 0; i < 5; i = i + 1) {
        if (i == 3) { break; }
        total = total + i;
      }
      while (total < 4) { total = total + 1; }
    }
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('total'), 4);
});

test('executes the selected if and else branch', () => {
  const result = interpret(`
    int result = 0;
    main {
      if (true) { result = 1; } else { result = 2; }
      if (false) { result = 3; } else { result = result + 4; }
    }
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('result'), 5);
});

test('executes while iterations and continues by reevaluating the condition', () => {
  const result = interpret(`
    int index = 0;
    int total = 0;
    main {
      while (index < 5) {
        index = index + 1;
        if (index == 3) { continue; }
        total = total + index;
      }
    }
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('index'), 5);
  assert.equal(result.environment.getVariable('total'), 12);
});

test('executes the for update clause after continue', () => {
  const result = interpret(`
    int total = 0;
    main {
      for (int index = 0; index < 5; index = index + 1) {
        if (index < 3) { continue; }
        total = total + index;
      }
    }
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('total'), 7);
});

test('break exits only the innermost nested loop', () => {
  const result = interpret(`
    int total = 0;
    main {
      for (int outer = 0; outer < 3; outer = outer + 1) {
        int inner = 0;
        while (inner < 5) {
          inner = inner + 1;
          if (inner == 2) { break; }
        }
        total = total + inner;
      }
    }
  `);

  assert.equal(result.success, true);
  assert.equal(result.environment.getVariable('total'), 6);
});

test('uses the supplied in-memory environment', () => {
  const environment = new Environment();
  environment.defineVariable('initial', 6);
  const { tokens } = new Lexer('int result = 0; main { result = initial; }').scan();
  const { ast } = new Parser(tokens).parse();
  const result = new Interpreter(environment).interpret(ast);

  assert.equal(result.success, true);
  assert.equal(environment.getVariable('result'), 6);
});

test('returns runtime errors with source locations for unresolved identifiers', () => {
  const result = interpret('main {\n  value = missing;\n}');

  assert.equal(result.success, false);
  assert.equal(result.errors.length, 1);
  assert.deepEqual(result.errors[0], {
    type: 'runtime',
    message: 'Identificador no definido: missing.',
    line: 2,
    column: 11,
  });
});

test('returns a controlled runtime error for a missing task', () => {
  const result = interpret('main { run missing; }');

  assert.equal(result.success, false);
  assert.equal(result.errors[0].type, 'runtime');
  assert.match(result.errors[0].message, /Tarea no definida/);
  assert.equal(result.errors[0].line, 1);
});

test('rejects non-Program AST roots and non-Environment constructor arguments', () => {
  assert.throws(() => new Interpreter().interpret({ type: 'BlockStatement' }), TypeError);
  assert.throws(() => new Interpreter({}), TypeError);
});
