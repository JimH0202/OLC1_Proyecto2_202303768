import { Router } from 'express';
import {
  analyze,
  getHealth,
  testConnection,
} from '../controllers/api-controller.js';

export const apiRouter = Router();

apiRouter.get('/health', getHealth);
apiRouter.post('/connection-test', testConnection);
apiRouter.post('/analyze', analyze);
