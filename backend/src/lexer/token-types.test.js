import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOUBLE_CHAR_TOKENS,
  RESERVED_WORDS,
  SINGLE_CHAR_TOKENS,
  TokenType,
} from './token-types.js';

test('defines every reserved word in the lexical inventory', () => {
  assert.deepEqual(Object.keys(RESERVED_WORDS), [
    'int', 'float', 'string', 'bool', 'server', 'service', 'database',
    'if', 'else', 'while', 'for', 'break', 'continue', 'return',
    'function', 'task', 'main', 'run', 'true', 'false',
  ]);
  assert.equal(RESERVED_WORDS.server, TokenType.SERVER);
  assert.equal(RESERVED_WORDS.true, TokenType.TRUE);
  assert.equal(Object.hasOwn(RESERVED_WORDS, 'start'), false);
  assert.equal(Object.hasOwn(RESERVED_WORDS, 'void'), false);
});

test('defines single- and double-character operators and punctuation', () => {
  assert.deepEqual(Object.keys(SINGLE_CHAR_TOKENS), [
    '+', '-', '*', '/', '%', '=', '>', '<', '!',
    '(', ')', '{', '}', '[', ']', ',', ';', '.',
  ]);
  assert.deepEqual(Object.keys(DOUBLE_CHAR_TOKENS), [
    '>=', '<=', '==', '!=', '&&', '||',
  ]);
  assert.equal(SINGLE_CHAR_TOKENS['='], TokenType.ASSIGN);
  assert.equal(DOUBLE_CHAR_TOKENS['=='], TokenType.EQUAL_EQUAL);
});

test('declares token types for identifiers, literals and end of input', () => {
  assert.equal(TokenType.IDENTIFIER, 'IDENTIFIER');
  assert.equal(TokenType.INTEGER_LITERAL, 'INTEGER_LITERAL');
  assert.equal(TokenType.FLOAT_LITERAL, 'FLOAT_LITERAL');
  assert.equal(TokenType.STRING_LITERAL, 'STRING_LITERAL');
  assert.equal(TokenType.EOF, 'EOF');
});
