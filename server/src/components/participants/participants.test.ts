import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { agent as request } from 'supertest';
import httpStatus from 'http-status';

import newId from '@shared/ids';
import { ACTING_AS_HEADER } from '@components/events/eventAccess.middleware';
import { createTestContext, signIn, TestContext } from '@test/harness';
import {
  addManagedParticipant,
  addMember as addMemberTo,
  OrganizedEvent,
  organizeEvent as organizeEventIn,
} from '@test/fixtures';
import { MAX_PARTICIPANTS_PER_EVENT } from './participants.service';

describe('Participants API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(() => ctx.close());

  const organizeEvent = async (overrides: Record<string, unknown> = {}) => {
    const event = await organizeEventIn(ctx, overrides);
    // Only the organizer's personal link; tests check what adding sends.
    await ctx.sendEmails();
    ctx.mailer.sent.length = 0;
    return event;
  };

  const addMember = (
    event: OrganizedEvent,
    email: string,
    displayName: string,
  ) => addMemberTo(ctx, event, email, displayName);

  const addParticipant = (eventId: string, token: string, body: object) =>
    request(ctx.app)
      .post(`/api/events/${eventId}/participants`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const listParticipants = (eventId: string, token: string) =>
    request(ctx.app)
      .get(`/api/events/${eventId}/participants`)
      .set('Authorization', `Bearer ${token}`);

  const removeParticipant = (
    eventId: string,
    token: string,
    participantId: string,
  ) =>
    request(ctx.app)
      .delete(`/api/events/${eventId}/participants/${participantId}`)
      .set('Authorization', `Bearer ${token}`);

  const respond = (
    action: 'decline' | 'rejoin',
    eventId: string,
    token: string,
    actingAs?: string,
  ) => {
    const req = request(ctx.app)
      .post(`/api/events/${eventId}/participation/${action}`)
      .set('Authorization', `Bearer ${token}`);
    return actingAs ? req.set(ACTING_AS_HEADER, actingAs) : req;
  };

  const storedParticipant = (participantId: string) =>
    ctx.db
      .selectFrom('participants')
      .selectAll()
      .where('id', '=', participantId)
      .executeTakeFirst();

  const markDrawn = (eventId: string) =>
    ctx.db
      .updateTable('events')
      .set({ status: 'drawn', drawn_at: ctx.clock.now().toISOString() })
      .where('id', '=', eventId)
      .execute();

  // The day after the exchange date in Warsaw.
  const finish = () => ctx.clock.set('2026-12-25T12:00:00.000Z');

  describe('POST /api/events/:eventId/participants', () => {
    test('lets the organizer add an active, not yet invited participant silently', async () => {
      const { eventId, organizerToken } = await organizeEvent();

      const res = await addParticipant(eventId, organizerToken, {
        displayName: ' Tomek ',
        email: ' Tomek@Example.com ',
      }).expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.any(String),
        displayName: 'Tomek',
        role: 'member',
        status: 'active',
        email: 'tomek@example.com',
        managedByParticipantId: null,
        inviteSentAt: null,
        firstOpenedAt: null,
        wishlistFilled: false,
      });
      expect(await storedParticipant(res.body.id)).toMatchObject({
        event_id: eventId,
        person_id: expect.any(String),
        managed_by_participant_id: null,
        role: 'member',
        status: 'active',
        added_at: '2026-11-01T12:00:00.000Z',
        invite_sent_at: null,
      });
      // ADR-0003: adding sends nothing; the invitation is a separate step.
      expect(await ctx.sendEmails()).toBe(0);
    });

    test('reuses the person with that email', async () => {
      await organizeEvent({
        title: 'Sylwester',
        organizerEmail: 'tomek@example.com',
      });
      const { eventId, organizerToken } = await organizeEvent();

      await addParticipant(eventId, organizerToken, {
        displayName: 'Tomek',
        email: 'TOMEK@example.com',
      }).expect(httpStatus.CREATED);

      const persons = await ctx.db
        .selectFrom('persons')
        .select('email')
        .orderBy('email')
        .execute();
      expect(persons).toEqual([
        { email: 'ania@example.com' },
        { email: 'tomek@example.com' },
      ]);
    });

    test('rejects a person who is already a participant with 409', async () => {
      const event = await organizeEvent();
      await addMember(event, 'tomek@example.com', 'Tomek');

      await addParticipant(event.eventId, event.organizerToken, {
        displayName: 'Tomek again',
        email: 'Tomek@example.com',
      }).expect(httpStatus.CONFLICT);
      await addParticipant(event.eventId, event.organizerToken, {
        displayName: 'Me again',
        email: 'ania@example.com',
      }).expect(httpStatus.CONFLICT);
    });

    test('adds a managed participant without an email, looked after by a caretaker', async () => {
      const event = await organizeEvent();
      const tomek = await addMember(event, 'tomek@example.com', 'Tomek');

      const res = await addParticipant(event.eventId, event.organizerToken, {
        displayName: 'Babcia Zosia',
        managedByParticipantId: tomek.participantId,
      }).expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.any(String),
        displayName: 'Babcia Zosia',
        role: 'member',
        status: 'active',
        email: null,
        managedByParticipantId: tomek.participantId,
        inviteSentAt: null,
        firstOpenedAt: null,
        wishlistFilled: false,
      });
      expect(await storedParticipant(res.body.id)).toMatchObject({
        person_id: null,
        managed_by_participant_id: tomek.participantId,
        status: 'active',
      });
      expect(await ctx.sendEmails()).toBe(0);
    });

    test('lets the organizer be a caretaker', async () => {
      const event = await organizeEvent();

      await addParticipant(event.eventId, event.organizerToken, {
        displayName: 'Babcia Zosia',
        managedByParticipantId: event.organizerParticipantId,
      }).expect(httpStatus.CREATED);
    });

    test('rejects a caretaker who is managed, of another event or unknown with 400', async () => {
      const event = await organizeEvent();
      const tomek = await addMember(event, 'tomek@example.com', 'Tomek');
      const zosiaId = await addManagedParticipant(
        ctx,
        event,
        tomek.participantId,
        'Babcia Zosia',
      );
      const other = await organizeEvent({ organizerEmail: 'ola@example.com' });

      const addManagedBy = (caretakerId: string) =>
        addParticipant(event.eventId, event.organizerToken, {
          displayName: 'Dziadek Józek',
          managedByParticipantId: caretakerId,
        }).expect(httpStatus.BAD_REQUEST);
      await addManagedBy(zosiaId);
      await addManagedBy(other.organizerParticipantId);
      await addManagedBy(newId());

      expect(
        await ctx.db
          .selectFrom('participants')
          .select('id')
          .where('event_id', '=', event.eventId)
          .execute(),
      ).toHaveLength(3);
    });

    test.each([
      ['a missing display name', { email: 'tomek@example.com' }],
      [
        'a blank display name',
        { displayName: ' ', email: 'tomek@example.com' },
      ],
      ['neither email nor caretaker', { displayName: 'Tomek' }],
      [
        'both email and caretaker',
        {
          displayName: 'Tomek',
          email: 'tomek@example.com',
          managedByParticipantId: newId(),
        },
      ],
      ['an invalid email', { displayName: 'Tomek', email: 'not-an-email' }],
    ])('rejects %s with 400', async (_case, body) => {
      const { eventId, organizerToken } = await organizeEvent();

      await addParticipant(eventId, organizerToken, body).expect(
        httpStatus.BAD_REQUEST,
      );
      expect(
        await ctx.db.selectFrom('participants').select('id').execute(),
      ).toHaveLength(1);
    });

    test(`allows at most ${MAX_PARTICIPANTS_PER_EVENT} participants`, async () => {
      const { eventId, organizerToken } = await organizeEvent();
      for (let i = 1; i < MAX_PARTICIPANTS_PER_EVENT; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await addParticipant(eventId, organizerToken, {
          displayName: `Person ${i}`,
          email: `person${i}@example.com`,
        }).expect(httpStatus.CREATED);
      }

      await addParticipant(eventId, organizerToken, {
        displayName: 'One too many',
        email: 'late@example.com',
      }).expect(httpStatus.CONFLICT);
      expect(
        await ctx.db.selectFrom('participants').select('id').execute(),
      ).toHaveLength(MAX_PARTICIPANTS_PER_EVENT);
    });

    test('forbids a member with 403', async () => {
      const event = await organizeEvent();
      const tomek = await addMember(event, 'tomek@example.com', 'Tomek');

      await addParticipant(event.eventId, tomek.token, {
        displayName: 'Ola',
        email: 'ola@example.com',
      }).expect(httpStatus.FORBIDDEN);
    });

    test('hides the event from a non-participant with 404', async () => {
      const { eventId } = await organizeEvent();
      const outsider = await signIn(ctx, 'ola@example.com');

      await addParticipant(eventId, outsider.token, {
        displayName: 'Ola',
        email: 'ola@example.com',
      }).expect(httpStatus.NOT_FOUND);
    });

    test.each([
      ['drawn', markDrawn],
      ['finished', finish],
    ])('rejects adding once the event is %s with 409', async (_case, lock) => {
      const { eventId, organizerToken } = await organizeEvent();
      await lock(eventId);

      await addParticipant(eventId, organizerToken, {
        displayName: 'Tomek',
        email: 'tomek@example.com',
      }).expect(httpStatus.CONFLICT);
    });
  });

  describe('GET /api/events/:eventId/participants', () => {
    // Organizer Ania, Tomek (opened the event, own wishlist with an item),
    // Ola (declined) and Babcia Zosia managed by Tomek.
    const setUpFamily = async () => {
      const event = await organizeEvent();
      const tomek = await addMember(event, 'tomek@example.com', 'Tomek');
      const ola = await addMember(event, 'ola@example.com', 'Ola');
      const zosiaId = await addManagedParticipant(
        ctx,
        event,
        tomek.participantId,
        'Babcia Zosia',
      );

      ctx.clock.set('2026-11-02T08:00:00.000Z');
      await request(ctx.app)
        .get(`/api/events/${event.eventId}`)
        .set('Authorization', `Bearer ${tomek.token}`)
        .expect(httpStatus.OK);
      await respond('decline', event.eventId, ola.token).expect(httpStatus.OK);

      const now = ctx.clock.now().toISOString();
      const wishlistId = newId();
      await ctx.db
        .insertInto('wishlists')
        .values({
          id: wishlistId,
          event_id: event.eventId,
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
      return { event, tomek, ola, zosiaId };
    };

    test('shows the organizer emails, invitation state, caretakers and wishlist flags', async () => {
      const { event, tomek, ola, zosiaId } = await setUpFamily();

      const res = await listParticipants(
        event.eventId,
        event.organizerToken,
      ).expect(httpStatus.OK);

      expect(res.body).toEqual([
        {
          id: event.organizerParticipantId,
          displayName: 'Ania',
          role: 'organizer',
          status: 'active',
          email: 'ania@example.com',
          managedByParticipantId: null,
          inviteSentAt: '2026-11-01T12:00:00.000Z',
          firstOpenedAt: null,
          wishlistFilled: false,
        },
        {
          id: tomek.participantId,
          displayName: 'Tomek',
          role: 'member',
          status: 'active',
          email: 'tomek@example.com',
          managedByParticipantId: null,
          inviteSentAt: null,
          firstOpenedAt: '2026-11-02T08:00:00.000Z',
          wishlistFilled: true,
        },
        {
          id: ola.participantId,
          displayName: 'Ola',
          role: 'member',
          status: 'declined',
          email: 'ola@example.com',
          managedByParticipantId: null,
          inviteSentAt: null,
          firstOpenedAt: null,
          wishlistFilled: false,
        },
        {
          id: zosiaId,
          displayName: 'Babcia Zosia',
          role: 'member',
          status: 'active',
          email: null,
          managedByParticipantId: tomek.participantId,
          inviteSentAt: null,
          firstOpenedAt: null,
          wishlistFilled: false,
        },
      ]);
    });

    test('shows other participants only names and statuses', async () => {
      const { event, tomek, ola, zosiaId } = await setUpFamily();

      const res = await listParticipants(event.eventId, ola.token).expect(
        httpStatus.OK,
      );

      expect(res.body).toEqual([
        {
          id: event.organizerParticipantId,
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
        {
          id: zosiaId,
          displayName: 'Babcia Zosia',
          role: 'member',
          status: 'active',
        },
      ]);
    });

    test('counts notes but not child wishlists as a filled wishlist', async () => {
      const event = await organizeEvent();
      const tomek = await addMember(event, 'tomek@example.com', 'Tomek');
      const ola = await addMember(event, 'ola@example.com', 'Ola');
      const now = ctx.clock.now().toISOString();
      const wishlist = (
        participantId: string,
        childName: string | null,
        notes: string | null,
      ) => ({
        id: newId(),
        event_id: event.eventId,
        participant_id: participantId,
        child_name: childName,
        notes,
        created_at: now,
        updated_at: now,
      });
      await ctx.db
        .insertInto('wishlists')
        .values([
          wishlist(tomek.participantId, null, 'Cokolwiek z kotem'),
          wishlist(ola.participantId, 'Staś', 'Klocki'),
          wishlist(event.organizerParticipantId, null, '  '),
        ])
        .execute();

      const res = await listParticipants(
        event.eventId,
        event.organizerToken,
      ).expect(httpStatus.OK);

      expect(
        res.body.map((p: { displayName: string; wishlistFilled: boolean }) => [
          p.displayName,
          p.wishlistFilled,
        ]),
      ).toEqual([
        ['Ania', false],
        ['Tomek', true],
        ['Ola', false],
      ]);
    });

    test('hides the event from a non-participant with 404', async () => {
      const { eventId } = await organizeEvent();
      const outsider = await signIn(ctx, 'ola@example.com');

      await listParticipants(eventId, outsider.token).expect(
        httpStatus.NOT_FOUND,
      );
    });

    test('is readable once the event is finished', async () => {
      const { eventId, organizerToken } = await organizeEvent();
      finish();

      await listParticipants(eventId, organizerToken).expect(httpStatus.OK);
    });
  });

  describe('first opened', () => {
    test('is recorded on the first authenticated GET of the event and kept after', async () => {
      const event = await organizeEvent();
      const tomek = await addMember(event, 'tomek@example.com', 'Tomek');
      const getEvent = () =>
        request(ctx.app)
          .get(`/api/events/${event.eventId}`)
          .set('Authorization', `Bearer ${tomek.token}`)
          .expect(httpStatus.OK);

      // Listing participants is not opening the event.
      await listParticipants(event.eventId, tomek.token).expect(httpStatus.OK);
      expect(
        (await storedParticipant(tomek.participantId))?.first_opened_at,
      ).toBeNull();

      ctx.clock.set('2026-11-02T08:00:00.000Z');
      await getEvent();
      ctx.clock.set('2026-11-03T08:00:00.000Z');
      await getEvent();

      expect(
        (await storedParticipant(tomek.participantId))?.first_opened_at,
      ).toBe('2026-11-02T08:00:00.000Z');
      // Only the viewer's own participant is marked.
      expect(
        (await storedParticipant(event.organizerParticipantId))
          ?.first_opened_at,
      ).toBeNull();
    });
  });

  describe('DELETE /api/events/:eventId/participants/:participantId', () => {
    test('lets the organizer remove a participant with their wishlists and exclusions', async () => {
      const event = await organizeEvent();
      const tomek = await addMember(event, 'tomek@example.com', 'Tomek');
      const ola = await addMember(event, 'ola@example.com', 'Ola');
      const now = ctx.clock.now().toISOString();
      await ctx.db
        .insertInto('wishlists')
        .values({
          id: newId(),
          event_id: event.eventId,
          participant_id: tomek.participantId,
          child_name: null,
          notes: 'Szalik',
          created_at: now,
          updated_at: now,
        })
        .execute();
      const [a, b] = [tomek.participantId, ola.participantId].sort();
      await ctx.db
        .insertInto('exclusions')
        .values({
          event_id: event.eventId,
          participant_a_id: a,
          participant_b_id: b,
        })
        .execute();

      await removeParticipant(
        event.eventId,
        event.organizerToken,
        tomek.participantId,
      ).expect(httpStatus.NO_CONTENT);

      expect(await storedParticipant(tomek.participantId)).toBeUndefined();
      expect(
        await ctx.db.selectFrom('wishlists').selectAll().execute(),
      ).toEqual([]);
      expect(
        await ctx.db.selectFrom('exclusions').selectAll().execute(),
      ).toEqual([]);
      // The person and their magic token remain; the event is just gone for them.
      await request(ctx.app)
        .get(`/api/events/${event.eventId}`)
        .set('Authorization', `Bearer ${tomek.token}`)
        .expect(httpStatus.NOT_FOUND);
    });

    test('rejects removing the organizer with 409', async () => {
      const event = await organizeEvent();

      await removeParticipant(
        event.eventId,
        event.organizerToken,
        event.organizerParticipantId,
      ).expect(httpStatus.CONFLICT);
      expect(
        await storedParticipant(event.organizerParticipantId),
      ).toBeDefined();
    });

    test('rejects removing a caretaker of managed participants with 409 until they are removed', async () => {
      const event = await organizeEvent();
      const tomek = await addMember(event, 'tomek@example.com', 'Tomek');
      const zosiaId = await addManagedParticipant(
        ctx,
        event,
        tomek.participantId,
        'Babcia Zosia',
      );

      await removeParticipant(
        event.eventId,
        event.organizerToken,
        tomek.participantId,
      ).expect(httpStatus.CONFLICT);
      expect(await storedParticipant(zosiaId)).toBeDefined();

      await removeParticipant(
        event.eventId,
        event.organizerToken,
        zosiaId,
      ).expect(httpStatus.NO_CONTENT);
      await removeParticipant(
        event.eventId,
        event.organizerToken,
        tomek.participantId,
      ).expect(httpStatus.NO_CONTENT);
    });

    test('answers 404 for an unknown participant or one of another event', async () => {
      const event = await organizeEvent();
      const other = await organizeEvent({ organizerEmail: 'ola@example.com' });
      const olaMember = await addMember(other, 'tomek@example.com', 'Tomek');

      await removeParticipant(
        event.eventId,
        event.organizerToken,
        newId(),
      ).expect(httpStatus.NOT_FOUND);
      await removeParticipant(
        event.eventId,
        event.organizerToken,
        olaMember.participantId,
      ).expect(httpStatus.NOT_FOUND);
      expect(await storedParticipant(olaMember.participantId)).toBeDefined();
    });

    test('forbids a member with 403', async () => {
      const event = await organizeEvent();
      const tomek = await addMember(event, 'tomek@example.com', 'Tomek');
      const ola = await addMember(event, 'ola@example.com', 'Ola');

      await removeParticipant(
        event.eventId,
        tomek.token,
        ola.participantId,
      ).expect(httpStatus.FORBIDDEN);
    });

    test.each([
      ['drawn', markDrawn],
      ['finished', finish],
    ])(
      'rejects removing once the event is %s with 409',
      async (_case, lock) => {
        const event = await organizeEvent();
        const tomek = await addMember(event, 'tomek@example.com', 'Tomek');
        await lock(event.eventId);

        await removeParticipant(
          event.eventId,
          event.organizerToken,
          tomek.participantId,
        ).expect(httpStatus.CONFLICT);
        expect(await storedParticipant(tomek.participantId)).toBeDefined();
      },
    );
  });

  describe('POST /api/events/:eventId/participation/decline and /rejoin', () => {
    test('lets a participant decline and rejoin', async () => {
      const event = await organizeEvent();
      const tomek = await addMember(event, 'tomek@example.com', 'Tomek');

      ctx.clock.set('2026-11-02T08:00:00.000Z');
      const declined = await respond(
        'decline',
        event.eventId,
        tomek.token,
      ).expect(httpStatus.OK);
      expect(declined.body).toEqual({
        id: tomek.participantId,
        displayName: 'Tomek',
        role: 'member',
        status: 'declined',
      });
      expect(await storedParticipant(tomek.participantId)).toMatchObject({
        status: 'declined',
        responded_at: '2026-11-02T08:00:00.000Z',
      });

      ctx.clock.set('2026-11-03T08:00:00.000Z');
      const rejoined = await respond(
        'rejoin',
        event.eventId,
        tomek.token,
      ).expect(httpStatus.OK);
      expect(rejoined.body.status).toBe('active');
      expect(await storedParticipant(tomek.participantId)).toMatchObject({
        status: 'active',
        responded_at: '2026-11-03T08:00:00.000Z',
      });
    });

    test('repeating the current status changes nothing', async () => {
      const event = await organizeEvent();
      const tomek = await addMember(event, 'tomek@example.com', 'Tomek');
      await respond('decline', event.eventId, tomek.token).expect(
        httpStatus.OK,
      );

      ctx.clock.set('2026-11-02T08:00:00.000Z');
      await respond('decline', event.eventId, tomek.token).expect(
        httpStatus.OK,
      );
      expect(await storedParticipant(tomek.participantId)).toMatchObject({
        status: 'declined',
        responded_at: '2026-11-01T12:00:00.000Z',
      });
    });

    test('rejects the organizer declining with 409', async () => {
      const event = await organizeEvent();

      await respond('decline', event.eventId, event.organizerToken).expect(
        httpStatus.CONFLICT,
      );
      expect(
        (await storedParticipant(event.organizerParticipantId))?.status,
      ).toBe('active');
    });

    test.each([
      ['decline', 'drawn', markDrawn],
      ['decline', 'finished', finish],
      ['rejoin', 'drawn', markDrawn],
      ['rejoin', 'finished', finish],
    ] as const)(
      'rejects %s once the event is %s with 409',
      async (action, _status, lock) => {
        const event = await organizeEvent();
        const tomek = await addMember(event, 'tomek@example.com', 'Tomek');
        if (action === 'rejoin') {
          await respond('decline', event.eventId, tomek.token).expect(
            httpStatus.OK,
          );
        }
        const before = await storedParticipant(tomek.participantId);
        await lock(event.eventId);

        await respond(action, event.eventId, tomek.token).expect(
          httpStatus.CONFLICT,
        );
        expect(await storedParticipant(tomek.participantId)).toEqual(before);
      },
    );

    test('hides the event from a non-participant with 404', async () => {
      const { eventId } = await organizeEvent();
      const outsider = await signIn(ctx, 'ola@example.com');

      await respond('decline', eventId, outsider.token).expect(
        httpStatus.NOT_FOUND,
      );
    });
  });

  describe(`acting as a managed participant (${ACTING_AS_HEADER})`, () => {
    const setUpCaretaker = async () => {
      const event = await organizeEvent();
      const tomek = await addMember(event, 'tomek@example.com', 'Tomek');
      const ola = await addMember(event, 'ola@example.com', 'Ola');
      const zosiaId = await addManagedParticipant(
        ctx,
        event,
        tomek.participantId,
        'Babcia Zosia',
      );
      return { event, tomek, ola, zosiaId };
    };

    test('lets the caretaker decline and rejoin for their managed participant', async () => {
      const { event, tomek, zosiaId } = await setUpCaretaker();

      const res = await respond(
        'decline',
        event.eventId,
        tomek.token,
        zosiaId,
      ).expect(httpStatus.OK);
      expect(res.body).toEqual({
        id: zosiaId,
        displayName: 'Babcia Zosia',
        role: 'member',
        status: 'declined',
      });
      expect((await storedParticipant(zosiaId))?.status).toBe('declined');
      // The caretaker's own participation is untouched.
      expect((await storedParticipant(tomek.participantId))?.status).toBe(
        'active',
      );

      await respond('rejoin', event.eventId, tomek.token, zosiaId).expect(
        httpStatus.OK,
      );
      expect((await storedParticipant(zosiaId))?.status).toBe('active');
    });

    test('forbids a participant who is not the caretaker with 403', async () => {
      const { event, ola, zosiaId } = await setUpCaretaker();

      await respond('decline', event.eventId, ola.token, zosiaId).expect(
        httpStatus.FORBIDDEN,
      );
      // Not even the organizer may act as someone else's managed participant.
      await respond(
        'decline',
        event.eventId,
        event.organizerToken,
        zosiaId,
      ).expect(httpStatus.FORBIDDEN);
      expect((await storedParticipant(zosiaId))?.status).toBe('active');
    });

    test('forbids acting as a participant who is not managed with 403', async () => {
      const { event, tomek, ola } = await setUpCaretaker();

      await respond(
        'decline',
        event.eventId,
        tomek.token,
        ola.participantId,
      ).expect(httpStatus.FORBIDDEN);
      await respond(
        'decline',
        event.eventId,
        tomek.token,
        tomek.participantId,
      ).expect(httpStatus.FORBIDDEN);
      await respond('decline', event.eventId, tomek.token, newId()).expect(
        httpStatus.FORBIDDEN,
      );
      expect((await storedParticipant(ola.participantId))?.status).toBe(
        'active',
      );
      expect((await storedParticipant(tomek.participantId))?.status).toBe(
        'active',
      );
    });

    test('forbids acting as a managed participant of another event with 403', async () => {
      const { event, tomek } = await setUpCaretaker();
      const other = await organizeEvent({ organizerEmail: 'ewa@example.com' });
      const tomekThere = await addMember(other, 'tomek@example.com', 'Tomek');
      const dziadekId = await addManagedParticipant(
        ctx,
        other,
        tomekThere.participantId,
        'Dziadek Józek',
      );

      // Tomek is Dziadek's caretaker, but only in the other event.
      await respond('decline', event.eventId, tomek.token, dziadekId).expect(
        httpStatus.FORBIDDEN,
      );
      expect((await storedParticipant(dziadekId))?.status).toBe('active');
    });

    test("lists the caller's managed participants in the event details", async () => {
      const { event, tomek, ola, zosiaId } = await setUpCaretaker();
      const getEvent = (token: string) =>
        request(ctx.app)
          .get(`/api/events/${event.eventId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(httpStatus.OK);

      expect((await getEvent(tomek.token)).body.managedParticipants).toEqual([
        {
          id: zosiaId,
          displayName: 'Babcia Zosia',
          role: 'member',
          status: 'active',
        },
      ]);
      expect((await getEvent(ola.token)).body.managedParticipants).toEqual([]);
    });
  });
});
