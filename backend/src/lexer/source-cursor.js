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
