import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Lexer } from './lexer.js';
import { TokenType } from './token-types.js';

const examplePath = new URL('../../../examples/lexer/token-catalog.infra', import.meta.url);

test('tokenizes the development smoke-test program without lexical errors', async () => {
  const source = await readFile(
    new URL('../../../examples/smoke-test.infra', import.meta.url),
    'utf8',
  );
  const { tokens, errors } = new Lexer(source).scan();

  assert.deepEqual(errors, []);
  assert.ok(tokens.some((token) => token.type === TokenType.SERVER && token.lexeme === 'server'));
  assert.ok(tokens.some((token) => token.type === TokenType.MAIN && token.lexeme === 'main'));
  assert.ok(tokens.some((token) => token.lexeme === 'start'));
  assert.ok(tokens.some((token) => token.lexeme === 'print'));
  assert.ok(tokens.some((token) => token.type === TokenType.STRING_LITERAL && token.lexeme.includes('AutoInfra listo')));
  assert.equal(tokens.at(-1).type, TokenType.EOF);
});

test('tokenizes the complete example catalog with source positions', async () => {
  const source = await readFile(examplePath, 'utf8');
  const { tokens, errors } = new Lexer(source).scan();

  assert.deepEqual(errors, []);
  assert.equal(tokens[0].type, TokenType.INT);
  assert.equal(tokens[0].lexeme, 'int');
  assert.equal(tokens[0].line, 2);
  assert.equal(tokens[0].column, 1);
  assert.equal(tokens.at(-1).type, TokenType.EOF);
  assert.equal(tokens.at(-1).line, 23);

  for (const type of Object.values(TokenType)) {
    assert.ok(tokens.some((token) => token.type === type), `Falta token ${type}`);
  }
});

test('recognizes reserved words exactly and keeps native names as identifiers', () => {
  const { tokens } = new Lexer('server serverNode start print true TRUE').scan();

  assert.deepEqual(tokens.slice(0, -1).map(({ type }) => type), [
    TokenType.SERVER,
    TokenType.IDENTIFIER,
    TokenType.IDENTIFIER,
    TokenType.IDENTIFIER,
    TokenType.TRUE,
    TokenType.IDENTIFIER,
  ]);
});

test('recognizes integers, decimals, unary minus and property dots', () => {
  const { tokens } = new Lexer('10 2.5 -3 resource.status 4.').scan();

  assert.deepEqual(tokens.slice(0, -1).map(({ type, lexeme }) => [type, lexeme]), [
    [TokenType.INTEGER_LITERAL, '10'],
    [TokenType.FLOAT_LITERAL, '2.5'],
    [TokenType.MINUS, '-'],
    [TokenType.INTEGER_LITERAL, '3'],
    [TokenType.IDENTIFIER, 'resource'],
    [TokenType.DOT, '.'],
    [TokenType.IDENTIFIER, 'status'],
    [TokenType.INTEGER_LITERAL, '4'],
    [TokenType.DOT, '.'],
  ]);
});

test('recognizes escaped strings and keeps their original lexemes', () => {
  const source = String.raw`"quote: \" slash: \\ newline: \n tab: \t"`;
  const { tokens, errors } = new Lexer(source).scan();

  assert.deepEqual(errors, []);
  assert.equal(tokens[0].type, TokenType.STRING_LITERAL);
  assert.equal(tokens[0].lexeme, source);
});

test('reports unknown characters and continues scanning subsequent tokens', async () => {
  const source = await readFile(
    new URL('../../../examples/lexer/errors/unknown-character.infra', import.meta.url),
    'utf8',
  );
  const { tokens, errors } = new Lexer(source).scan();

  assert.deepEqual(errors, [{
    type: 'lexical',
    message: 'Carácter no reconocido "@".',
    line: 1,
    column: 16,
    lexeme: '@',
  }]);
  assert.ok(tokens.some((token) => token.lexeme === '2'));
  assert.equal(tokens.at(-1).type, TokenType.EOF);
});

test('reports unterminated strings and comments with line and column', async () => {
  const stringSource = await readFile(
    new URL('../../../examples/lexer/errors/unterminated-string.infra', import.meta.url),
    'utf8',
  );
  const commentSource = await readFile(
    new URL('../../../examples/lexer/errors/unterminated-comment.infra', import.meta.url),
    'utf8',
  );

  const stringResult = new Lexer(stringSource).scan();
  const commentResult = new Lexer(commentSource).scan();

  assert.equal(stringResult.errors[0].type, 'lexical');
  assert.equal(stringResult.errors[0].line, 1);
  assert.equal(stringResult.errors[0].column, 18);
  assert.equal(stringResult.errors[0].lexeme, '"sin cierre');
  assert.equal(commentResult.errors[0].type, 'lexical');
  assert.equal(commentResult.errors[0].line, 2);
  assert.equal(commentResult.errors[0].column, 5);
  assert.ok(commentResult.errors[0].lexeme.startsWith('/*'));
});

test('reports unsupported string escapes with their exact position', async () => {
  const source = await readFile(
    new URL('../../../examples/lexer/errors/invalid-string-escape.infra', import.meta.url),
    'utf8',
  );
  const { tokens, errors } = new Lexer(source).scan();

  assert.equal(errors.length, 1);
  assert.equal(errors[0].type, 'lexical');
  assert.equal(errors[0].line, 1);
  assert.equal(errors[0].column, 35);
  assert.equal(errors[0].lexeme, '\\q');
  assert.equal(tokens.at(-1).type, TokenType.EOF);
});

test('returns EOF at the current position for empty and whitespace-only input', () => {
  const empty = new Lexer('').scan();
  const whitespace = new Lexer(' \r\n\t').scan();

  assert.deepEqual(empty.tokens.map(({ type }) => type), [TokenType.EOF]);
  assert.deepEqual(
    [whitespace.tokens[0].line, whitespace.tokens[0].column],
    [2, 2],
  );
});
