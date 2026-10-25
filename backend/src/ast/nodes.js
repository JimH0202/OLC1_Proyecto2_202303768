export const AST_NODE_TYPES = Object.freeze([
  'Program',
  'Type',
  'Literal',
  'Identifier',
  'ArrayExpression',
  'UnaryExpression',
  'BinaryExpression',
  'CallExpression',
  'MemberExpression',
  'IndexExpression',
  'VariableDeclaration',
  'ResourceProperty',
  'ResourceDeclaration',
  'Parameter',
  'FunctionDeclaration',
  'TaskDeclaration',
  'MainDeclaration',
  'BlockStatement',
  'ExpressionStatement',
  'AssignmentStatement',
  'RunStatement',
  'ReturnStatement',
  'BreakStatement',
  'ContinueStatement',
  'IfStatement',
  'WhileStatement',
  'ForStatement',
]);

const astNodeTypes = new Set(AST_NODE_TYPES);

export function createAstNode(type, token, properties = {}) {
  if (!astNodeTypes.has(type)) {
    throw new TypeError(`Tipo de nodo AST inválido: ${type}`);
  }
  if (!token || !Number.isInteger(token.line) || token.line < 1
    || !Number.isInteger(token.column) || token.column < 1) {
    throw new TypeError('El nodo AST requiere una ubicación válida de origen.');
  }

  return {
    type,
    ...properties,
    line: token.line,
    column: token.column,
  };
}
