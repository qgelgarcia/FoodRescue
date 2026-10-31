import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.routes.js';
import { chatRouter } from './routes/chat.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CLIENT_URL || 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5175,http://localhost:5175')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin is not allowed by the FoodRescue API'));
  },
  credentials: true
}));

app.use('/api/chat', express.json({ limit: '16kb' }));
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api', healthRouter);
app.use('/api/chat', chatRouter);

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'FoodRescue API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      conversations: '/api/chat/conversations'
    }
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'The requested API route does not exist.'
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const status = 'status' in err && [400, 413].includes(Number(err.status)) ? Number(err.status) : 500;
  console.error('[Backend Error]', status);
  res.status(status).json({
    success: false,
    error: status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 400 ? 'INVALID_JSON' : 'INTERNAL_ERROR',
    message: status === 413 ? 'The request is too large.' : status === 400 ? 'Send valid JSON.' : 'The request could not be completed.'
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(Number(PORT), process.env.HOST || '127.0.0.1', () => {
    console.log(`FoodRescue backend server running on http://localhost:${PORT}`);
  });
}

export default app;
