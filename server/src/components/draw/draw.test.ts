import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { agent as request, Test } from 'supertest';
import httpStatus from 'http-status';

import { DrawResultPayload } from '@email/templates';
import { ACTING_AS_HEADER } from '@components/events/eventAccess.middleware';
import { createTestContext, signIn, TestContext } from '@test/harness';
import {
  addManagedParticipant,
  addMember,
  decline,
  inviteAll,
  OrganizedEvent,
  organizeEvent,
  runDraw,
} from '@test/fixtures';

describe('Draw API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(() => ctx.close());

  const withActingAs = (req: Test, actingAs?: string) =>
    actingAs ? req.set(ACTING_AS_HEADER, actingAs) : req;

  const drawRequest = (eventId: string, token: string) =>
    request(ctx.app)
      .post(`/api/events/${eventId}/draw`)
      .set('Authorization', `Bearer ${token}`);

  const myAssignmentRequest = (
    eventId: string,
    token: string,
    actingAs?: string,
  ) =>
    withActingAs(
      request(ctx.app)
        .get(`/api/events/${eventId}/my-assignment`)
        .set('Authorization', `Bearer ${token}`),
      actingAs,
    );

  const listWishlists = (eventId: string, token: string, actingAs?: string) =>
    withActingAs(
      request(ctx.app)
        .get(`/api/events/${eventId}/wishlists`)
        .set('Authorization', `Bearer ${token}`),
      actingAs,
    );

  const createWishlist = (
    eventId: string,
    token: string,
    body: object,
    actingAs?: string,
  ) =>
    withActingAs(
      request(ctx.app)
        .post(`/api/events/${eventId}/wishlists`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
      actingAs,
    ).expect(httpStatus.CREATED);

  const exclude = (event: OrganizedEvent, firstId: string, secondId: string) =>
    request(ctx.app)
      .post(`/api/events/${event.eventId}/exclusions`)
      .set('Authorization', `Bearer ${event.organizerToken}`)
      .send({ participantAId: firstId, participantBId: secondId })
      .expect(httpStatus.CREATED);

  // Test-only peek at the secret pairs: giver id → recipient id.
  const assignmentsOf = async (eventId: string) =>
    new Map(
      (
        await ctx.db
          .selectFrom('assignments')
          .select(['giver_id', 'receiver_id'])
          .where('event_id', '=', eventId)
          .execute()
      ).map((row) => [row.giver_id, row.receiver_id]),
    );

  const drawResultEmails = async () =>
    (
      await ctx.db
        .selectFrom('email_outbox')
        .select(['to_email', 'payload'])
        .where('template', '=', 'draw-result')
        .execute()
    ).map((row) => ({
      to: row.to_email,
      payload: JSON.parse(row.payload) as DrawResultPayload,
    }));

  const storedEvent = (eventId: string) =>
    ctx.db
      .selectFrom('events')
      .select(['status', 'drawn_at'])
      .where('id', '=', eventId)
      .executeTakeFirstOrThrow();

  // Organizer Ania, members Tomek and Ola, Babcia Zosia managed by Tomek;
  // everyone invited.
  const setUpFamily = async () => {
    const event = await organizeEvent(ctx);
    const tomek = await addMember(ctx, event, 'tomek@example.com', 'Tomek');
    const ola = await addMember(ctx, event, 'ola@example.com', 'Ola');
    const zosiaId = await addManagedParticipant(
      ctx,
      event,
      tomek.participantId,
      'Zosia',
    );
    await inviteAll(ctx, event);
    const names = new Map([
      [event.organizerParticipantId, 'Ania'],
      [tomek.participantId, 'Tomek'],
      [ola.participantId, 'Ola'],
      [zosiaId, 'Zosia'],
    ]);
    return { event, tomek, ola, zosiaId, names };
  };

  // The day of the exchange, and the day after it, in Warsaw.
  const exchangeDay = () => ctx.clock.set('2026-12-24T12:00:00.000Z');
  const finish = () => ctx.clock.set('2026-12-25T12:00:00.000Z');

  describe('POST /api/events/:eventId/draw', () => {
    test('draws every participant into one bijection and returns no pairs', async () => {
      const { event, names } = await setUpFamily();

      const res = await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );

      expect(res.body).toEqual({
        event: expect.objectContaining({
          id: event.eventId,
          status: 'drawn',
          drawnAt: ctx.clock.now().toISOString(),
        }),
        participantCount: 4,
      });
      const body = JSON.stringify(res.body);
      [...names.keys()].forEach((id) => expect(body).not.toContain(id));
      [...names.values()].forEach((name) => expect(body).not.toContain(name));

      const assignments = await assignmentsOf(event.eventId);
      const ids = [...names.keys()].sort();
      expect([...assignments.keys()].sort()).toEqual(ids);
      expect([...assignments.values()].sort()).toEqual(ids);
      assignments.forEach((recipient, giver) =>
        expect(recipient).not.toBe(giver),
      );
      expect(await storedEvent(event.eventId)).toEqual({
        status: 'drawn',
        drawn_at: ctx.clock.now().toISOString(),
      });
    });

    test('emails each participant their recipient; a managed participant’s goes to the caretaker', async () => {
      const { event, tomek, zosiaId, names } = await setUpFamily();

      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );

      const assignments = await assignmentsOf(event.eventId);
      const recipientName = (giverId: string) =>
        names.get(assignments.get(giverId) as string);
      const common = {
        eventId: event.eventId,
        eventTitle: 'Wigilia 2026',
        exchangeOn: '2026-12-24',
      };
      const emails = await drawResultEmails();
      expect(emails).toHaveLength(4);
      expect(emails).toEqual(
        expect.arrayContaining([
          {
            to: 'ania@example.com',
            payload: {
              ...common,
              giverName: 'Ania',
              recipientName: recipientName(event.organizerParticipantId),
              caretakerName: null,
            },
          },
          {
            to: 'tomek@example.com',
            payload: {
              ...common,
              giverName: 'Tomek',
              recipientName: recipientName(tomek.participantId),
              caretakerName: null,
            },
          },
          {
            to: 'tomek@example.com',
            payload: {
              ...common,
              giverName: 'Zosia',
              recipientName: recipientName(zosiaId),
              caretakerName: 'Tomek',
            },
          },
        ]),
      );

      // They render and send.
      await ctx.sendEmails();
      const sent = ctx.mailer.sent.filter((email) =>
        email.subject.startsWith('Losowanie'),
      );
      expect(sent.map((email) => email.to).sort()).toEqual([
        'ania@example.com',
        'ola@example.com',
        'tomek@example.com',
        'tomek@example.com',
      ]);
    });

    test('leaves declined participants out of the draw', async () => {
      const { event, tomek, ola, zosiaId } = await setUpFamily();
      const basia = await addMember(ctx, event, 'basia@example.com', 'Basia');
      await inviteAll(ctx, event);
      await decline(ctx, event.eventId, ola.token);

      const res = await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );

      expect(res.body.participantCount).toBe(4);
      const assignments = await assignmentsOf(event.eventId);
      expect([...assignments.keys()].sort()).toEqual(
        [
          event.organizerParticipantId,
          tomek.participantId,
          zosiaId,
          basia.participantId,
        ].sort(),
      );
      expect([...assignments.values()]).not.toContain(ola.participantId);
      expect((await drawResultEmails()).map((email) => email.to)).not.toContain(
        'ola@example.com',
      );
    });

    test('respects exclusions and the caretaker ↔ managed participant pair', async () => {
      const { event, tomek, ola, zosiaId } = await setUpFamily();
      await exclude(event, event.organizerParticipantId, ola.participantId);
      const forbidden = new Set([
        `${event.organizerParticipantId}:${ola.participantId}`,
        `${ola.participantId}:${event.organizerParticipantId}`,
        `${tomek.participantId}:${zosiaId}`,
        `${zosiaId}:${tomek.participantId}`,
      ]);

      for (let round = 0; round < 15; round += 1) {
        // eslint-disable-next-line no-await-in-loop
        await runDraw(ctx, event);
        // eslint-disable-next-line no-await-in-loop
        const assignments = await assignmentsOf(event.eventId);
        expect(assignments.size).toBe(4);
        assignments.forEach((recipient, giver) =>
          expect(forbidden.has(`${giver}:${recipient}`)).toBe(false),
        );
      }
    });

    test('rejects fewer than three participants with 422', async () => {
      const event = await organizeEvent(ctx);
      await addMember(ctx, event, 'tomek@example.com', 'Tomek');
      await inviteAll(ctx, event);

      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.UNPROCESSABLE_ENTITY,
      );
    });

    test('counts only non-declined participants towards the three', async () => {
      const event = await organizeEvent(ctx);
      await addMember(ctx, event, 'tomek@example.com', 'Tomek');
      const ola = await addMember(ctx, event, 'ola@example.com', 'Ola');
      await inviteAll(ctx, event);
      await decline(ctx, event.eventId, ola.token);

      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.UNPROCESSABLE_ENTITY,
      );
    });

    test('rejects a participant not invited yet with 422; managed participants need no invitation', async () => {
      const { event } = await setUpFamily();
      await addMember(ctx, event, 'basia@example.com', 'Basia');

      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.UNPROCESSABLE_ENTITY,
      );

      await inviteAll(ctx, event);
      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );
    });

    test('ignores an uninvited participant who declined', async () => {
      const { event } = await setUpFamily();
      const basia = await addMember(ctx, event, 'basia@example.com', 'Basia');
      await decline(ctx, event.eventId, basia.token);

      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );
    });

    test('rejects exclusions that make the draw impossible with 422', async () => {
      const event = await organizeEvent(ctx);
      const tomek = await addMember(ctx, event, 'tomek@example.com', 'Tomek');
      const ola = await addMember(ctx, event, 'ola@example.com', 'Ola');
      await inviteAll(ctx, event);
      await exclude(event, event.organizerParticipantId, tomek.participantId);
      await exclude(event, event.organizerParticipantId, ola.participantId);
      await exclude(event, tomek.participantId, ola.participantId);

      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.UNPROCESSABLE_ENTITY,
      );
    });

    test('rejects a draw the built-in caretaker pair makes impossible with 422', async () => {
      // Tomek and his Zosia can only both give to Ania.
      const event = await organizeEvent(ctx);
      const tomek = await addMember(ctx, event, 'tomek@example.com', 'Tomek');
      await addManagedParticipant(ctx, event, tomek.participantId, 'Zosia');
      await inviteAll(ctx, event);

      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.UNPROCESSABLE_ENTITY,
      );
    });

    test('changes nothing when rejected', async () => {
      const event = await organizeEvent(ctx);
      await addMember(ctx, event, 'tomek@example.com', 'Tomek');
      await inviteAll(ctx, event);

      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.UNPROCESSABLE_ENTITY,
      );

      expect(await assignmentsOf(event.eventId)).toEqual(new Map());
      expect(await storedEvent(event.eventId)).toEqual({
        status: 'open',
        drawn_at: null,
      });
      expect(await drawResultEmails()).toEqual([]);
    });

    test('redo replaces all assignments and re-emails everyone', async () => {
      const { event } = await setUpFamily();
      await runDraw(ctx, event);
      ctx.clock.set('2026-11-02T09:00:00.000Z');

      const res = await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );

      expect(res.body.event).toMatchObject({
        status: 'drawn',
        drawnAt: '2026-11-02T09:00:00.000Z',
      });
      expect((await assignmentsOf(event.eventId)).size).toBe(4);
      const emails = await drawResultEmails();
      expect(emails).toHaveLength(8);
      expect(emails.map((email) => email.payload.giverName).sort()).toEqual([
        'Ania',
        'Ania',
        'Ola',
        'Ola',
        'Tomek',
        'Tomek',
        'Zosia',
        'Zosia',
      ]);
    });

    test('a failed redo keeps the previous draw', async () => {
      const { event } = await setUpFamily();
      await runDraw(ctx, event);
      const before = await assignmentsOf(event.eventId);
      // Membership is locked, so make the redo impossible behind the API.
      await ctx.db
        .updateTable('participants')
        .set({ invite_sent_at: null })
        .where('display_name', '=', 'Ola')
        .execute();

      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.UNPROCESSABLE_ENTITY,
      );

      expect(await assignmentsOf(event.eventId)).toEqual(before);
      expect(await drawResultEmails()).toHaveLength(4);
    });

    test('rejects a redo on the exchange date or once finished with 409', async () => {
      const { event } = await setUpFamily();
      await runDraw(ctx, event);

      exchangeDay();
      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.CONFLICT,
      );
      finish();
      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.CONFLICT,
      );
      expect(await drawResultEmails()).toHaveLength(4);
    });

    test('rejects a first draw once the event is finished with 409', async () => {
      const { event } = await setUpFamily();
      finish();

      await drawRequest(event.eventId, event.organizerToken).expect(
        httpStatus.CONFLICT,
      );
    });

    test('forbids a member with 403', async () => {
      const { event, tomek } = await setUpFamily();

      await drawRequest(event.eventId, tomek.token).expect(
        httpStatus.FORBIDDEN,
      );
      expect(await assignmentsOf(event.eventId)).toEqual(new Map());
    });

    test('hides the event from a non-participant with 404', async () => {
      const { event } = await setUpFamily();
      const { token } = await signIn(ctx, 'stranger@example.com');

      await drawRequest(event.eventId, token).expect(httpStatus.NOT_FOUND);
    });

    test('locks membership and exclusions once drawn', async () => {
      const { event, tomek, ola } = await setUpFamily();
      await runDraw(ctx, event);

      await request(ctx.app)
        .post(`/api/events/${event.eventId}/participants`)
        .set('Authorization', `Bearer ${event.organizerToken}`)
        .send({ displayName: 'Basia', email: 'basia@example.com' })
        .expect(httpStatus.CONFLICT);
      await request(ctx.app)
        .post(`/api/events/${event.eventId}/exclusions`)
        .set('Authorization', `Bearer ${event.organizerToken}`)
        .send({
          participantAId: tomek.participantId,
          participantBId: ola.participantId,
        })
        .expect(httpStatus.CONFLICT);
      await request(ctx.app)
        .post(`/api/events/${event.eventId}/participation/decline`)
        .set('Authorization', `Bearer ${ola.token}`)
        .expect(httpStatus.CONFLICT);
    });
  });

  describe('GET /api/events/:eventId/my-assignment', () => {
    test('answers 404 before the draw', async () => {
      const { event, tomek } = await setUpFamily();

      await myAssignmentRequest(event.eventId, tomek.token).expect(
        httpStatus.NOT_FOUND,
      );
    });

    test("returns the recipient with their own wishlist, not their children's", async () => {
      const { event, tomek, ola, names } = await setUpFamily();
      const tokens = new Map([
        [event.organizerParticipantId, event.organizerToken],
        [tomek.participantId, tomek.token],
        [ola.participantId, ola.token],
      ]);
      await runDraw(ctx, event);
      const assignments = await assignmentsOf(event.eventId);
      // Someone with a token who gives to someone with a token.
      const [giverId, recipientId] = [...assignments].find(
        ([giver, recipient]) => tokens.has(giver) && tokens.has(recipient),
      ) as [string, string];
      const recipientToken = tokens.get(recipientId) as string;
      const own = await createWishlist(event.eventId, recipientToken, {
        notes: 'Rozmiar M',
        items: [{ title: 'Szalik' }],
      });
      await createWishlist(event.eventId, recipientToken, {
        childName: 'Staś',
        items: [{ title: 'Klocki' }],
      });

      const res = await myAssignmentRequest(
        event.eventId,
        tokens.get(giverId) as string,
      ).expect(httpStatus.OK);

      expect(res.body).toEqual({
        recipient: { id: recipientId, displayName: names.get(recipientId) },
        wishlist: own.body,
      });
    });

    test('returns a null wishlist when the recipient has none', async () => {
      const { event } = await setUpFamily();
      await runDraw(ctx, event);

      const res = await myAssignmentRequest(
        event.eventId,
        event.organizerToken,
      ).expect(httpStatus.OK);

      expect(res.body.wishlist).toBeNull();
    });

    test("the organizer sees only their own assignment, nobody else's", async () => {
      const { event, ola, zosiaId } = await setUpFamily();
      await runDraw(ctx, event);
      const assignments = await assignmentsOf(event.eventId);

      const res = await myAssignmentRequest(
        event.eventId,
        event.organizerToken,
      ).expect(httpStatus.OK);
      expect(res.body.recipient.id).toBe(
        assignments.get(event.organizerParticipantId),
      );

      await myAssignmentRequest(
        event.eventId,
        event.organizerToken,
        ola.participantId,
      ).expect(httpStatus.FORBIDDEN);
      await myAssignmentRequest(
        event.eventId,
        event.organizerToken,
        zosiaId,
      ).expect(httpStatus.FORBIDDEN);
    });

    test("a caretaker sees their managed participant's assignment with X-Acting-As", async () => {
      const { event, tomek, zosiaId } = await setUpFamily();
      await runDraw(ctx, event);
      const assignments = await assignmentsOf(event.eventId);

      const own = await myAssignmentRequest(event.eventId, tomek.token).expect(
        httpStatus.OK,
      );
      const zosias = await myAssignmentRequest(
        event.eventId,
        tomek.token,
        zosiaId,
      ).expect(httpStatus.OK);

      expect(own.body.recipient.id).toBe(assignments.get(tomek.participantId));
      expect(zosias.body.recipient.id).toBe(assignments.get(zosiaId));
    });

    test('answers 404 to a participant who declined before the draw', async () => {
      const { event, ola } = await setUpFamily();
      await addMember(ctx, event, 'basia@example.com', 'Basia');
      await inviteAll(ctx, event);
      await decline(ctx, event.eventId, ola.token);
      await runDraw(ctx, event);

      await myAssignmentRequest(event.eventId, ola.token).expect(
        httpStatus.NOT_FOUND,
      );
    });

    test('is readable once the event is finished', async () => {
      const { event } = await setUpFamily();
      await runDraw(ctx, event);
      finish();

      await myAssignmentRequest(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );
    });

    test('hides the event from a non-participant with 404', async () => {
      const { event } = await setUpFamily();
      await runDraw(ctx, event);
      const { token } = await signIn(ctx, 'stranger@example.com');

      await myAssignmentRequest(event.eventId, token).expect(
        httpStatus.NOT_FOUND,
      );
    });
  });

  describe('GET /api/events/:eventId/wishlists after the draw', () => {
    // Everyone with a token writes their own wishlist; Tomek writes Zosia's.
    const writeOwnWishlists = async (
      family: Awaited<ReturnType<typeof setUpFamily>>,
    ) => {
      const { event, tomek, ola, zosiaId } = family;
      const ids = new Map<string, string>();
      const write = async (
        participantId: string,
        token: string,
        actingAs?: string,
      ) => {
        const res = await createWishlist(
          event.eventId,
          token,
          { items: [{ title: `Prezent ${participantId}` }] },
          actingAs,
        );
        ids.set(participantId, res.body.id);
      };
      await write(event.organizerParticipantId, event.organizerToken);
      await write(tomek.participantId, tomek.token);
      await write(ola.participantId, ola.token);
      await write(zosiaId, tomek.token, zosiaId);
      return ids;
    };

    test("adds the recipient's own wishlist, after the viewer's own", async () => {
      const family = await setUpFamily();
      const { event, tomek, ola, zosiaId } = family;
      const wishlistIds = await writeOwnWishlists(family);
      const child = await createWishlist(event.eventId, ola.token, {
        childName: 'Staś',
      });

      const before = await listWishlists(event.eventId, tomek.token).expect(
        httpStatus.OK,
      );
      expect(before.body.map((w: { id: string }) => w.id)).toEqual([
        wishlistIds.get(tomek.participantId),
        child.body.id,
      ]);

      await runDraw(ctx, event);
      const assignments = await assignmentsOf(event.eventId);
      const viewers: [string, string, string?][] = [
        [event.organizerParticipantId, event.organizerToken],
        [tomek.participantId, tomek.token],
        [ola.participantId, ola.token],
        [zosiaId, tomek.token, zosiaId],
      ];
      // eslint-disable-next-line no-restricted-syntax
      for (const [viewerId, token, actingAs] of viewers) {
        // eslint-disable-next-line no-await-in-loop
        const after = await listWishlists(
          event.eventId,
          token,
          actingAs,
        ).expect(httpStatus.OK);
        expect(after.body.map((w: { id: string }) => w.id)).toEqual([
          wishlistIds.get(viewerId),
          wishlistIds.get(assignments.get(viewerId) as string),
          child.body.id,
        ]);
      }
    });
  });
});
