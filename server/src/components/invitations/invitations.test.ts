import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { agent as request } from 'supertest';
import httpStatus from 'http-status';

import newId from '@shared/ids';
import {
  createTestContext,
  magicTokenFrom,
  TestContext,
  TEST_PUBLIC_URL,
} from '@test/harness';
import {
  addManagedParticipant,
  addMember as addMemberTo,
  decline,
  OrganizedEvent,
  organizeEvent as organizeEventIn,
} from '@test/fixtures';

describe('Invitations API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(() => ctx.close());

  const organizeEvent = async (overrides: Record<string, unknown> = {}) => {
    const event = await organizeEventIn(ctx, overrides);
    // Only the organizer's personal link; tests check what invitations send.
    await ctx.sendEmails();
    ctx.mailer.sent.length = 0;
    return event;
  };

  const addMember = (
    event: OrganizedEvent,
    email: string,
    displayName: string,
  ) => addMemberTo(ctx, event, email, displayName);

  const sendPending = (eventId: string, token: string) =>
    request(ctx.app)
      .post(`/api/events/${eventId}/invitations/send`)
      .set('Authorization', `Bearer ${token}`);

  const sendOne = (eventId: string, token: string, participantId: string) =>
    request(ctx.app)
      .post(`/api/events/${eventId}/participants/${participantId}/invitation`)
      .set('Authorization', `Bearer ${token}`);

  const sentTo = () => ctx.mailer.sent.map((email) => email.to).sort();

  const inviteSentAt = async (participantId: string) =>
    (
      await ctx.db
        .selectFrom('participants')
        .select('invite_sent_at')
        .where('id', '=', participantId)
        .executeTakeFirstOrThrow()
    ).invite_sent_at;

  const markDrawn = (eventId: string) =>
    ctx.db
      .updateTable('events')
      .set({ status: 'drawn', drawn_at: ctx.clock.now().toISOString() })
      .where('id', '=', eventId)
      .execute();

  // The day after the exchange date in Warsaw.
  const finish = () => ctx.clock.set('2026-12-25T12:00:00.000Z');

  // Organizer Ania, members Tomek and Ola, Babcia Zosia managed by Tomek.
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
    return { event, tomek, ola, zosiaId };
  };

  describe('POST /api/events/:eventId/invitations/send', () => {
    test('invites every non-managed participant not yet invited, except the organizer', async () => {
      const { event, tomek, ola, zosiaId } = await setUpFamily();

      const res = await sendPending(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );

      expect(res.body).toEqual({ sent: 2 });
      expect(await inviteSentAt(tomek.participantId)).toBe(
        '2026-11-01T12:00:00.000Z',
      );
      expect(await inviteSentAt(ola.participantId)).toBe(
        '2026-11-01T12:00:00.000Z',
      );
      expect(await inviteSentAt(zosiaId)).toBeNull();

      await ctx.sendEmails();
      expect(sentTo()).toEqual(['ola@example.com', 'tomek@example.com']);
    });

    test('calling it twice sends each participant exactly one email', async () => {
      const { event } = await setUpFamily();

      await sendPending(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );
      const again = await sendPending(
        event.eventId,
        event.organizerToken,
      ).expect(httpStatus.OK);

      expect(again.body).toEqual({ sent: 0 });
      await ctx.sendEmails();
      expect(sentTo()).toEqual(['ola@example.com', 'tomek@example.com']);
    });

    test('invites only participants added since the last bulk send', async () => {
      const { event } = await setUpFamily();
      await sendPending(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );
      await ctx.sendEmails();
      ctx.mailer.sent.length = 0;

      await addMember(event, 'kasia@example.com', 'Kasia');
      const res = await sendPending(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );

      expect(res.body).toEqual({ sent: 1 });
      await ctx.sendEmails();
      expect(sentTo()).toEqual(['kasia@example.com']);
    });

    test('sends the event details and a working personal link', async () => {
      const { event } = await setUpFamily();

      await sendPending(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );
      await ctx.sendEmails();

      const email = ctx.mailer.sent.find((e) => e.to === 'tomek@example.com');
      expect(email?.subject).toBe(
        'Ania zaprasza Cię na Mikołajki „Wigilia 2026”',
      );
      expect(email?.text).toContain('Cześć Tomek!');
      expect(email?.text).toContain('Rodzinne Mikołajki');
      expect(email?.text).toContain('Bez skarpetek.');
      expect(email?.text).toMatch(/150,00\s*zł/);
      expect(email?.text).toContain('24 grudnia 2026');
      expect(email?.text).toContain('listę życzeń');
      expect(email?.text).toContain(`${TEST_PUBLIC_URL}/auth#token=`);

      await request(ctx.app)
        .get(`/api/events/${event.eventId}`)
        .set('Authorization', `Bearer ${magicTokenFrom(email!)}`)
        .expect(httpStatus.OK);
    });

    test('does nothing when everyone is already invited', async () => {
      const event = await organizeEvent();

      const res = await sendPending(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );

      expect(res.body).toEqual({ sent: 0 });
      expect(await ctx.sendEmails()).toBe(0);
    });

    test('also invites a participant who declined before being invited', async () => {
      const { event, ola } = await setUpFamily();
      await decline(ctx, event.eventId, ola.token);

      const res = await sendPending(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );

      expect(res.body).toEqual({ sent: 2 });
    });

    test('rejects a member who is not the organizer with 403', async () => {
      const { event, tomek } = await setUpFamily();

      await sendPending(event.eventId, tomek.token).expect(
        httpStatus.FORBIDDEN,
      );
      expect(await inviteSentAt(tomek.participantId)).toBeNull();
    });

    test('requires a magic token', async () => {
      const { event } = await setUpFamily();

      await request(ctx.app)
        .post(`/api/events/${event.eventId}/invitations/send`)
        .expect(httpStatus.UNAUTHORIZED);
    });

    test.each([
      ['drawn', markDrawn],
      ['finished', finish],
    ])('rejects sending once the event is %s with 409', async (_case, lock) => {
      const { event } = await setUpFamily();
      await lock(event.eventId);

      await sendPending(event.eventId, event.organizerToken).expect(
        httpStatus.CONFLICT,
      );
      expect(await ctx.sendEmails()).toBe(0);
    });
  });

  describe('POST /api/events/:eventId/participants/:participantId/invitation', () => {
    test('sends the invitation to one participant', async () => {
      const { event, tomek, ola } = await setUpFamily();

      const res = await sendOne(
        event.eventId,
        event.organizerToken,
        tomek.participantId,
      ).expect(httpStatus.OK);

      expect(res.body).toEqual({
        participantId: tomek.participantId,
        inviteSentAt: '2026-11-01T12:00:00.000Z',
      });
      expect(await inviteSentAt(ola.participantId)).toBeNull();
      await ctx.sendEmails();
      expect(sentTo()).toEqual(['tomek@example.com']);
    });

    test('resends with a new personal link each time', async () => {
      const { event, tomek } = await setUpFamily();
      await sendPending(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );
      await ctx.sendEmails();

      ctx.clock.set('2026-11-05T09:00:00.000Z');
      await sendOne(
        event.eventId,
        event.organizerToken,
        tomek.participantId,
      ).expect(httpStatus.OK);
      await ctx.sendEmails();

      const tomekEmails = ctx.mailer.sent.filter(
        (e) => e.to === 'tomek@example.com',
      );
      expect(tomekEmails).toHaveLength(2);
      const [first, second] = tomekEmails.map(magicTokenFrom);
      expect(second).not.toBe(first);
      expect(await inviteSentAt(tomek.participantId)).toBe(
        '2026-11-05T09:00:00.000Z',
      );
      // Earlier links keep working.
      await Promise.all(
        [first, second].map((token) =>
          request(ctx.app)
            .get(`/api/events/${event.eventId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(httpStatus.OK),
        ),
      );
    });

    test('rejects a managed participant with 422', async () => {
      const { event, zosiaId } = await setUpFamily();

      await sendOne(event.eventId, event.organizerToken, zosiaId).expect(
        httpStatus.UNPROCESSABLE_ENTITY,
      );
      expect(await inviteSentAt(zosiaId)).toBeNull();
      expect(await ctx.sendEmails()).toBe(0);
    });

    test('rejects an unknown participant with 404', async () => {
      const { event } = await setUpFamily();

      await sendOne(event.eventId, event.organizerToken, newId()).expect(
        httpStatus.NOT_FOUND,
      );
    });

    test("rejects another event's participant with 404", async () => {
      const { event } = await setUpFamily();
      const other = await organizeEvent({
        organizerEmail: 'ola@example.com',
        organizerName: 'Ola',
      });
      const kasia = await addMember(other, 'kasia@example.com', 'Kasia');

      await sendOne(
        event.eventId,
        event.organizerToken,
        kasia.participantId,
      ).expect(httpStatus.NOT_FOUND);
    });

    test('rejects a member who is not the organizer with 403', async () => {
      const { event, tomek, ola } = await setUpFamily();

      await sendOne(event.eventId, tomek.token, ola.participantId).expect(
        httpStatus.FORBIDDEN,
      );
    });

    test.each([
      ['drawn', markDrawn],
      ['finished', finish],
    ])('rejects sending once the event is %s with 409', async (_case, lock) => {
      const { event, tomek } = await setUpFamily();
      await lock(event.eventId);

      await sendOne(
        event.eventId,
        event.organizerToken,
        tomek.participantId,
      ).expect(httpStatus.CONFLICT);
      expect(await ctx.sendEmails()).toBe(0);
    });
  });
});
