import { Lexer } from '../lexer/lexer.js';
import { Parser } from '../parser/parser.js';
import { Interpreter } from '../interpreter/interpreter.js';
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

export function executeSource(source) {
  const analysis = analyzeSource(source);
  if (!analysis.success) {
    return {
      success: false,
      analysis,
      execution: {
        status: 'not_run',
        success: false,
        console: [],
        log: [],
        errors: [],
        infrastructure: emptyInfrastructure(),
      },
    };
  }

  const result = new Interpreter().interpret(analysis.ast);
  const infrastructure = emptyInfrastructure();
  for (const resource of result.resources) {
    const collection = `${resource.kind}s`;
    infrastructure[collection].push(resource);
  }

  const execution = {
    status: result.success ? 'completed' : 'failed',
    success: result.success,
    console: result.console,
    log: result.log,
    errors: result.errors,
    infrastructure,
  };

  return {
    success: result.success,
    analysis,
    execution,
  };
}

function emptyInfrastructure() {
  return {
    servers: [],
    services: [],
    databases: [],
  };
}
