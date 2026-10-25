import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
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
