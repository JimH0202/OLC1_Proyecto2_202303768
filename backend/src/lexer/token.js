import { TokenType } from './token-types.js';

const validTokenTypes = new Set(Object.values(TokenType));

export class Token {
  constructor(type, lexeme, line, column) {
    if (!validTokenTypes.has(type)) {
      throw new TypeError(`Tipo de token inválido: ${type}`);
    }
    if (typeof lexeme !== 'string') {
      throw new TypeError('El lexema del token debe ser una cadena.');
    }
    if (!Number.isInteger(line) || line < 1) {
      throw new RangeError('La línea del token debe ser un entero mayor que cero.');
    }
    if (!Number.isInteger(column) || column < 1) {
      throw new RangeError('La columna del token debe ser un entero mayor que cero.');
    }

    this.type = type;
    this.lexeme = lexeme;
    this.line = line;
    this.column = column;
  }
}
