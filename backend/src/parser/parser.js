import { TokenType } from '../lexer/token-types.js';

const resourceTypes = new Set([
  TokenType.SERVER,
  TokenType.SERVICE,
  TokenType.DATABASE,
]);

const primitiveTypes = new Map([
  [TokenType.INT, 'int'],
  [TokenType.FLOAT, 'float'],
  [TokenType.STRING, 'string'],
  [TokenType.BOOL, 'bool'],
]);

export class Parser {
  constructor(tokens) {
    if (!Array.isArray(tokens) || tokens.at(-1)?.type !== TokenType.EOF) {
      throw new TypeError('El parser requiere un arreglo de tokens terminado en EOF.');
    }

    this.tokens = tokens;
    this.current = 0;
  }

  parse() {
    try {
      const ast = this.parseProgram();
      return { ast, errors: [] };
    } catch (error) {
      if (!(error instanceof ParserSyntaxError)) {
        throw error;
      }

      return { ast: null, errors: [error.toJSON()] };
    }
  }

  parseProgram() {
    const start = this.peek();
    const body = [];

    while (!this.check(TokenType.EOF)) {
      body.push(this.parseDeclaration());
    }

    this.consume(TokenType.EOF, 'Se esperaba el fin del archivo.');
    return createNode('Program', start, { body });
  }

  parseDeclaration() {
    if (this.isType(this.peek().type)) {
      return this.parseVariableDeclaration();
    }
    if (resourceTypes.has(this.peek().type)) {
      return this.parseResourceDeclaration();
    }
    if (this.match(TokenType.FUNCTION)) {
      return this.parseFunctionDeclaration(this.previous());
    }
    if (this.match(TokenType.TASK)) {
      return this.parseTaskDeclaration(this.previous());
    }
    if (this.match(TokenType.MAIN)) {
      return this.parseMainDeclaration(this.previous());
    }

    throw this.syntaxError('Se esperaba una declaración.');
  }

  parseVariableDeclaration() {
    const start = this.peek();
    const dataType = this.parseType();
    const name = this.consume(TokenType.IDENTIFIER, 'Se esperaba el nombre de la variable.');
    const initializer = this.match(TokenType.ASSIGN) ? this.parseExpression() : null;
    this.consume(TokenType.SEMICOLON, 'Se esperaba ";" después de la declaración.');

    return createNode('VariableDeclaration', start, {
      dataType,
      name: name.lexeme,
      initializer,
    });
  }

  parseResourceDeclaration() {
    const kind = this.advance();
    const name = this.consume(TokenType.IDENTIFIER, 'Se esperaba el nombre del recurso.');
    this.consume(TokenType.LEFT_BRACE, 'Se esperaba "{" después del nombre del recurso.');
    const properties = [];

    while (!this.check(TokenType.RIGHT_BRACE) && !this.check(TokenType.EOF)) {
      const propertyName = this.consume(
        TokenType.IDENTIFIER,
        'Se esperaba el nombre de una propiedad del recurso.',
      );
      this.consume(TokenType.ASSIGN, 'Se esperaba "=" después de la propiedad.');
      const value = this.parseExpression();
      this.consume(TokenType.SEMICOLON, 'Se esperaba ";" después de la propiedad.');
      properties.push(createNode('ResourceProperty', propertyName, {
        name: propertyName.lexeme,
        value,
      }));
    }

    this.consume(TokenType.RIGHT_BRACE, 'Se esperaba "}" al final del recurso.');
    return createNode('ResourceDeclaration', kind, {
      kind: kind.lexeme,
      name: name.lexeme,
      properties,
    });
  }

  parseFunctionDeclaration(start) {
    const name = this.consume(TokenType.IDENTIFIER, 'Se esperaba el nombre de la función.');
    this.consume(TokenType.LEFT_PAREN, 'Se esperaba "(" después del nombre de la función.');
    const parameters = [];

    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        const parameterStart = this.peek();
        const dataType = this.parseType();
        const parameterName = this.consume(
          TokenType.IDENTIFIER,
          'Se esperaba el nombre del parámetro.',
        );
        parameters.push(createNode('Parameter', parameterStart, {
          dataType,
          name: parameterName.lexeme,
        }));
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RIGHT_PAREN, 'Se esperaba ")" después de los parámetros.');
    const returnType = this.parseType();
    const body = this.parseBlock();

    return createNode('FunctionDeclaration', start, {
      name: name.lexeme,
      parameters,
      returnType,
      body,
    });
  }

  parseTaskDeclaration(start) {
    const name = this.consume(TokenType.IDENTIFIER, 'Se esperaba el nombre de la tarea.');
    const body = this.parseBlock();
    return createNode('TaskDeclaration', start, { name: name.lexeme, body });
  }

  parseMainDeclaration(start) {
    return createNode('MainDeclaration', start, { body: this.parseBlock() });
  }

  parseType() {
    const start = this.peek();
    const name = primitiveTypes.get(this.advanceIfType()?.type);

    if (!name) {
      throw this.syntaxError('Se esperaba un tipo primitivo.');
    }

    let dimensions = 0;
    while (this.match(TokenType.LEFT_BRACKET)) {
      this.consume(TokenType.RIGHT_BRACKET, 'Se esperaba "]" en el tipo de arreglo.');
      dimensions += 1;
    }

    return createNode('Type', start, { name, dimensions });
  }

  parseBlock() {
    const start = this.consume(TokenType.LEFT_BRACE, 'Se esperaba "{" para iniciar el bloque.');
    const statements = [];

    while (!this.check(TokenType.RIGHT_BRACE) && !this.check(TokenType.EOF)) {
      statements.push(this.parseStatement());
    }

    this.consume(TokenType.RIGHT_BRACE, 'Se esperaba "}" al final del bloque.');
    return createNode('BlockStatement', start, { statements });
  }

  parseStatement() {
    if (this.check(TokenType.LEFT_BRACE)) {
      return this.parseBlock();
    }
    if (this.isType(this.peek().type)) {
      return this.parseVariableDeclaration();
    }
    if (this.match(TokenType.IF)) {
      return this.parseIfStatement(this.previous());
    }
    if (this.match(TokenType.WHILE)) {
      return this.parseWhileStatement(this.previous());
    }
    if (this.match(TokenType.FOR)) {
      return this.parseForStatement(this.previous());
    }
    if (this.match(TokenType.RUN)) {
      return this.parseRunStatement(this.previous());
    }
    if (this.match(TokenType.RETURN)) {
      return this.parseReturnStatement(this.previous());
    }
    if (this.match(TokenType.BREAK)) {
      const start = this.previous();
      this.consume(TokenType.SEMICOLON, 'Se esperaba ";" después de break.');
      return createNode('BreakStatement', start);
    }
    if (this.match(TokenType.CONTINUE)) {
      const start = this.previous();
      this.consume(TokenType.SEMICOLON, 'Se esperaba ";" después de continue.');
      return createNode('ContinueStatement', start);
    }

    return this.parseExpressionOrAssignmentStatement();
  }

  parseIfStatement(start) {
    this.consume(TokenType.LEFT_PAREN, 'Se esperaba "(" después de if.');
    const condition = this.parseExpression();
    this.consume(TokenType.RIGHT_PAREN, 'Se esperaba ")" después de la condición.');
    const thenBranch = this.parseStatement();
    const elseBranch = this.match(TokenType.ELSE) ? this.parseStatement() : null;

    return createNode('IfStatement', start, { condition, thenBranch, elseBranch });
  }

  parseWhileStatement(start) {
    this.consume(TokenType.LEFT_PAREN, 'Se esperaba "(" después de while.');
    const condition = this.parseExpression();
    this.consume(TokenType.RIGHT_PAREN, 'Se esperaba ")" después de la condición.');
    const body = this.parseStatement();
    return createNode('WhileStatement', start, { condition, body });
  }

  parseForStatement(start) {
    this.consume(TokenType.LEFT_PAREN, 'Se esperaba "(" después de for.');
    let initializer = null;

    if (!this.check(TokenType.SEMICOLON)) {
      initializer = this.isType(this.peek().type)
        ? this.parseVariableDeclarationCore()
        : this.parseAssignmentOrExpressionCore();
    }
    this.consume(TokenType.SEMICOLON, 'Se esperaba ";" después de la inicialización de for.');

    const condition = this.check(TokenType.SEMICOLON) ? null : this.parseExpression();
    this.consume(TokenType.SEMICOLON, 'Se esperaba ";" después de la condición de for.');

    const update = this.check(TokenType.RIGHT_PAREN)
      ? null
      : this.parseAssignmentOrExpressionCore();
    this.consume(TokenType.RIGHT_PAREN, 'Se esperaba ")" después de las cláusulas de for.');
    const body = this.parseStatement();

    return createNode('ForStatement', start, { initializer, condition, update, body });
  }

  parseVariableDeclarationCore() {
    const start = this.peek();
    const dataType = this.parseType();
    const name = this.consume(TokenType.IDENTIFIER, 'Se esperaba el nombre de la variable.');
    const initializer = this.match(TokenType.ASSIGN) ? this.parseExpression() : null;
    return createNode('VariableDeclaration', start, {
      dataType,
      name: name.lexeme,
      initializer,
    });
  }

  parseAssignmentOrExpressionCore() {
    const start = this.peek();
    const targetOrExpression = this.parseExpression();

    if (!this.match(TokenType.ASSIGN)) {
      return createNode('ExpressionStatement', start, { expression: targetOrExpression });
    }
    if (!isAssignmentTarget(targetOrExpression)) {
      throw this.syntaxErrorAt(this.previous(), 'El lado izquierdo de una asignación no es válido.');
    }

    return createNode('AssignmentStatement', start, {
      target: targetOrExpression,
      value: this.parseExpression(),
    });
  }

  parseExpressionOrAssignmentStatement() {
    const start = this.peek();
    const expression = this.parseExpression();

    if (this.match(TokenType.ASSIGN)) {
      if (!isAssignmentTarget(expression)) {
        throw this.syntaxErrorAt(this.previous(), 'El lado izquierdo de una asignación no es válido.');
      }
      const value = this.parseExpression();
      this.consume(TokenType.SEMICOLON, 'Se esperaba ";" después de la asignación.');
      return createNode('AssignmentStatement', start, { target: expression, value });
    }

    this.consume(TokenType.SEMICOLON, 'Se esperaba ";" después de la expresión.');
    return createNode('ExpressionStatement', start, { expression });
  }

  parseRunStatement(start) {
    const task = this.consume(TokenType.IDENTIFIER, 'Se esperaba el nombre de la tarea después de run.');
    const args = this.match(TokenType.LEFT_PAREN) ? this.parseArgumentsAfterOpenParen() : [];
    this.consume(TokenType.SEMICOLON, 'Se esperaba ";" después de run.');
    return createNode('RunStatement', start, { task: task.lexeme, arguments: args });
  }

  parseReturnStatement(start) {
    const value = this.check(TokenType.SEMICOLON) ? null : this.parseExpression();
    this.consume(TokenType.SEMICOLON, 'Se esperaba ";" después de return.');
    return createNode('ReturnStatement', start, { value });
  }

  parseExpression() {
    return this.parseLogicalOr();
  }

  parseLogicalOr() {
    return this.parseBinaryExpression(
      () => this.parseLogicalAnd(),
      [TokenType.OR_OR],
    );
  }

  parseLogicalAnd() {
    return this.parseBinaryExpression(
      () => this.parseEquality(),
      [TokenType.AND_AND],
    );
  }

  parseEquality() {
    return this.parseBinaryExpression(
      () => this.parseComparison(),
      [TokenType.EQUAL_EQUAL, TokenType.BANG_EQUAL],
    );
  }

  parseComparison() {
    return this.parseBinaryExpression(
      () => this.parseTerm(),
      [
        TokenType.GREATER,
        TokenType.GREATER_EQUAL,
        TokenType.LESS,
        TokenType.LESS_EQUAL,
      ],
    );
  }

  parseTerm() {
    return this.parseBinaryExpression(
      () => this.parseFactor(),
      [TokenType.PLUS, TokenType.MINUS],
    );
  }

  parseFactor() {
    return this.parseBinaryExpression(
      () => this.parseUnary(),
      [TokenType.STAR, TokenType.SLASH, TokenType.PERCENT],
    );
  }

  parseBinaryExpression(parseOperand, operators) {
    let expression = parseOperand();

    while (this.match(...operators)) {
      const operator = this.previous();
      const right = parseOperand();
      expression = createNode('BinaryExpression', operator, {
        operator: operator.lexeme,
        left: expression,
        right,
      });
    }

    return expression;
  }

  parseUnary() {
    if (this.match(TokenType.BANG, TokenType.MINUS)) {
      const operator = this.previous();
      return createNode('UnaryExpression', operator, {
        operator: operator.lexeme,
        operand: this.parseUnary(),
      });
    }

    return this.parsePostfix();
  }

  parsePostfix() {
    let expression = this.parsePrimary();

    while (true) {
      if (this.match(TokenType.LEFT_PAREN)) {
        expression = createNode('CallExpression', this.previous(), {
          callee: expression,
          arguments: this.parseArgumentsAfterOpenParen(),
        });
      } else if (this.match(TokenType.DOT)) {
        const property = this.consume(
          TokenType.IDENTIFIER,
          'Se esperaba el nombre de la propiedad después de ".".',
        );
        expression = createNode('MemberExpression', property, {
          object: expression,
          property: property.lexeme,
        });
      } else if (this.match(TokenType.LEFT_BRACKET)) {
        const index = this.parseExpression();
        this.consume(TokenType.RIGHT_BRACKET, 'Se esperaba "]" después del índice.');
        expression = createNode('IndexExpression', this.previous(), {
          object: expression,
          index,
        });
      } else {
        return expression;
      }
    }
  }

  parseArgumentsAfterOpenParen() {
    const args = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        args.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RIGHT_PAREN, 'Se esperaba ")" después de los argumentos.');
    return args;
  }

  parsePrimary() {
    if (this.match(TokenType.INTEGER_LITERAL)) {
      const token = this.previous();
      return createNode('Literal', token, { value: Number.parseInt(token.lexeme, 10), raw: token.lexeme });
    }
    if (this.match(TokenType.FLOAT_LITERAL)) {
      const token = this.previous();
      return createNode('Literal', token, { value: Number.parseFloat(token.lexeme), raw: token.lexeme });
    }
    if (this.match(TokenType.STRING_LITERAL)) {
      const token = this.previous();
      return createNode('Literal', token, { value: decodeString(token.lexeme), raw: token.lexeme });
    }
    if (this.match(TokenType.TRUE, TokenType.FALSE)) {
      const token = this.previous();
      return createNode('Literal', token, { value: token.type === TokenType.TRUE, raw: token.lexeme });
    }
    if (this.match(TokenType.IDENTIFIER)) {
      const token = this.previous();
      return createNode('Identifier', token, { name: token.lexeme });
    }
    if (this.match(TokenType.LEFT_BRACKET)) {
      const start = this.previous();
      const elements = this.check(TokenType.RIGHT_BRACKET)
        ? []
        : this.parseArrayElements();
      this.consume(TokenType.RIGHT_BRACKET, 'Se esperaba "]" al final del arreglo.');
      return createNode('ArrayExpression', start, { elements });
    }
    if (this.match(TokenType.LEFT_PAREN)) {
      const expression = this.parseExpression();
      this.consume(TokenType.RIGHT_PAREN, 'Se esperaba ")" después de la expresión.');
      return expression;
    }

    throw this.syntaxError('Se esperaba una expresión.');
  }

  parseArrayElements() {
    const elements = [];
    do {
      elements.push(this.parseExpression());
    } while (this.match(TokenType.COMMA));
    return elements;
  }

  advanceIfType() {
    if (!this.isType(this.peek().type)) {
      return null;
    }
    return this.advance();
  }

  isType(type) {
    return primitiveTypes.has(type);
  }

  consume(type, message) {
    if (this.check(type)) {
      return this.advance();
    }
    throw this.syntaxError(message);
  }

  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  check(type) {
    return this.peek().type === type;
  }

  advance() {
    if (!this.check(TokenType.EOF)) {
      this.current += 1;
    }
    return this.previous();
  }

  peek() {
    return this.tokens[this.current];
  }

  previous() {
    return this.tokens[this.current - 1];
  }

  syntaxError(message) {
    return this.syntaxErrorAt(this.peek(), message);
  }

  syntaxErrorAt(token, message) {
    return new ParserSyntaxError(message, token);
  }
}

class ParserSyntaxError extends Error {
  constructor(message, token) {
    const found = token.type === TokenType.EOF ? 'fin del archivo' : `"${token.lexeme}"`;
    super(`${message} Se encontró ${found}.`);
    this.type = 'syntactic';
    this.line = token.line;
    this.column = token.column;
    this.lexeme = token.lexeme;
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

function createNode(type, token, properties = {}) {
  return {
    type,
    ...properties,
    line: token.line,
    column: token.column,
  };
}

function isAssignmentTarget(expression) {
  if (expression.type === 'Identifier') {
    return true;
  }
  if (expression.type === 'MemberExpression' || expression.type === 'IndexExpression') {
    return isAssignmentTarget(expression.object);
  }
  return false;
}

function decodeString(lexeme) {
  return lexeme.slice(1, -1).replace(/\\(["\\nt])/g, (_, escape) => ({
    '"': '"',
    '\\': '\\',
    n: '\n',
    t: '\t',
  })[escape]);
}
