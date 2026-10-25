import {
  DOUBLE_CHAR_TOKENS,
  RESERVED_WORDS,
  SINGLE_CHAR_TOKENS,
  TokenType,
} from './token-types.js';
import { Token } from './token.js';
import {
  InvalidStringEscapeError,
  LexicalError,
  SourceCursor,
} from './source-cursor.js';

export class Lexer {
  constructor(source) {
    this.cursor = new SourceCursor(source);
    this.tokens = [];
    this.errors = [];
  }

  scan() {
    while (!this.cursor.isAtEnd) {
      this.cursor.skipWhitespace();

      if (this.cursor.isAtEnd) {
        break;
      }

      try {
        if (this.cursor.skipComment()) {
          continue;
        }

        this.scanToken();
      } catch (error) {
        if (!(error instanceof LexicalError)) {
          throw error;
        }

        this.errors.push(error.toJSON());
        if (error instanceof InvalidStringEscapeError) {
          this.recoverStringRemainder();
        }
      }
    }

    this.tokens.push(new Token(
      TokenType.EOF,
      '',
      this.cursor.line,
      this.cursor.column,
    ));

    return {
      tokens: this.tokens,
      errors: this.errors,
    };
  }

  scanToken() {
    const character = this.cursor.peek();

    if (isIdentifierStart(character)) {
      this.scanIdentifier();
      return;
    }

    if (isDigit(character)) {
      this.scanNumber();
      return;
    }

    if (character === '"') {
      this.scanString();
      return;
    }

    const doubleCharacter = `${character}${this.cursor.peek(1) ?? ''}`;
    const doubleType = DOUBLE_CHAR_TOKENS[doubleCharacter];

    if (doubleType) {
      const start = this.cursor.advance();
      this.cursor.advance();
      this.addToken(doubleType, doubleCharacter, start.line, start.column);
      return;
    }

    const singleType = SINGLE_CHAR_TOKENS[character];

    if (singleType) {
      const position = this.cursor.advance();
      this.addToken(singleType, character, position.line, position.column);
      return;
    }

    this.cursor.consumeUnknownCharacter();
  }

  scanIdentifier() {
    const start = {
      index: this.cursor.index,
      line: this.cursor.line,
      column: this.cursor.column,
    };

    while (isIdentifierPart(this.cursor.peek())) {
      this.cursor.advance();
    }

    const lexeme = this.cursor.source.slice(start.index, this.cursor.index);
    const type = RESERVED_WORDS[lexeme] ?? TokenType.IDENTIFIER;
    this.addToken(type, lexeme, start.line, start.column);
  }

  scanNumber() {
    const start = {
      index: this.cursor.index,
      line: this.cursor.line,
      column: this.cursor.column,
    };

    while (isDigit(this.cursor.peek())) {
      this.cursor.advance();
    }

    let type = TokenType.INTEGER_LITERAL;

    if (this.cursor.peek() === '.' && isDigit(this.cursor.peek(1))) {
      type = TokenType.FLOAT_LITERAL;
      this.cursor.advance();

      while (isDigit(this.cursor.peek())) {
        this.cursor.advance();
      }
    }

    const lexeme = this.cursor.source.slice(start.index, this.cursor.index);
    this.addToken(type, lexeme, start.line, start.column);
  }

  scanString() {
    try {
      const string = this.cursor.readStringLiteral();
      this.addToken(
        TokenType.STRING_LITERAL,
        string.lexeme,
        string.line,
        string.column,
      );
    } catch (error) {
      if (!(error instanceof LexicalError)) {
        throw error;
      }

      this.errors.push(error.toJSON());
      if (error instanceof InvalidStringEscapeError) {
        this.recoverStringRemainder();
      }
    }
  }

  recoverStringRemainder() {
    while (!this.cursor.isAtEnd && this.cursor.peek() !== '\r' && this.cursor.peek() !== '\n') {
      const character = this.cursor.advance().character;

      if (character === '"') {
        return;
      }

      if (character === '\\' && !this.cursor.isAtEnd
        && this.cursor.peek() !== '\r' && this.cursor.peek() !== '\n') {
        this.cursor.advance();
      }
    }
  }

  addToken(type, lexeme, line, column) {
    this.tokens.push(new Token(type, lexeme, line, column));
  }
}

function isIdentifierStart(character) {
  return character !== null && /[A-Za-z_]/.test(character);
}

function isIdentifierPart(character) {
  return character !== null && /[A-Za-z0-9_]/.test(character);
}

function isDigit(character) {
  return character !== null && /[0-9]/.test(character);
}
