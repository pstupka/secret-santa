import { describe, test, expect, beforeEach, afterEach } from 'vitest';

import { EmailOutboxRow } from '@db/schema';
import { createTestContext, TEST_PUBLIC_URL, TestContext } from '@test/harness';
import { enqueueEmail } from './outbox';
import { MAX_ATTEMPTS, retryDelayMs } from './sender';

describe('Email outbox', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(() => ctx.close());

  const enqueueAccessLink = (token = 'raw-magic-token') =>
    enqueueEmail(ctx.db, ctx.clock, {
      to: 'anna@example.com',
      template: 'access-link',
      payload: { token },
    });

  const outboxRow = (id: string): Promise<EmailOutboxRow> =>
    ctx.db
      .selectFrom('email_outbox')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow();

  const advanceClock = (ms: number) =>
    ctx.clock.set(new Date(ctx.clock.now().getTime() + ms).toISOString());

  test('an email queued in a committed transaction is sent', async () => {
    await ctx.db.transaction().execute((trx) =>
      enqueueEmail(trx, ctx.clock, {
        to: 'anna@example.com',
        template: 'access-link',
        payload: { token: 'raw-magic-token' },
      }),
    );

    expect(await ctx.sendEmails()).toBe(1);
    expect(ctx.mailer.sent).toHaveLength(1);
    expect(ctx.mailer.sent[0].to).toBe('anna@example.com');
    expect(ctx.mailer.sent[0].text).toContain(
      `${TEST_PUBLIC_URL}/auth#token=raw-magic-token`,
    );
  });

  test('an email queued in a rolled-back transaction is never sent', async () => {
    await expect(
      ctx.db.transaction().execute(async (trx) => {
        await enqueueEmail(trx, ctx.clock, {
          to: 'anna@example.com',
          template: 'access-link',
          payload: { token: 'raw-magic-token' },
        });
        throw new Error('change failed');
      }),
    ).rejects.toThrow('change failed');

    expect(await ctx.sendEmails()).toBe(0);
    expect(ctx.mailer.sent).toEqual([]);
    const rows = await ctx.db.selectFrom('email_outbox').selectAll().execute();
    expect(rows).toEqual([]);
  });

  test('the magic token is removed from the payload after sending', async () => {
    const id = await enqueueAccessLink('raw-magic-token');
    expect(JSON.parse((await outboxRow(id)).payload)).toEqual({
      token: 'raw-magic-token',
    });

    await ctx.sendEmails();

    const row = await outboxRow(id);
    expect(row.sent_at).toBe(ctx.clock.now().toISOString());
    expect(row.payload).not.toContain('raw-magic-token');
    expect(JSON.parse(row.payload)).toEqual({});
  });

  test('a sent email is not sent again', async () => {
    await enqueueAccessLink();

    expect(await ctx.sendEmails()).toBe(1);
    expect(await ctx.sendEmails()).toBe(0);
    expect(ctx.mailer.sent).toHaveLength(1);
  });

  test('a failed send is retried after a backoff', async () => {
    const id = await enqueueAccessLink();
    ctx.mailer.failure = new Error('SMTP unavailable');

    expect(await ctx.sendEmails()).toBe(0);
    let row = await outboxRow(id);
    expect(row.attempts).toBe(1);
    expect(row.last_error).toBe('SMTP unavailable');
    expect(row.sent_at).toBeNull();
    expect(row.payload).toContain('raw-magic-token');

    ctx.mailer.failure = null;
    // Not due yet.
    expect(await ctx.sendEmails()).toBe(0);

    advanceClock(retryDelayMs(1));
    expect(await ctx.sendEmails()).toBe(1);
    row = await outboxRow(id);
    expect(row.sent_at).not.toBeNull();
    expect(row.attempts).toBe(1);
    expect(ctx.mailer.sent).toHaveLength(1);
  });

  test(`a send is given up after ${MAX_ATTEMPTS} failed attempts`, async () => {
    const id = await enqueueAccessLink();
    ctx.mailer.failure = new Error('mailbox does not exist');

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await ctx.sendEmails();
      advanceClock(retryDelayMs(attempt));
    }
    expect((await outboxRow(id)).attempts).toBe(MAX_ATTEMPTS);

    ctx.mailer.failure = null;
    advanceClock(24 * 60 * 60 * 1000);
    expect(await ctx.sendEmails()).toBe(0);

    const row = await outboxRow(id);
    expect(row.attempts).toBe(MAX_ATTEMPTS);
    expect(row.sent_at).toBeNull();
    expect(ctx.mailer.sent).toEqual([]);
  });

  test('one failing email does not block the others', async () => {
    const failing = await enqueueEmail(ctx.db, ctx.clock, {
      to: 'broken@example.com',
      template: 'access-link',
      payload: { token: 'a' },
    });
    await enqueueEmail(ctx.db, ctx.clock, {
      to: 'ok@example.com',
      template: 'access-link',
      payload: { token: 'b' },
    });
    const { send } = ctx.mailer;
    ctx.mailer.send = async (message) => {
      if (message.to === 'broken@example.com') throw new Error('rejected');
      return send(message);
    };

    expect(await ctx.sendEmails()).toBe(1);
    expect(ctx.mailer.sent.map((m) => m.to)).toEqual(['ok@example.com']);
    expect((await outboxRow(failing)).attempts).toBe(1);
  });

  test('emails queued for later are not sent early', async () => {
    const id = await enqueueAccessLink();
    await ctx.db
      .updateTable('email_outbox')
      .set({ send_after: '2030-01-01T00:00:00.000Z' })
      .where('id', '=', id)
      .execute();

    expect(await ctx.sendEmails()).toBe(0);
  });
});
