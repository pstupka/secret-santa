import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { agent as request } from 'supertest';
import httpStatus from 'http-status';

import { hashMagicToken } from '@components/auth/magicToken';
import {
  PUBLIC_LIMIT_PER_EMAIL,
  PUBLIC_LIMIT_PER_IP,
} from '@core/middlewares/rateLimit.middleware';
import { ParticipantStatus } from '@db/schema';
import newId from '@shared/ids';
import {
  createTestContext,
  magicTokenFrom,
  signIn,
  TestContext,
} from '@test/harness';

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

  // Creates an event through the API; returns it with the organizer's token.
  const organizeEvent = async (overrides: Record<string, unknown> = {}) => {
    const body = newEvent(overrides);
    const res = await createEvent(body).expect(httpStatus.CREATED);
    const { token } = await signIn(ctx, body.organizerEmail as string);
    return { eventId: res.body.id as string, organizerToken: token };
  };

  // Adds an invited member participant directly (no participants API yet).
  const addMember = async (
    eventId: string,
    email: string,
    displayName: string,
    status: ParticipantStatus = 'active',
  ) => {
    const { personId, token } = await signIn(ctx, email);
    const participantId = newId();
    const now = ctx.clock.now().toISOString();
    await ctx.db
      .insertInto('participants')
      .values({
        id: participantId,
        event_id: eventId,
        person_id: personId,
        managed_by_participant_id: null,
        display_name: displayName,
        role: 'member',
        status,
        added_at: now,
        invite_sent_at: now,
      })
      .execute();
    return { participantId, token };
  };

  const getEvent = (eventId: string, token: string) =>
    request(ctx.app)
      .get(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${token}`);

  const patchEvent = (eventId: string, token: string, body: object) =>
    request(ctx.app)
      .patch(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const deleteEvent = (eventId: string, token: string) =>
    request(ctx.app)
      .delete(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${token}`);

  const storedEvent = (eventId: string) =>
    ctx.db
      .selectFrom('events')
      .selectAll()
      .where('id', '=', eventId)
      .executeTakeFirst();

  describe('GET /api/events', () => {
    test('requires a magic token', async () => {
      await request(ctx.app).get('/api/events').expect(httpStatus.UNAUTHORIZED);
    });

    test("lists the person's events with their role and participant status", async () => {
      const wigilia = await organizeEvent();
      const sylwester = await organizeEvent({
        title: 'Sylwester',
        exchangeOn: '2026-12-31',
        organizerName: 'Tomek',
        organizerEmail: 'tomek@example.com',
      });
      const ania = await signIn(ctx, 'ania@example.com');
      const { participantId } = await addMember(
        sylwester.eventId,
        'ania@example.com',
        'Ania',
        'declined',
      );
      // An event Ania does not participate in.
      await organizeEvent({
        title: 'Mikołajki',
        organizerEmail: 'ola@example.com',
      });

      const res = await request(ctx.app)
        .get('/api/events')
        .set('Authorization', `Bearer ${ania.token}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual([
        expect.objectContaining({
          id: wigilia.eventId,
          title: 'Wigilia 2026',
          exchangeOn: '2026-12-24',
          status: 'open',
          myParticipant: {
            id: expect.any(String),
            role: 'organizer',
            status: 'active',
          },
        }),
        expect.objectContaining({
          id: sylwester.eventId,
          title: 'Sylwester',
          myParticipant: {
            id: participantId,
            role: 'member',
            status: 'declined',
          },
        }),
      ]);
    });

    test('returns an empty list for a person without events', async () => {
      const { token } = await signIn(ctx, 'ola@example.com');
      const res = await request(ctx.app)
        .get('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .expect(httpStatus.OK);
      expect(res.body).toEqual([]);
    });

    test('shows events past their exchange date as finished', async () => {
      const { organizerToken } = await organizeEvent();
      ctx.clock.set('2026-12-25T12:00:00.000Z');

      const res = await request(ctx.app)
        .get('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(httpStatus.OK);
      expect(res.body[0].status).toBe('finished');
    });
  });

  describe('GET /api/events/:eventId', () => {
    test('shows a participant the event details and participant names and statuses', async () => {
      const { eventId } = await organizeEvent();
      const tomek = await addMember(eventId, 'tomek@example.com', 'Tomek');
      const ola = await addMember(
        eventId,
        'ola@example.com',
        'Ola',
        'declined',
      );

      const res = await getEvent(eventId, tomek.token).expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: eventId,
        title: 'Wigilia 2026',
        description: 'Rodzinne Mikołajki',
        budgetAmount: 15000,
        budgetCurrency: 'PLN',
        rules: 'Bez skarpetek.',
        timezone: 'Europe/Warsaw',
        exchangeOn: '2026-12-24',
        status: 'open',
        drawnAt: null,
        createdAt: '2026-11-01T12:00:00.000Z',
        updatedAt: '2026-11-01T12:00:00.000Z',
        myParticipant: {
          id: tomek.participantId,
          role: 'member',
          status: 'active',
        },
        participants: [
          {
            id: expect.any(String),
            displayName: 'Ania',
            role: 'organizer',
            status: 'active',
          },
          {
            id: tomek.participantId,
            displayName: 'Tomek',
            role: 'member',
            status: 'active',
          },
          {
            id: ola.participantId,
            displayName: 'Ola',
            role: 'member',
            status: 'declined',
          },
        ],
      });
      // Names and statuses only: no emails or invitation state.
      expect(JSON.stringify(res.body)).not.toContain('@example.com');
    });

    test('shows the organizer their organizer participant', async () => {
      const { eventId, organizerToken } = await organizeEvent();

      const res = await getEvent(eventId, organizerToken).expect(httpStatus.OK);

      expect(res.body.myParticipant).toEqual({
        id: res.body.participants[0].id,
        role: 'organizer',
        status: 'active',
      });
    });

    test('requires a magic token', async () => {
      const { eventId } = await organizeEvent();
      await request(ctx.app)
        .get(`/api/events/${eventId}`)
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('hides the event from a non-participant behind the same 404 as an unknown event', async () => {
      const { eventId } = await organizeEvent();
      const outsider = await signIn(ctx, 'ola@example.com');

      const hidden = await getEvent(eventId, outsider.token).expect(
        httpStatus.NOT_FOUND,
      );
      const unknown = await getEvent(newId(), outsider.token).expect(
        httpStatus.NOT_FOUND,
      );
      expect(hidden.body).toEqual(unknown.body);
    });

    describe('finished status across the timezone boundary', () => {
      // Warsaw is UTC+1 in December: 23:00 UTC on the exchange date is
      // already the next day there.
      test.each([
        ['2026-12-24T22:59:59.999Z', 'open'],
        ['2026-12-24T23:00:00.000Z', 'finished'],
      ])(
        'at %s an exchange date of 2026-12-24 in Warsaw is %s',
        async (now, status) => {
          const { eventId, organizerToken } = await organizeEvent();
          ctx.clock.set(now);

          const res = await getEvent(eventId, organizerToken).expect(
            httpStatus.OK,
          );
          expect(res.body.status).toBe(status);
        },
      );

      test('the same instant is still the exchange date in UTC', async () => {
        const { eventId, organizerToken } = await organizeEvent({
          timezone: 'UTC',
        });
        ctx.clock.set('2026-12-24T23:00:00.000Z');

        const res = await getEvent(eventId, organizerToken).expect(
          httpStatus.OK,
        );
        expect(res.body.status).toBe('open');
      });

      test('a drawn event becomes finished too', async () => {
        const { eventId, organizerToken } = await organizeEvent();
        await ctx.db
          .updateTable('events')
          .set({ status: 'drawn', drawn_at: '2026-12-01T12:00:00.000Z' })
          .execute();

        ctx.clock.set('2026-12-24T22:59:59.999Z');
        expect(
          (await getEvent(eventId, organizerToken).expect(httpStatus.OK)).body
            .status,
        ).toBe('drawn');
        ctx.clock.set('2026-12-24T23:00:00.000Z');
        expect(
          (await getEvent(eventId, organizerToken).expect(httpStatus.OK)).body
            .status,
        ).toBe('finished');
      });
    });
  });

  describe('PATCH /api/events/:eventId', () => {
    test('lets the organizer edit details and dates', async () => {
      const { eventId, organizerToken } = await organizeEvent();
      ctx.clock.set('2026-11-02T08:00:00.000Z');

      const res = await patchEvent(eventId, organizerToken, {
        title: ' Wigilia u babci ',
        budgetAmount: 20000,
        budgetCurrency: 'eur',
        timezone: 'Europe/London',
        exchangeOn: '2026-12-23',
      }).expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: eventId,
        title: 'Wigilia u babci',
        description: 'Rodzinne Mikołajki',
        budgetAmount: 20000,
        budgetCurrency: 'EUR',
        rules: 'Bez skarpetek.',
        timezone: 'Europe/London',
        exchangeOn: '2026-12-23',
        status: 'open',
        drawnAt: null,
        createdAt: '2026-11-01T12:00:00.000Z',
        updatedAt: '2026-11-02T08:00:00.000Z',
      });
      expect(await storedEvent(eventId)).toMatchObject({
        title: 'Wigilia u babci',
        budget_amount: 20000,
        budget_currency: 'EUR',
        timezone: 'Europe/London',
        exchange_on: '2026-12-23',
        updated_at: '2026-11-02T08:00:00.000Z',
      });
    });

    test('clears optional fields with null or blank text', async () => {
      const { eventId, organizerToken } = await organizeEvent();

      const res = await patchEvent(eventId, organizerToken, {
        description: '  ',
        rules: null,
        budgetAmount: null,
        budgetCurrency: null,
      }).expect(httpStatus.OK);

      expect(res.body).toMatchObject({
        title: 'Wigilia 2026',
        description: null,
        rules: null,
        budgetAmount: null,
        budgetCurrency: null,
      });
    });

    test('is allowed after the draw', async () => {
      const { eventId, organizerToken } = await organizeEvent();
      await ctx.db.updateTable('events').set({ status: 'drawn' }).execute();

      const res = await patchEvent(eventId, organizerToken, {
        rules: 'Do 200 zł.',
      }).expect(httpStatus.OK);
      expect(res.body).toMatchObject({ rules: 'Do 200 zł.', status: 'drawn' });
    });

    test('forbids a member with 403', async () => {
      const { eventId } = await organizeEvent();
      const tomek = await addMember(eventId, 'tomek@example.com', 'Tomek');

      await patchEvent(eventId, tomek.token, { title: 'Moje' }).expect(
        httpStatus.FORBIDDEN,
      );
      expect((await storedEvent(eventId))?.title).toBe('Wigilia 2026');
    });

    test('hides the event from a non-participant with 404', async () => {
      const { eventId } = await organizeEvent();
      const outsider = await signIn(ctx, 'ola@example.com');

      await patchEvent(eventId, outsider.token, { title: 'Moje' }).expect(
        httpStatus.NOT_FOUND,
      );
    });

    test('rejects edits to a finished event with 409', async () => {
      const { eventId, organizerToken } = await organizeEvent();
      ctx.clock.set('2026-12-24T23:00:00.000Z');

      await patchEvent(eventId, organizerToken, {
        exchangeOn: '2026-12-31',
      }).expect(httpStatus.CONFLICT);
      expect((await storedEvent(eventId))?.exchange_on).toBe('2026-12-24');
    });

    test.each([
      ['an empty body', {}],
      ['a blank title', { title: '  ' }],
      ['an unknown field', { organizerEmail: 'ola@example.com' }],
      ['an unknown timezone', { timezone: 'Europe/Atlantis' }],
      ['an impossible exchange date', { exchangeOn: '2026-02-30' }],
      ['a past exchange date', { exchangeOn: '2026-10-31' }],
      ['a budget amount without currency', { budgetAmount: 100 }],
      [
        'a budget cleared only in part',
        { budgetAmount: null, budgetCurrency: 'PLN' },
      ],
    ])('rejects %s with 400', async (_case, body) => {
      const { eventId, organizerToken } = await organizeEvent();

      await patchEvent(eventId, organizerToken, body).expect(
        httpStatus.BAD_REQUEST,
      );
      expect((await storedEvent(eventId))?.updated_at).toBe(
        '2026-11-01T12:00:00.000Z',
      );
    });

    test('rejects a timezone in which the exchange date has already passed', async () => {
      // 2026-11-01 12:00 UTC is already 2026-11-02 in Kiritimati (UTC+14).
      const { eventId, organizerToken } = await organizeEvent({
        timezone: 'UTC',
        exchangeOn: '2026-11-01',
      });

      await patchEvent(eventId, organizerToken, {
        timezone: 'Pacific/Kiritimati',
      }).expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('DELETE /api/events/:eventId', () => {
    test('lets the organizer delete the event with all its data', async () => {
      const { eventId, organizerToken } = await organizeEvent();
      const tomek = await addMember(eventId, 'tomek@example.com', 'Tomek');
      const ola = await addMember(eventId, 'ola@example.com', 'Ola');
      const now = ctx.clock.now().toISOString();
      const wishlistId = newId();
      await ctx.db
        .insertInto('wishlists')
        .values({
          id: wishlistId,
          event_id: eventId,
          participant_id: tomek.participantId,
          child_name: null,
          notes: null,
          created_at: now,
          updated_at: now,
        })
        .execute();
      await ctx.db
        .insertInto('wishlist_items')
        .values({
          id: newId(),
          wishlist_id: wishlistId,
          position: 0,
          title: 'Szalik',
          url: null,
          notes: null,
          claimed_by_participant_id: null,
          claimed_at: null,
        })
        .execute();
      const [a, b] = [tomek.participantId, ola.participantId].sort();
      await ctx.db
        .insertInto('exclusions')
        .values({ event_id: eventId, participant_a_id: a, participant_b_id: b })
        .execute();
      await ctx.db
        .insertInto('assignments')
        .values({
          event_id: eventId,
          giver_id: tomek.participantId,
          receiver_id: ola.participantId,
        })
        .execute();
      // Another event stays untouched.
      const other = await organizeEvent({ title: 'Sylwester' });

      await deleteEvent(eventId, organizerToken).expect(httpStatus.NO_CONTENT);

      expect(await ctx.db.selectFrom('events').select('id').execute()).toEqual([
        { id: other.eventId },
      ]);
      const leftovers = await Promise.all(
        (
          ['wishlists', 'wishlist_items', 'exclusions', 'assignments'] as const
        ).map((table) => ctx.db.selectFrom(table).selectAll().execute()),
      );
      expect(leftovers).toEqual([[], [], [], []]);
      const participants = await ctx.db
        .selectFrom('participants')
        .select('event_id')
        .execute();
      expect(participants).toEqual([{ event_id: other.eventId }]);
      // Persons and their magic tokens outlive the event.
      await getEvent(eventId, organizerToken).expect(httpStatus.NOT_FOUND);
      await request(ctx.app)
        .get('/api/events')
        .set('Authorization', `Bearer ${tomek.token}`)
        .expect(httpStatus.OK, []);
    });

    test('forbids a member with 403', async () => {
      const { eventId } = await organizeEvent();
      const tomek = await addMember(eventId, 'tomek@example.com', 'Tomek');

      await deleteEvent(eventId, tomek.token).expect(httpStatus.FORBIDDEN);
      expect(await storedEvent(eventId)).toBeDefined();
    });

    test('hides the event from a non-participant with 404', async () => {
      const { eventId } = await organizeEvent();
      const outsider = await signIn(ctx, 'ola@example.com');

      await deleteEvent(eventId, outsider.token).expect(httpStatus.NOT_FOUND);
      expect(await storedEvent(eventId)).toBeDefined();
    });

    test('rejects deleting a finished event with 409', async () => {
      const { eventId, organizerToken } = await organizeEvent();
      ctx.clock.set('2026-12-25T12:00:00.000Z');

      await deleteEvent(eventId, organizerToken).expect(httpStatus.CONFLICT);
      expect(await storedEvent(eventId)).toBeDefined();
    });
  });
});
