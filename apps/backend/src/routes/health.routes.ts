import { Router, Request, Response } from 'express';
import { ApiResponse } from '@foodrescue/shared';

export const healthRouter = Router();

healthRouter.get('/health', (req: Request, res: Response) => {
  const response: ApiResponse<{ timestamp: string; service: string }> = {
    success: true,
    message: 'FoodRescue Backend API is running healthy',
    data: {
      timestamp: new Date().toISOString(),
      service: 'foodrescue-backend'
    }
  };
  res.json(response);
});
