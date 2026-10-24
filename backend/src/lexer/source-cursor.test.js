import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceCursor, UnterminatedCommentError } from './source-cursor.js';

test('reads each character with its original index, line and column', () => {
  const cursor = new SourceCursor('ab\nc');

  assert.deepEqual(cursor.advance(), {
    character: 'a',
    index: 0,
    line: 1,
    column: 1,
  });
  assert.deepEqual(cursor.advance(), {
    character: 'b',
    index: 1,
    line: 1,
    column: 2,
  });
  assert.deepEqual(cursor.advance(), {
    character: '\n',
    index: 2,
    line: 1,
    column: 3,
  });
  assert.deepEqual(cursor.advance(), {
    character: 'c',
    index: 3,
    line: 2,
    column: 1,
  });
  assert.equal(cursor.isAtEnd, true);
  assert.equal(cursor.advance(), null);
});

test('treats CRLF as one line break and handles standalone carriage returns', () => {
  const cursor = new SourceCursor('a\r\nb\rc');

  cursor.advance();
  assert.equal(cursor.advance().line, 1);
  assert.equal(cursor.advance().line, 2);
  assert.deepEqual(cursor.advance(), {
    character: 'b',
    index: 3,
    line: 2,
    column: 1,
  });
  assert.equal(cursor.advance().line, 2);
  assert.deepEqual(cursor.advance(), {
    character: 'c',
    index: 5,
    line: 3,
    column: 1,
  });
});

test('peeks without advancing and validates offsets', () => {
  const cursor = new SourceCursor('abc');

  assert.equal(cursor.peek(), 'a');
  assert.equal(cursor.peek(2), 'c');
  assert.equal(cursor.peek(3), null);
  assert.equal(cursor.index, 0);
  assert.throws(() => cursor.peek(-1), { name: 'RangeError' });
});

test('skips whitespace and leaves the cursor at the next character position', () => {
  const cursor = new SourceCursor(' \tserver\r\n  web');

  assert.equal(cursor.skipWhitespace(), 2);
  assert.deepEqual(cursor.advance(), {
    character: 's',
    index: 2,
    line: 1,
    column: 3,
  });

  while (cursor.peek() !== ' ') {
    cursor.advance();
  }
  assert.equal(cursor.skipWhitespace(), 2);
  assert.deepEqual(cursor.advance(), {
    character: 'w',
    index: 12,
    line: 2,
    column: 3,
  });
});

test('skips empty or trailing whitespace without moving past the source', () => {
  const emptyCursor = new SourceCursor('');
  const whitespaceCursor = new SourceCursor(' \t\r\n');

  assert.equal(emptyCursor.skipWhitespace(), 0);
  assert.equal(whitespaceCursor.skipWhitespace(), 4);
  assert.equal(whitespaceCursor.isAtEnd, true);
  assert.equal(whitespaceCursor.line, 2);
  assert.equal(whitespaceCursor.column, 1);
});

test('skips a line comment and leaves its newline for whitespace tracking', () => {
  const cursor = new SourceCursor('// comment\r\nserver');

  assert.equal(cursor.skipComment(), true);
  assert.equal(cursor.peek(), '\r');
  assert.deepEqual(cursor.advance(), {
    character: '\r',
    index: 10,
    line: 1,
    column: 11,
  });
  assert.deepEqual(cursor.advance(), {
    character: '\n',
    index: 11,
    line: 2,
    column: 1,
  });
  assert.equal(cursor.peek(), 's');
  assert.equal(cursor.line, 2);
  assert.equal(cursor.column, 1);
});

test('skips a multiline comment while tracking lines and columns', () => {
  const cursor = new SourceCursor('/* first\nsecond */server');

  assert.equal(cursor.skipComment(), true);
  assert.equal(cursor.peek(), 's');
  assert.equal(cursor.line, 2);
  assert.equal(cursor.column, 10);
});

test('reports an unterminated multiline comment at its opening position', () => {
  const cursor = new SourceCursor(' \n  /* no close');

  cursor.skipWhitespace();
  assert.throws(
    () => cursor.skipComment(),
    (error) => {
      assert.ok(error instanceof UnterminatedCommentError);
      assert.equal(error.type, 'lexical');
      assert.equal(error.line, 2);
      assert.equal(error.column, 3);
      return true;
    },
  );
  assert.equal(cursor.isAtEnd, true);
});

test('does not consume a slash that does not begin a comment', () => {
  const cursor = new SourceCursor('/ value');

  assert.equal(cursor.skipComment(), false);
  assert.equal(cursor.peek(), '/');
  assert.equal(cursor.index, 0);
});

test('rejects non-string source input', () => {
  assert.throws(() => new SourceCursor(null), { name: 'TypeError' });
});
