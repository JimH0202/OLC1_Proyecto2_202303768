import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/api/connection-test', (request, response) => {
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
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({
      success: false,
      message: 'El cuerpo de la solicitud debe contener JSON válido.',
    });
  }

  console.error(error);
  return response.status(500).json({
    success: false,
    message: 'Error interno del servidor.',
  });
});

app.listen(port, () => {
  console.log(`AutoInfra API escuchando en http://localhost:${port}`);
});
