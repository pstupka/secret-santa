import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { agent as request } from 'supertest';
import httpStatus from 'http-status';

import { PUBLIC_LIMIT_PER_EMAIL } from '@core/middlewares/rateLimit.middleware';
import {
  createTestContext,
  magicTokenFrom,
  signIn,
  TestContext,
} from '@test/harness';
import { ACCESS_LINK_RESPONSE } from './access.controller';
import { hashMagicToken } from './magicToken';

describe('Access API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(() => ctx.close());

  const getMe = (token?: string) => {
    const req = request(ctx.app).get('/api/me');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const requestAccessLink = (email: string, ip = '203.0.113.1') =>
    request(ctx.app)
      .post('/api/access-links')
      .set('X-Forwarded-For', ip)
      .send({ email });

  describe('GET /api/me', () => {
    test('returns the person a magic token identifies', async () => {
      const { personId, token } = await signIn(ctx, 'ania@example.com');

      const res = await getMe(token).expect(httpStatus.OK);

      expect(res.body).toEqual({ id: personId, email: 'ania@example.com' });
    });

    test('records when the magic token was last used', async () => {
      const { token } = await signIn(ctx, 'ania@example.com');
      ctx.clock.set('2026-11-20T08:00:00.000Z');

      await getMe(token).expect(httpStatus.OK);

      const stored = await ctx.db
        .selectFrom('access_tokens')
        .select('last_used_at')
        .where('token_hash', '=', hashMagicToken(token))
        .executeTakeFirstOrThrow();
      expect(stored.last_used_at).toBe('2026-11-20T08:00:00.000Z');
    });

    test('rejects a request without a magic token', async () => {
      await getMe().expect(httpStatus.UNAUTHORIZED);
      await request(ctx.app)
        .get('/api/me')
        .set('Authorization', 'Basic abc')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('rejects an unknown magic token', async () => {
      await signIn(ctx, 'ania@example.com');

      await getMe('not-a-real-token').expect(httpStatus.UNAUTHORIZED);
    });

    test('rejects an expired magic token', async () => {
      const { token } = await signIn(ctx, 'ania@example.com');
      ctx.clock.set('2027-11-01T11:59:59.999Z');
      await getMe(token).expect(httpStatus.OK);

      ctx.clock.set('2027-11-01T12:00:00.000Z');
      await getMe(token).expect(httpStatus.UNAUTHORIZED);
    });

    test('rejects a revoked magic token', async () => {
      const { token } = await signIn(ctx, 'ania@example.com');
      await ctx.db
        .updateTable('access_tokens')
        .set({ revoked_at: '2026-11-01T12:00:00.000Z' })
        .execute();

      await getMe(token).expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /api/access-links', () => {
    test('emails a known person an additional personal link', async () => {
      const { token: oldToken } = await signIn(ctx, 'ania@example.com');

      const res = await requestAccessLink('Ania@Example.com').expect(
        httpStatus.ACCEPTED,
      );
      expect(res.body).toEqual(ACCESS_LINK_RESPONSE);

      expect(await ctx.sendEmails()).toBe(1);
      const [email] = ctx.mailer.sent;
      expect(email.to).toBe('ania@example.com');
      const newToken = magicTokenFrom(email);
      expect(newToken).not.toBe(oldToken);

      await getMe(newToken).expect(httpStatus.OK);
      // Old personal links keep working (ADR-0001).
      await getMe(oldToken).expect(httpStatus.OK);
    });

    test('answers the same for an unknown email and sends nothing', async () => {
      const res = await requestAccessLink('stranger@example.com').expect(
        httpStatus.ACCEPTED,
      );

      expect(res.body).toEqual(ACCESS_LINK_RESPONSE);
      expect(await ctx.sendEmails()).toBe(0);
      expect(await ctx.db.selectFrom('persons').selectAll().execute()).toEqual(
        [],
      );
      expect(
        await ctx.db.selectFrom('access_tokens').selectAll().execute(),
      ).toEqual([]);
    });

    test('rejects an invalid email with 400', async () => {
      await requestAccessLink('not-an-email').expect(httpStatus.BAD_REQUEST);
    });

    test('limits requests per target email', async () => {
      await signIn(ctx, 'ania@example.com');

      for (let i = 0; i < PUBLIC_LIMIT_PER_EMAIL; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await requestAccessLink(
          'ania@example.com',
          `203.0.113.${i + 1}`,
        ).expect(httpStatus.ACCEPTED);
      }

      await requestAccessLink('ANIA@example.com', '203.0.113.99').expect(
        httpStatus.TOO_MANY_REQUESTS,
      );
      expect(await ctx.sendEmails()).toBe(PUBLIC_LIMIT_PER_EMAIL);
    });
  });
});
