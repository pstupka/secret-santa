import { describe, test, expect, beforeEach, afterEach } from 'vitest';

import { enqueueEmail } from '@email/outbox';
import newId from '@shared/ids';
import { createTestContext, signIn, TestContext } from '@test/harness';
import { addMember, organizeEvent } from '@test/fixtures';
import { applyRetention } from './retention';

describe('Retention', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(() => ctx.close());

  const eventExists = async (eventId: string) =>
    (await ctx.db
      .selectFrom('events')
      .select('id')
      .where('id', '=', eventId)
      .executeTakeFirst()) !== undefined;

  const personExists = async (email: string) =>
    (await ctx.db
      .selectFrom('persons')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst()) !== undefined;

  const count = async (
    table: 'participants' | 'wishlists' | 'access_tokens' | 'email_outbox',
  ) =>
    Number(
      (
        await ctx.db
          .selectFrom(table)
          .select(({ fn }) => fn.countAll().as('n'))
          .executeTakeFirstOrThrow()
      ).n,
    );

  describe('events', () => {
    // Exchange date 2026-12-24 in Europe/Warsaw (UTC+1 in February): the
    // 60th day after it is 2027-02-22, the event goes on 2027-02-23 local.
    test('an event is kept through the 60th day after its exchange date', async () => {
      const { eventId } = await organizeEvent(ctx);

      ctx.clock.set('2027-02-22T22:59:59.000Z'); // 23:59:59 on 22 Feb in Warsaw
      expect((await applyRetention(ctx.db, ctx.clock)).events).toBe(0);
      expect(await eventExists(eventId)).toBe(true);
    });

    test('an event is deleted from the 61st day after its exchange date, in its timezone', async () => {
      const warsaw = await organizeEvent(ctx);
      const utc = await organizeEvent(ctx, {
        timezone: 'UTC',
        organizerEmail: 'bartek@example.com',
      });

      ctx.clock.set('2027-02-22T23:00:00.000Z'); // 23 Feb in Warsaw, 22 Feb in UTC
      expect((await applyRetention(ctx.db, ctx.clock)).events).toBe(1);
      expect(await eventExists(warsaw.eventId)).toBe(false);
      expect(await eventExists(utc.eventId)).toBe(true);

      ctx.clock.set('2027-02-23T00:00:00.000Z');
      expect((await applyRetention(ctx.db, ctx.clock)).events).toBe(1);
      expect(await eventExists(utc.eventId)).toBe(false);
    });

    test('deleting an event deletes its participants and wishlists', async () => {
      const organized = await organizeEvent(ctx);
      const member = await addMember(
        ctx,
        organized,
        'basia@example.com',
        'Basia',
      );
      await ctx.db
        .insertInto('wishlists')
        .values({
          id: newId(),
          event_id: organized.eventId,
          participant_id: member.participantId,
          child_name: null,
          notes: null,
          created_at: '2026-11-01T12:00:00.000Z',
          updated_at: '2026-11-01T12:00:00.000Z',
        })
        .execute();

      ctx.clock.set('2027-03-01T12:00:00.000Z');
      await applyRetention(ctx.db, ctx.clock);

      expect(await count('participants')).toBe(0);
      expect(await count('wishlists')).toBe(0);
    });
  });

  describe('persons', () => {
    test('a person left without participations is deleted with their magic tokens', async () => {
      const organized = await organizeEvent(ctx);
      await addMember(ctx, organized, 'basia@example.com', 'Basia');
      expect(await count('access_tokens')).toBeGreaterThan(0);

      ctx.clock.set('2027-03-01T12:00:00.000Z');
      const result = await applyRetention(ctx.db, ctx.clock);

      expect(result.persons).toBe(2);
      expect(await personExists('ania@example.com')).toBe(false);
      expect(await personExists('basia@example.com')).toBe(false);
      expect(await count('access_tokens')).toBe(0);
    });

    test('a person who still participates in a kept event is kept', async () => {
      const old = await organizeEvent(ctx, { exchangeOn: '2026-11-15' });
      await addMember(ctx, old, 'basia@example.com', 'Basia');
      const current = await organizeEvent(ctx, {
        exchangeOn: '2027-12-24',
        organizerEmail: 'basia@example.com',
        organizerName: 'Basia',
      });

      ctx.clock.set('2027-01-20T12:00:00.000Z');
      const result = await applyRetention(ctx.db, ctx.clock);

      expect(await eventExists(old.eventId)).toBe(false);
      expect(await eventExists(current.eventId)).toBe(true);
      expect(result.persons).toBe(1);
      expect(await personExists('ania@example.com')).toBe(false);
      expect(await personExists('basia@example.com')).toBe(true);
    });

    test('a person who never had a participation is deleted', async () => {
      await signIn(ctx, 'cezary@example.com');

      const result = await applyRetention(ctx.db, ctx.clock);

      expect(result.persons).toBe(1);
      expect(await personExists('cezary@example.com')).toBe(false);
      expect(await count('access_tokens')).toBe(0);
    });
  });

  describe('sent emails', () => {
    const queueEmail = async (sentAt: string | null) => {
      const id = await enqueueEmail(ctx.db, ctx.clock, {
        to: 'anna@example.com',
        template: 'access-link',
        payload: { token: 'raw-magic-token' },
      });
      await ctx.db
        .updateTable('email_outbox')
        .set({ sent_at: sentAt })
        .where('id', '=', id)
        .execute();
    };

    test('sent emails older than 7 days are deleted; newer and unsent ones stay', async () => {
      ctx.clock.set('2026-11-20T12:00:00.000Z');
      await queueEmail('2026-11-13T11:59:59.999Z'); // just over 7 days ago
      await queueEmail('2026-11-13T12:00:00.000Z'); // exactly 7 days ago
      await queueEmail('2026-11-19T12:00:00.000Z');
      await queueEmail(null); // never sent, however old

      const result = await applyRetention(ctx.db, ctx.clock);

      expect(result.sentEmails).toBe(1);
      expect(await count('email_outbox')).toBe(3);
      expect(
        await ctx.db
          .selectFrom('email_outbox')
          .select('id')
          .where('sent_at', 'is', null)
          .execute(),
      ).toHaveLength(1);
    });
  });
});
