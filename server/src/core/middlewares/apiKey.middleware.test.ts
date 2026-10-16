import { describe, test, expect, vi } from 'vitest';
import httpMocks from 'node-mocks-http';
import { Response, Request, NextFunction } from 'express';

import config from '@config/config';
import protectedByApiKey from './apiKey.middleware';

vi.mock('@config/config', () => ({
  __esModule: true,
  default: { xApiKey: 'test-api-key' },
}));

describe('protectedByApiKey middleware', () => {
  test('should call next middleware in the stack if provided correct api key in the headers', () => {
    const next: NextFunction = vi.fn();
    const res: Response = httpMocks.createResponse();
    const req: Request = httpMocks.createRequest({
      headers: { 'x-api-key': config.xApiKey },
    });

    protectedByApiKey(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('should throw Acccess forbiden exception if no api key in the headers', () => {
    const next: NextFunction = vi.fn();
    const res: Response = httpMocks.createResponse();
    const req: Request = httpMocks.createRequest();

    const executeProtectedByApiKey = () => protectedByApiKey(req, res, next);

    expect(executeProtectedByApiKey).toThrow('Access forbidden');
  });

  test('should throw Acccess forbiden exception if wrong api key in the headers', () => {
    const next: NextFunction = vi.fn();
    const res: Response = httpMocks.createResponse();
    const req: Request = httpMocks.createRequest({
      headers: { 'x-api-key': 'incorrect-token' },
    });

    const executeProtectedByApiKey = () => protectedByApiKey(req, res, next);

    expect(executeProtectedByApiKey).toThrow('Access forbidden');
  });
});
