export class SourceCursor {
  constructor(source) {
    if (typeof source !== 'string') {
      throw new TypeError('El código fuente debe ser una cadena.');
    }

    this.source = source;
    this.index = 0;
    this.line = 1;
    this.column = 1;
    this.previousWasCarriageReturn = false;
  }

  get isAtEnd() {
    return this.index >= this.source.length;
  }

  peek(offset = 0) {
    if (!Number.isInteger(offset) || offset < 0) {
      throw new RangeError('El desplazamiento debe ser un entero no negativo.');
    }

    return this.source[this.index + offset] ?? null;
  }

  skipWhitespace() {
    let skipped = 0;

    while (isWhitespace(this.peek())) {
      this.advance();
      skipped += 1;
    }

    return skipped;
  }

  skipComment() {
    if (this.peek() !== '/' || (this.peek(1) !== '/' && this.peek(1) !== '*')) {
      return false;
    }

    const start = {
      index: this.index,
      line: this.line,
      column: this.column,
    };
    this.advance();
    const commentMarker = this.advance().character;

    if (commentMarker === '/') {
      while (!this.isAtEnd && this.peek() !== '\r' && this.peek() !== '\n') {
        this.advance();
      }
      return true;
    }

    while (!this.isAtEnd) {
      if (this.peek() === '*' && this.peek(1) === '/') {
        this.advance();
        this.advance();
        return true;
      }
      this.advance();
    }

    throw new UnterminatedCommentError(
      start.line,
      start.column,
      this.source.slice(start.index),
    );
  }

  readStringLiteral() {
    if (this.peek() !== '"') {
      throw new TypeError('El cursor debe estar al inicio de una cadena.');
    }

    const start = {
      index: this.index,
      line: this.line,
      column: this.column,
    };
    let value = '';
    this.advance();

    while (!this.isAtEnd) {
      const character = this.peek();

      if (character === '"') {
        this.advance();
        return {
          lexeme: this.source.slice(start.index, this.index),
          value,
          line: start.line,
          column: start.column,
        };
      }

      if (character === '\r' || character === '\n') {
        throw new UnterminatedStringError(
          start.line,
          start.column,
          this.source.slice(start.index, this.index),
        );
      }

      if (character !== '\\') {
        value += this.advance().character;
        continue;
      }

      const escape = { line: this.line, column: this.column };
      this.advance();
      const escapedCharacter = this.peek();

      if (escapedCharacter === null || escapedCharacter === '\r' || escapedCharacter === '\n') {
        throw new UnterminatedStringError(
          start.line,
          start.column,
          this.source.slice(start.index, this.index),
        );
      }

      this.advance();
      const decodedEscape = decodeEscape(escapedCharacter);

      if (decodedEscape === null) {
        throw new InvalidStringEscapeError(
          escapedCharacter,
          escape.line,
          escape.column,
        );
      }

      value += decodedEscape;
    }

    throw new UnterminatedStringError(
      start.line,
      start.column,
      this.source.slice(start.index),
    );
  }

  consumeUnknownCharacter() {
    if (this.isAtEnd) {
      throw new RangeError('No existe un carácter para reportar al final del archivo.');
    }

    const position = this.advance();
    throw new UnknownCharacterError(
      position.character,
      position.line,
      position.column,
    );
  }

  advance() {
    if (this.isAtEnd) {
      return null;
    }

    const character = this.source[this.index];
    const position = {
      character,
      index: this.index,
      line: this.line,
      column: this.column,
    };

    this.index += 1;

    if (character === '\r') {
      this.line += 1;
      this.column = 1;
      this.previousWasCarriageReturn = true;
    } else if (character === '\n') {
      if (!this.previousWasCarriageReturn) {
        this.line += 1;
      }
      this.column = 1;
      this.previousWasCarriageReturn = false;
    } else {
      this.column += 1;
      this.previousWasCarriageReturn = false;
    }

    return position;
  }
}

function isWhitespace(character) {
  return character === ' '
    || character === '\t'
    || character === '\v'
    || character === '\f'
    || character === '\r'
    || character === '\n';
}

export class LexicalError extends SyntaxError {
  constructor(message, line, column, lexeme) {
    super(message);
    this.type = 'lexical';
    this.line = line;
    this.column = column;
    this.lexeme = lexeme;
  }

  toJSON() {
    return {
      type: this.type,
      message: this.message,
      line: this.line,
      column: this.column,
      lexeme: this.lexeme,
    };
  }
}

export class UnknownCharacterError extends LexicalError {
  constructor(character, line, column) {
    super(
      `Carácter no reconocido ${JSON.stringify(character)}.`,
      line,
      column,
      character,
    );
    this.name = 'UnknownCharacterError';
  }
}

export class UnterminatedCommentError extends LexicalError {
  constructor(line, column, lexeme) {
    super(
      `Comentario multilínea sin cierre en línea ${line}, columna ${column}.`,
      line,
      column,
      lexeme,
    );
    this.name = 'UnterminatedCommentError';
  }
}

export class UnterminatedStringError extends LexicalError {
  constructor(line, column, lexeme) {
    super(`Cadena sin cierre en línea ${line}, columna ${column}.`, line, column, lexeme);
    this.name = 'UnterminatedStringError';
  }
}

export class InvalidStringEscapeError extends LexicalError {
  constructor(escape, line, column) {
    super(
      `Secuencia de escape no válida '\\${escape}' en línea ${line}, columna ${column}.`,
      line,
      column,
      `\\${escape}`,
    );
    this.name = 'InvalidStringEscapeError';
  }
}

function decodeEscape(character) {
  switch (character) {
    case '"':
      return '"';
    case '\\':
      return '\\';
    case 'n':
      return '\n';
    case 't':
      return '\t';
    default:
      return null;
  }
}
