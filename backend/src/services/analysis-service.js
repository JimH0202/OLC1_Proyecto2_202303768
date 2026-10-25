import { Lexer } from '../lexer/lexer.js';
import { Parser } from '../parser/parser.js';
import { AnalysisResult } from '../models/analysis-result.js';

export function analyzeSource(source) {
  const { tokens, errors: lexicalErrors } = new Lexer(source).scan();

  if (lexicalErrors.length > 0) {
    return new AnalysisResult({
      tokens,
      errors: lexicalErrors,
      ast: null,
    });
  }

  const { ast, errors: syntacticErrors } = new Parser(tokens).parse();

  return new AnalysisResult({
    tokens,
    errors: syntacticErrors,
    ast,
  });
}
