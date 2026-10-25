import assert from 'node:assert/strict';
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
  }]);
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
