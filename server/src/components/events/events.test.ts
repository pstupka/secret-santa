import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { agent as request } from 'supertest';
import httpStatus from 'http-status';

import { hashMagicToken } from '@components/auth/magicToken';
import {
  PUBLIC_LIMIT_PER_EMAIL,
  PUBLIC_LIMIT_PER_IP,
} from '@core/middlewares/rateLimit.middleware';
import { createTestContext, magicTokenFrom, TestContext } from '@test/harness';

const newEvent = (overrides: Record<string, unknown> = {}) => ({
  title: 'Wigilia 2026',
  description: 'Rodzinne Mikołajki',
  budgetAmount: 15000,
  budgetCurrency: 'PLN',
  rules: 'Bez skarpetek.',
  timezone: 'Europe/Warsaw',
  exchangeOn: '2026-12-24',
  organizerName: 'Ania',
  organizerEmail: 'ania@example.com',
  ...overrides,
});

describe('Events API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(() => ctx.close());

  const createEvent = (body: object, ip = '203.0.113.1') =>
    request(ctx.app).post('/api/events').set('X-Forwarded-For', ip).send(body);

  describe('POST /api/events', () => {
    test('creates an open event and returns it without the magic token', async () => {
      const res = await createEvent(newEvent()).expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.any(String),
        title: 'Wigilia 2026',
        description: 'Rodzinne Mikołajki',
        budgetAmount: 15000,
        budgetCurrency: 'PLN',
        rules: 'Bez skarpetek.',
        timezone: 'Europe/Warsaw',
        exchangeOn: '2026-12-24',
        status: 'open',
        drawnAt: null,
        createdAt: ctx.clock.now().toISOString(),
        updatedAt: ctx.clock.now().toISOString(),
      });

      await ctx.sendEmails();
      const token = magicTokenFrom(ctx.mailer.sent[0]);
      expect(JSON.stringify(res.body)).not.toContain(token);
    });

    test('emails the organizer a personal link whose magic token authenticates GET /me', async () => {
      await createEvent(newEvent()).expect(httpStatus.CREATED);

      expect(await ctx.sendEmails()).toBe(1);
      const [email] = ctx.mailer.sent;
      expect(email.to).toBe('ania@example.com');
      expect(email.subject).toContain('Wigilia 2026');

      const me = await request(ctx.app)
        .get('/api/me')
        .set('Authorization', `Bearer ${magicTokenFrom(email)}`)
        .expect(httpStatus.OK);
      expect(me.body).toEqual({
        id: expect.any(String),
        email: 'ania@example.com',
      });
    });

    test('makes the person the active organizer participant', async () => {
      const res = await createEvent(
        newEvent({ organizerEmail: ' Ania@Example.com ' }),
      ).expect(httpStatus.CREATED);

      const person = await ctx.db
        .selectFrom('persons')
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(person.email).toBe('ania@example.com');

      const participants = await ctx.db
        .selectFrom('participants')
        .selectAll()
        .execute();
      expect(participants).toEqual([
        expect.objectContaining({
          event_id: res.body.id,
          person_id: person.id,
          managed_by_participant_id: null,
          display_name: 'Ania',
          role: 'organizer',
          status: 'active',
        }),
      ]);
    });

    test('stores only the hash of the magic token, valid for one year', async () => {
      await createEvent(newEvent()).expect(httpStatus.CREATED);
      await ctx.sendEmails();
      const token = magicTokenFrom(ctx.mailer.sent[0]);

      const stored = await ctx.db
        .selectFrom('access_tokens')
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(stored.token_hash).toBe(hashMagicToken(token));
      expect(stored.token_hash).not.toContain(token);
      expect(stored.created_at).toBe('2026-11-01T12:00:00.000Z');
      expect(stored.expires_at).toBe('2027-11-01T12:00:00.000Z');
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    });

    test('reuses the existing person for a known organizer email', async () => {
      await createEvent(newEvent()).expect(httpStatus.CREATED);
      await createEvent(
        newEvent({ title: 'Sylwester', organizerEmail: 'ANIA@example.com' }),
      ).expect(httpStatus.CREATED);

      const persons = await ctx.db.selectFrom('persons').selectAll().execute();
      expect(persons).toHaveLength(1);
      const organizers = await ctx.db
        .selectFrom('participants')
        .select('person_id')
        .execute();
      expect(organizers).toEqual([
        { person_id: persons[0].id },
        { person_id: persons[0].id },
      ]);
    });

    test('accepts an event without optional fields', async () => {
      const res = await createEvent({
        title: 'Wigilia',
        description: '   ',
        timezone: 'UTC',
        exchangeOn: '2026-11-01',
        organizerName: 'Ania',
        organizerEmail: 'ania@example.com',
      }).expect(httpStatus.CREATED);

      expect(res.body).toMatchObject({
        description: null,
        budgetAmount: null,
        budgetCurrency: null,
        rules: null,
      });
    });

    test.each([
      ['a missing title', { title: undefined }],
      ['an invalid organizer email', { organizerEmail: 'not-an-email' }],
      ['an unknown timezone', { timezone: 'Europe/Atlantis' }],
      ['an impossible exchange date', { exchangeOn: '2026-02-30' }],
      ['a non-date exchange date', { exchangeOn: '24.12.2026' }],
      ['a past exchange date', { exchangeOn: '2026-10-31' }],
      ['a budget amount without currency', { budgetCurrency: undefined }],
      ['a fractional budget amount', { budgetAmount: 150.5 }],
    ])('rejects %s with 400 and creates nothing', async (_case, overrides) => {
      await createEvent(newEvent(overrides)).expect(httpStatus.BAD_REQUEST);

      expect(await ctx.db.selectFrom('events').selectAll().execute()).toEqual(
        [],
      );
      expect(await ctx.sendEmails()).toBe(0);
    });

    test('limits requests per organizer email', async () => {
      for (let i = 0; i < PUBLIC_LIMIT_PER_EMAIL; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await createEvent(newEvent(), `203.0.113.${i + 1}`).expect(
          httpStatus.CREATED,
        );
      }

      await createEvent(newEvent(), '203.0.113.99').expect(
        httpStatus.TOO_MANY_REQUESTS,
      );
      // Other emails are unaffected.
      await createEvent(
        newEvent({ organizerEmail: 'tomek@example.com' }),
        '203.0.113.99',
      ).expect(httpStatus.CREATED);

      // The window slides: an hour later the email may be used again.
      ctx.clock.set('2026-11-01T13:00:00.001Z');
      await createEvent(newEvent(), '203.0.113.99').expect(httpStatus.CREATED);
    });

    test('limits requests per IP', async () => {
      for (let i = 0; i < PUBLIC_LIMIT_PER_IP; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await createEvent(
          newEvent({ organizerEmail: `person${i}@example.com` }),
        ).expect(httpStatus.CREATED);
      }

      const res = await createEvent(
        newEvent({ organizerEmail: 'another@example.com' }),
      ).expect(httpStatus.TOO_MANY_REQUESTS);
      expect(res.headers['retry-after']).toBe('3600');

      await createEvent(
        newEvent({ organizerEmail: 'another@example.com' }),
        '198.51.100.7',
      ).expect(httpStatus.CREATED);
    });
  });
});
