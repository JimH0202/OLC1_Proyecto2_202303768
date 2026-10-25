import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AST_NODE_TYPES } from '../ast/nodes.js';
import { Lexer } from '../lexer/lexer.js';
import { Parser } from './parser.js';

function parse(source) {
  const { tokens, errors: lexicalErrors } = new Lexer(source).scan();
  assert.deepEqual(lexicalErrors, []);
  return new Parser(tokens).parse();
}

test('parses the development smoke-test program', async () => {
  const source = await readFile(
    new URL('../../../examples/smoke-test.infra', import.meta.url),
    'utf8',
  );
  const result = parse(source);

  assert.deepEqual(result.errors, []);
  assert.equal(result.ast.type, 'Program');
  assert.equal(result.ast.body[0].type, 'ResourceDeclaration');
  assert.equal(result.ast.body[1].type, 'MainDeclaration');
});

test('parses the complete lexer catalog example', async () => {
  const source = await readFile(
    new URL('../../../examples/lexer/token-catalog.infra', import.meta.url),
    'utf8',
  );
  const { ast, errors } = parse(source);

  assert.deepEqual(errors, []);
  assert.equal(ast.type, 'Program');
  assert.equal(ast.body.length, 11);
});

test('requires one final main block after global declarations and resources', () => {
  const { ast, errors } = parse(`
    int count = 1;
    server web { cpu = 2; }
    function ready() bool { return true; }
    task setup { run prepare; }
    main { print(count); }
  `);

  assert.deepEqual(errors, []);
  assert.deepEqual(ast.body.map(({ type }) => type), [
    'VariableDeclaration',
    'ResourceDeclaration',
    'FunctionDeclaration',
    'TaskDeclaration',
    'MainDeclaration',
  ]);
});

test('rejects a program without main', () => {
  const { ast, errors } = parse('int count = 1;');

  assert.equal(ast, null);
  assert.equal(errors[0].type, 'syntactic');
  assert.match(errors[0].message, /único bloque main/);
  assert.equal(errors[0].lexeme, '');
});

test('rejects a second main block', () => {
  const { ast, errors } = parse('main {} main {}');

  assert.equal(ast, null);
  assert.equal(errors[0].type, 'syntactic');
  assert.equal(errors[0].lexeme, 'main');
  assert.equal(errors[0].line, 1);
});

test('rejects declarations after the main block', () => {
  const { ast, errors } = parse('main {} int count = 1;');

  assert.equal(ast, null);
  assert.equal(errors[0].type, 'syntactic');
  assert.equal(errors[0].lexeme, 'int');
  assert.match(errors[0].message, /fin del archivo/);
});

test('parses declarations, tasks, functions, arrays and control-flow statements', () => {
  const { ast, errors } = parse(`
    int count = 1;
    function isReady(int amount) bool { return amount > 0; }
    task prepare { run setup; }
    main {
      if (isReady(count)) { count = count + 1; } else { count = 0; }
      for (int i = 0; i < 2; i = i + 1) { print([count, i]); }
      while (count > 0) { break; }
      continue;
    }
  `);

  assert.deepEqual(errors, []);
  assert.deepEqual(ast.body.map(({ type }) => type), [
    'VariableDeclaration',
    'FunctionDeclaration',
    'TaskDeclaration',
    'MainDeclaration',
  ]);
  assert.equal(ast.body[3].body.statements[1].type, 'ForStatement');
  assert.equal(ast.body[3].body.statements[1].body.statements[0].expression.type, 'CallExpression');
});

test('preserves arithmetic precedence and left associativity in the AST', () => {
  const { ast, errors } = parse('main { result = 1 + 2 * 3 - 4; }');
  const expression = ast.body[0].body.statements[0].value;

  assert.deepEqual(errors, []);
  assert.equal(expression.operator, '-');
  assert.equal(expression.left.operator, '+');
  assert.equal(expression.left.right.operator, '*');
});

test('parses every binary precedence level from logical OR to multiplication', () => {
  const { ast, errors } = parse('main { result = a || b && c == d < e + f * g; }');
  const logicalOr = ast.body[0].body.statements[0].value;
  const logicalAnd = logicalOr.right;
  const equality = logicalAnd.right;
  const comparison = equality.right;
  const addition = comparison.right;
  const multiplication = addition.right;

  assert.deepEqual(errors, []);
  assert.equal(logicalOr.operator, '||');
  assert.equal(logicalAnd.operator, '&&');
  assert.equal(equality.operator, '==');
  assert.equal(comparison.operator, '<');
  assert.equal(addition.operator, '+');
  assert.equal(multiplication.operator, '*');
  assert.equal(multiplication.right.name, 'g');
});

test('associates operators at the same binary precedence level from left to right', () => {
  const { ast, errors } = parse('main { result = a - b - c; }');
  const expression = ast.body[0].body.statements[0].value;

  assert.deepEqual(errors, []);
  assert.equal(expression.operator, '-');
  assert.equal(expression.left.operator, '-');
  assert.equal(expression.right.name, 'c');
});

test('parses unary, grouping, array, call, index and property primary expressions', () => {
  const { ast, errors } = parse(
    'main { result = (factory([!ready, -2.5]))[0].status; }',
  );
  const member = ast.body[0].body.statements[0].value;
  const index = member.object;
  const call = index.object;
  const grouping = call.callee;
  const array = call.arguments[0];

  assert.deepEqual(errors, []);
  assert.equal(member.type, 'MemberExpression');
  assert.equal(member.property, 'status');
  assert.equal(index.type, 'IndexExpression');
  assert.equal(index.index.value, 0);
  assert.equal(call.type, 'CallExpression');
  assert.equal(grouping.type, 'Identifier');
  assert.equal(array.type, 'ArrayExpression');
  assert.equal(array.elements[0].type, 'UnaryExpression');
  assert.equal(array.elements[0].operator, '!');
  assert.equal(array.elements[1].type, 'UnaryExpression');
  assert.equal(array.elements[1].operand.value, 2.5);
});

test('builds located AST nodes for all supported language constructs', () => {
  const { ast, errors } = parse(`
    int count = 1;
    server web { cpu = 2; }
    function ready(int value) bool { return !false && value >= 1; }
    task setup { run deploy(web); }
    main {
      values[0] = web.status;
      if (ready(count)) { count = count + 1; } else { count = -1; }
      while (count > 0) { break; }
      for (int i = 0; i < 1; i = i + 1) { continue; }
      print([count, 2.5, "ok", true]);
    }
  `);
  const foundTypes = new Set();
  const nodes = [];

  function collect(value) {
    if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value && typeof value === 'object') {
      if (typeof value.type === 'string') {
        foundTypes.add(value.type);
        nodes.push(value);
      }
      Object.values(value).forEach(collect);
    }
  }

  collect(ast);

  assert.deepEqual(errors, []);
  for (const type of AST_NODE_TYPES) {
    assert.ok(foundTypes.has(type), `Falta nodo AST ${type}`);
  }
  assert.ok(nodes.every(({ line, column }) => line >= 1 && column >= 1));
  assert.doesNotThrow(() => JSON.stringify(ast));
});

test('accepts property and index assignment targets without semantic checks', () => {
  const { ast, errors } = parse('main { serverNode.status = "up"; values[0] = true; }');

  assert.deepEqual(errors, []);
  assert.equal(ast.body[0].body.statements[0].target.type, 'MemberExpression');
  assert.equal(ast.body[0].body.statements[1].target.type, 'IndexExpression');
});

test('reports malformed syntax with location and a syntactic error type', () => {
  const { ast, errors } = parse('main { int count = ; }');

  assert.equal(ast, null);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].type, 'syntactic');
  assert.equal(errors[0].line, 1);
  assert.equal(errors[0].column, 20);
  assert.equal(errors[0].lexeme, ';');
});

test('rejects assignment to a non-assignable expression', () => {
  const { ast, errors } = parse('main { 1 + 2 = 3; }');

  assert.equal(ast, null);
  assert.equal(errors[0].type, 'syntactic');
  assert.match(errors[0].message, /lado izquierdo/);
});

test('rejects assignment targets rooted in a call expression', () => {
  const { ast, errors } = parse('main { factory().value = 3; }');

  assert.equal(ast, null);
  assert.equal(errors[0].type, 'syntactic');
  assert.match(errors[0].message, /lado izquierdo/);
});
