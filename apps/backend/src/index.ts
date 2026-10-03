import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CLIENT_URL || 'http://127.0.0.1:5173')
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

app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api', healthRouter);

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'FoodRescue API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health'
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
  console.error('[Backend Error]:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`FoodRescue backend server running on http://localhost:${PORT}`);
  });
}

export default app;
