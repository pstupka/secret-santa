import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';

import config from '@config/config';
import AppError from '@core/utils/appError';
import logger from '@core/utils/logger';

const apiKey = (req: Request, res: Response, next: NextFunction) => {
  const xApiKey = req.header('x-api-key')?.trim();
  const token: string = config.xApiKey;
  if (token && xApiKey === token.trim()) {
    return next();
  }
  logger.error(
    'Missing x-api-key in request header or it does not match with env variable',
  );
  throw new AppError(httpStatus.UNAUTHORIZED, 'Access forbidden');
};

export default apiKey;
