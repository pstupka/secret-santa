import { setTimeout as sleep } from 'node:timers/promises';

import { Db } from '@db/database';
import { EmailOutboxRow } from '@db/schema';
import { Clock, nowUtc, toUtcTimestamp } from '@shared/clock';
import logger from '@core/utils/logger';
import { Mailer } from './mailer';
import { renderEmail } from './templates';

export const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;

// Delay before the next attempt after `attempts` failures: 1, 2, 4, 8 minutes.
export const retryDelayMs = (attempts: number): number =>
  60_000 * 2 ** (attempts - 1);

export interface EmailSenderOptions {
  db: Db;
  clock: Clock;
  mailer: Mailer;
  publicUrl: string;
  // Pause between two messages, to stay under SMTP provider rate limits.
  throttleMs: number;
}

export interface EmailSender {
  // Sends every due outbox row once. Returns how many were sent.
  sendDue(): Promise<number>;
  // Calls sendDue every `intervalMs` until stop(); ticks never overlap.
  start(intervalMs: number): void;
  stop(): Promise<void>;
}

// The raw magic token must not outlive delivery.
const withoutToken = (payload: string): string => {
  const parsed = JSON.parse(payload);
  delete parsed.token;
  return JSON.stringify(parsed);
};

export const createEmailSender = ({
  db,
  clock,
  mailer,
  publicUrl,
  throttleMs,
}: EmailSenderOptions): EmailSender => {
  const sendOne = async (row: EmailOutboxRow): Promise<boolean> => {
    try {
      const email = renderEmail(
        row.template,
        JSON.parse(row.payload),
        publicUrl,
      );
      await mailer.send({ to: row.to_email, ...email });
    } catch (error) {
      const attempts = row.attempts + 1;
      const message = error instanceof Error ? error.message : String(error);
      await db
        .updateTable('email_outbox')
        .set({
          attempts,
          last_error: message,
          send_after: toUtcTimestamp(
            new Date(clock.now().getTime() + retryDelayMs(attempts)),
          ),
        })
        .where('id', '=', row.id)
        .execute();
      if (attempts >= MAX_ATTEMPTS) {
        logger.error(
          `Email ${row.id} (${row.template}) failed ${attempts} times, giving up: ${message}`,
        );
      } else {
        logger.warn(
          `Email ${row.id} (${row.template}) failed, attempt ${attempts}/${MAX_ATTEMPTS}: ${message}`,
        );
      }
      return false;
    }

    await db
      .updateTable('email_outbox')
      .set({ sent_at: nowUtc(clock), payload: withoutToken(row.payload) })
      .where('id', '=', row.id)
      .execute();
    logger.info(`Email ${row.id} (${row.template}) sent`);
    return true;
  };

  const sendDue = async (): Promise<number> => {
    const due = await db
      .selectFrom('email_outbox')
      .selectAll()
      .where('sent_at', 'is', null)
      .where('attempts', '<', MAX_ATTEMPTS)
      .where('send_after', '<=', nowUtc(clock))
      .orderBy('send_after')
      .orderBy('id')
      .limit(BATCH_SIZE)
      .execute();

    let sent = 0;
    // Sequential on purpose: one SMTP connection, throttled.
    // eslint-disable-next-line no-restricted-syntax
    for (const [index, row] of due.entries()) {
      if (index > 0 && throttleMs > 0) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(throttleMs);
      }
      // eslint-disable-next-line no-await-in-loop
      if (await sendOne(row)) {
        sent += 1;
      }
    }
    return sent;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let stopped = true;

  const tick = (intervalMs: number) => {
    running = sendDue()
      .then(() => undefined)
      .catch((error) => {
        logger.error('Email sender tick failed', error);
      })
      .finally(() => {
        running = undefined;
        if (!stopped) {
          timer = setTimeout(() => tick(intervalMs), intervalMs);
        }
      });
  };

  return {
    sendDue,
    start: (intervalMs) => {
      if (!stopped) return;
      stopped = false;
      timer = setTimeout(() => tick(intervalMs), intervalMs);
    },
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await running;
    },
  };
};
