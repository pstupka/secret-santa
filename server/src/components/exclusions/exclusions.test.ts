import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { agent as request } from 'supertest';
import httpStatus from 'http-status';

import { createTestContext, signIn, TestContext } from '@test/harness';
import {
  addManagedParticipant,
  addMember,
  decline,
  OrganizedEvent,
  organizeEvent,
} from '@test/fixtures';
import { listExclusions } from './exclusions.service';

describe('Exclusions API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(() => ctx.close());

  const listRequest = (eventId: string, token: string) =>
    request(ctx.app)
      .get(`/api/events/${eventId}/exclusions`)
      .set('Authorization', `Bearer ${token}`);

  const addRequest = (eventId: string, token: string, body: object) =>
    request(ctx.app)
      .post(`/api/events/${eventId}/exclusions`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const removeRequest = (
    eventId: string,
    token: string,
    aId: string,
    bId: string,
  ) =>
    request(ctx.app)
      .delete(`/api/events/${eventId}/exclusions/${aId}/${bId}`)
      .set('Authorization', `Bearer ${token}`);

  const storedExclusions = () =>
    ctx.db.selectFrom('exclusions').selectAll().execute();

  const sorted = (firstId: string, secondId: string) =>
    [firstId, secondId].sort() as [string, string];

  const pair = (firstId: string, secondId: string, builtIn = false) => {
    const [participantAId, participantBId] = sorted(firstId, secondId);
    return { participantAId, participantBId, builtIn };
  };

  const markDrawn = (eventId: string) =>
    ctx.db
      .updateTable('events')
      .set({ status: 'drawn', drawn_at: ctx.clock.now().toISOString() })
      .where('id', '=', eventId)
      .execute();

  // The day after the exchange date in Warsaw.
  const finish = () => ctx.clock.set('2026-12-25T12:00:00.000Z');

  // An event with the organizer and two members.
  const organizeFamily = async () => {
    const event = await organizeEvent(ctx);
    const tomek = await addMember(ctx, event, 'tomek@example.com', 'Tomek');
    const ola = await addMember(ctx, event, 'ola@example.com', 'Ola');
    return { event, tomek, ola };
  };

  const exclude = (event: OrganizedEvent, firstId: string, secondId: string) =>
    addRequest(event.eventId, event.organizerToken, {
      participantAId: firstId,
      participantBId: secondId,
    }).expect(httpStatus.CREATED);

  describe('POST /api/events/:eventId/exclusions', () => {
    test('lets the organizer exclude two participants, stored in normalised order', async () => {
      const { event, tomek, ola } = await organizeFamily();
      const [low, high] = sorted(tomek.participantId, ola.participantId);

      const res = await addRequest(event.eventId, event.organizerToken, {
        participantAId: high,
        participantBId: low,
      }).expect(httpStatus.CREATED);

      expect(res.body).toEqual(pair(low, high));
      expect(await storedExclusions()).toEqual([
        {
          event_id: event.eventId,
          participant_a_id: low,
          participant_b_id: high,
        },
      ]);
    });

    test('rejects the same pair again, in either order, with 409', async () => {
      const { event, tomek, ola } = await organizeFamily();
      await exclude(event, tomek.participantId, ola.participantId);

      await addRequest(event.eventId, event.organizerToken, {
        participantAId: tomek.participantId,
        participantBId: ola.participantId,
      }).expect(httpStatus.CONFLICT);
      await addRequest(event.eventId, event.organizerToken, {
        participantAId: ola.participantId,
        participantBId: tomek.participantId,
      }).expect(httpStatus.CONFLICT);

      expect(await storedExclusions()).toHaveLength(1);
    });

    test('rejects a caretaker and their managed participant with 409: they are always excluded', async () => {
      const { event, tomek } = await organizeFamily();
      const kasia = await addManagedParticipant(
        ctx,
        event,
        tomek.participantId,
        'Kasia',
      );

      await addRequest(event.eventId, event.organizerToken, {
        participantAId: kasia,
        participantBId: tomek.participantId,
      }).expect(httpStatus.CONFLICT);
      expect(await storedExclusions()).toEqual([]);
    });

    test('allows excluding a managed participant from someone other than their caretaker', async () => {
      const { event, tomek, ola } = await organizeFamily();
      const kasia = await addManagedParticipant(
        ctx,
        event,
        tomek.participantId,
        'Kasia',
      );

      await exclude(event, kasia, ola.participantId);
      expect(await storedExclusions()).toHaveLength(1);
    });

    test('allows excluding a declined participant', async () => {
      const { event, tomek, ola } = await organizeFamily();
      await decline(ctx, event.eventId, tomek.token);

      await exclude(event, tomek.participantId, ola.participantId);
    });

    test('rejects excluding a participant from themselves with 400', async () => {
      const { event, tomek } = await organizeFamily();

      await addRequest(event.eventId, event.organizerToken, {
        participantAId: tomek.participantId,
        participantBId: tomek.participantId,
      }).expect(httpStatus.BAD_REQUEST);
    });

    test('rejects an unknown participant or one of another event with 400', async () => {
      const { event, tomek } = await organizeFamily();
      const other = await organizeEvent(ctx, {
        organizerEmail: 'basia@example.com',
      });

      await addRequest(event.eventId, event.organizerToken, {
        participantAId: tomek.participantId,
        participantBId: 'unknown',
      }).expect(httpStatus.BAD_REQUEST);
      await addRequest(event.eventId, event.organizerToken, {
        participantAId: tomek.participantId,
        participantBId: other.organizerParticipantId,
      }).expect(httpStatus.BAD_REQUEST);
      expect(await storedExclusions()).toEqual([]);
    });

    test('rejects a missing participant with 400', async () => {
      const { event, tomek } = await organizeFamily();

      await addRequest(event.eventId, event.organizerToken, {
        participantAId: tomek.participantId,
      }).expect(httpStatus.BAD_REQUEST);
    });

    test('forbids a member with 403', async () => {
      const { event, tomek, ola } = await organizeFamily();

      await addRequest(event.eventId, tomek.token, {
        participantAId: tomek.participantId,
        participantBId: ola.participantId,
      }).expect(httpStatus.FORBIDDEN);
      expect(await storedExclusions()).toEqual([]);
    });

    test('hides the event from a non-participant with 404', async () => {
      const { event, tomek, ola } = await organizeFamily();
      const { token } = await signIn(ctx, 'stranger@example.com');

      await addRequest(event.eventId, token, {
        participantAId: tomek.participantId,
        participantBId: ola.participantId,
      }).expect(httpStatus.NOT_FOUND);
    });

    test('rejects changes once the event is drawn or finished with 409', async () => {
      const { event, tomek, ola } = await organizeFamily();
      const body = {
        participantAId: tomek.participantId,
        participantBId: ola.participantId,
      };

      await markDrawn(event.eventId);
      await addRequest(event.eventId, event.organizerToken, body).expect(
        httpStatus.CONFLICT,
      );
      finish();
      await addRequest(event.eventId, event.organizerToken, body).expect(
        httpStatus.CONFLICT,
      );
      expect(await storedExclusions()).toEqual([]);
    });
  });

  describe('GET /api/events/:eventId/exclusions', () => {
    test("lists the organizer's pairs and the built-in caretaker pairs", async () => {
      const { event, tomek, ola } = await organizeFamily();
      const kasia = await addManagedParticipant(
        ctx,
        event,
        tomek.participantId,
        'Kasia',
      );
      await exclude(event, ola.participantId, tomek.participantId);
      await exclude(event, event.organizerParticipantId, kasia);

      const res = await listRequest(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );

      const expected = [
        pair(tomek.participantId, ola.participantId),
        pair(event.organizerParticipantId, kasia),
        pair(tomek.participantId, kasia, true),
      ];
      expect(res.body).toHaveLength(expected.length);
      expect(res.body).toEqual(expect.arrayContaining(expected));
    });

    test('is empty for an event without exclusions or managed participants', async () => {
      const { event } = await organizeFamily();

      const res = await listRequest(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );
      expect(res.body).toEqual([]);
    });

    test('is readable once the event is drawn or finished', async () => {
      const { event, tomek, ola } = await organizeFamily();
      await exclude(event, tomek.participantId, ola.participantId);
      await markDrawn(event.eventId);
      finish();

      const res = await listRequest(event.eventId, event.organizerToken).expect(
        httpStatus.OK,
      );
      expect(res.body).toEqual([pair(tomek.participantId, ola.participantId)]);
    });

    test('forbids a member with 403', async () => {
      const { event, tomek } = await organizeFamily();

      await listRequest(event.eventId, tomek.token).expect(
        httpStatus.FORBIDDEN,
      );
    });

    test('hides the event from a non-participant with 404', async () => {
      const { event } = await organizeFamily();
      const { token } = await signIn(ctx, 'stranger@example.com');

      await listRequest(event.eventId, token).expect(httpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /api/events/:eventId/exclusions/:aId/:bId', () => {
    test('removes a pair given in either order', async () => {
      const { event, tomek, ola } = await organizeFamily();
      const [low, high] = sorted(tomek.participantId, ola.participantId);

      await exclude(event, low, high);
      await removeRequest(
        event.eventId,
        event.organizerToken,
        high,
        low,
      ).expect(httpStatus.NO_CONTENT);
      expect(await storedExclusions()).toEqual([]);

      await exclude(event, low, high);
      await removeRequest(
        event.eventId,
        event.organizerToken,
        low,
        high,
      ).expect(httpStatus.NO_CONTENT);
      expect(await storedExclusions()).toEqual([]);
    });

    test('answers 404 for a pair that is not excluded', async () => {
      const { event, tomek, ola } = await organizeFamily();

      await removeRequest(
        event.eventId,
        event.organizerToken,
        tomek.participantId,
        ola.participantId,
      ).expect(httpStatus.NOT_FOUND);
    });

    test('does not remove a pair of another event', async () => {
      const { event, tomek, ola } = await organizeFamily();
      await exclude(event, tomek.participantId, ola.participantId);
      const other = await organizeEvent(ctx, {
        organizerEmail: 'basia@example.com',
      });

      await removeRequest(
        other.eventId,
        other.organizerToken,
        tomek.participantId,
        ola.participantId,
      ).expect(httpStatus.NOT_FOUND);
      expect(await storedExclusions()).toHaveLength(1);
    });

    test('rejects removing a built-in caretaker pair with 409', async () => {
      const { event, tomek } = await organizeFamily();
      const kasia = await addManagedParticipant(
        ctx,
        event,
        tomek.participantId,
        'Kasia',
      );

      await removeRequest(
        event.eventId,
        event.organizerToken,
        tomek.participantId,
        kasia,
      ).expect(httpStatus.CONFLICT);
    });

    test('forbids a member with 403', async () => {
      const { event, tomek, ola } = await organizeFamily();
      await exclude(event, tomek.participantId, ola.participantId);

      await removeRequest(
        event.eventId,
        tomek.token,
        tomek.participantId,
        ola.participantId,
      ).expect(httpStatus.FORBIDDEN);
      expect(await storedExclusions()).toHaveLength(1);
    });

    test('rejects changes once the event is drawn or finished with 409', async () => {
      const { event, tomek, ola } = await organizeFamily();
      await exclude(event, tomek.participantId, ola.participantId);

      await markDrawn(event.eventId);
      await removeRequest(
        event.eventId,
        event.organizerToken,
        tomek.participantId,
        ola.participantId,
      ).expect(httpStatus.CONFLICT);
      finish();
      await removeRequest(
        event.eventId,
        event.organizerToken,
        tomek.participantId,
        ola.participantId,
      ).expect(httpStatus.CONFLICT);
      expect(await storedExclusions()).toHaveLength(1);
    });
  });

  describe('listExclusions (for the draw)', () => {
    test('includes every built-in caretaker pair alongside the stored pairs', async () => {
      const { event, tomek, ola } = await organizeFamily();
      const kasia = await addManagedParticipant(
        ctx,
        event,
        tomek.participantId,
        'Kasia',
      );
      const janek = await addManagedParticipant(
        ctx,
        event,
        event.organizerParticipantId,
        'Janek',
      );
      await exclude(event, ola.participantId, kasia);

      const exclusions = await listExclusions(ctx.db, event.eventId);

      expect(exclusions).toHaveLength(3);
      expect(exclusions).toEqual(
        expect.arrayContaining([
          pair(tomek.participantId, kasia, true),
          pair(event.organizerParticipantId, janek, true),
          pair(ola.participantId, kasia),
        ]),
      );
      exclusions.forEach(({ participantAId, participantBId }) =>
        expect(participantAId < participantBId).toBe(true),
      );
    });
  });
});
