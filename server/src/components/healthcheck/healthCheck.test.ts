import { describe, test, beforeAll, afterAll } from 'vitest';
import { agent as request } from 'supertest';
import httpStatus from 'http-status';

import { createTestContext, TestContext } from '@test/harness';

describe('Healthcheck API', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(() => ctx.close());

  describe('GET /api/health', () => {
    test('should return 200 status if all OK', async () => {
      await request(ctx.app).get('/api/health').send().expect(httpStatus.OK);
    });
  });
});
