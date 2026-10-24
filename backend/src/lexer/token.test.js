import assert from 'node:assert/strict';
import test from 'node:test';
import { Token } from './token.js';
import { TokenType } from './token-types.js';

test('stores token type, lexeme, line and column', () => {
  const token = new Token(TokenType.IDENTIFIER, 'backend', 3, 5);

  assert.deepEqual({ ...token }, {
    type: 'IDENTIFIER',
    lexeme: 'backend',
    line: 3,
    column: 5,
  });
});

test('serializes the token as a JSON object for API responses', () => {
  const token = new Token(TokenType.INTEGER_LITERAL, '42', 1, 10);

  assert.equal(
    JSON.stringify(token),
    '{"type":"INTEGER_LITERAL","lexeme":"42","line":1,"column":10}',
  );
});

test('accepts EOF with an empty lexeme', () => {
  const token = new Token(TokenType.EOF, '', 2, 1);

  assert.equal(token.type, TokenType.EOF);
  assert.equal(token.lexeme, '');
});

test('rejects unknown token types and invalid source positions', () => {
  assert.throws(
    () => new Token('UNKNOWN', '?', 1, 1),
    { name: 'TypeError' },
  );
  assert.throws(
    () => new Token(TokenType.IDENTIFIER, 'x', 0, 1),
    { name: 'RangeError' },
  );
  assert.throws(
    () => new Token(TokenType.IDENTIFIER, 'x', 1, 0),
    { name: 'RangeError' },
  );
});
