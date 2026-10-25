export class AnalysisResult {
  constructor({ tokens, errors, ast }) {
    this.tokens = tokens;
    this.errors = errors;
    this.ast = ast;
    this.success = errors.length === 0;
  }

  toJSON() {
    return {
      success: this.success,
      tokens: this.tokens,
      errors: this.errors,
      ast: this.ast,
    };
  }
}
