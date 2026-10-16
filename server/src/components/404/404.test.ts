import { describe, test, beforeAll, afterAll } from 'vitest';
// test base func
import { agent as request } from 'supertest';
import httpStatus from 'http-status';

import { createTestContext, TestContext } from '@test/harness';

describe('Bad requests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(() => ctx.close());

  test('should return 404 if no resource', async () => {
    await request(ctx.app)
      .get('/404/not-found-url')
      .send()
      .expect(httpStatus.NOT_FOUND);
  });
});
