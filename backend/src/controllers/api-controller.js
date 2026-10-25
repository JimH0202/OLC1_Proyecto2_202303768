import { analyzeSource, executeSource } from '../services/analysis-service.js';

export function getHealth(_request, response) {
  response.json({ status: 'ok' });
}

export function testConnection(request, response) {
  const { source } = request.body ?? {};

  if (typeof source !== 'string') {
    return response.status(400).json({
      success: false,
      message: "El campo 'source' debe ser una cadena.",
    });
  }

  return response.json({
    success: true,
    received: true,
    sourceLength: source.length,
    message: 'El backend recibió el código fuente.',
  });
}

export function analyze(request, response) {
  const { source } = request.body ?? {};

  if (typeof source !== 'string') {
    return response.status(400).json({
      success: false,
      message: "El campo 'source' debe ser una cadena.",
    });
  }

  const analysis = analyzeSource(source).toJSON();
  return response.json({
    success: analysis.success,
    analysis,
    execution: null,
  });
}

export function execute(request, response) {
  const { source } = request.body ?? {};

  if (typeof source !== 'string') {
    return response.status(400).json({
      success: false,
      message: "El campo 'source' debe ser una cadena.",
    });
  }

  const result = executeSource(source);
  return response.json({
    success: result.success,
    analysis: result.analysis.toJSON(),
    execution: result.execution,
  });
}
