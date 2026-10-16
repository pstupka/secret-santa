import { describe, test, expect, vi } from 'vitest';
import httpMocks from 'node-mocks-http';
import httpStatus from 'http-status';
import { Response } from 'express';

import errorHandler from '@core/utils/errorHandler';
import errorHandling from './errorHandling.middleware';

describe('Error middleware', () => {
  test('should delegate error to the centralized error handler and send 500 response', () => {
    const error: Error = new Error('Very sophisticated error');
    const res: Response = httpMocks.createResponse();
    const statusSpy = vi.spyOn(res, 'status');
    const errorHandlerSpy = vi.spyOn(errorHandler, 'handleError');
    const next = vi.fn();

    errorHandling(error, httpMocks.createRequest(), res, next);

    expect(statusSpy).toHaveBeenCalledWith(httpStatus.INTERNAL_SERVER_ERROR);
    expect(errorHandlerSpy).toHaveBeenCalledWith(error);
  });
});
