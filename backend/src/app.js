import cors from 'cors';
import express from 'express';
import { apiRouter } from './api/routes.js';

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiRouter);

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
