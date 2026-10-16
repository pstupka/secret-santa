import { Application } from 'express';

import createApp from '@app';
import { Db, migrateToLatest, openDatabase } from '@db/database';
import { createEmailSender } from '@email/sender';
import { Clock } from '@shared/clock';
import { AppDeps } from '../deps';
import { createFakeMailer, FakeMailer } from './fakeMailer';

export const TEST_PUBLIC_URL = 'https://santa.test';

// A clock tests can move: `clock.set('2026-12-01T10:00:00Z')`.
export interface TestClock extends Clock {
  set(isoTimestamp: string): void;
}

export const createTestClock = (
  isoTimestamp = '2026-11-01T12:00:00.000Z',
): TestClock => {
  let current = new Date(isoTimestamp);
  return {
    now: () => new Date(current.getTime()),
    set: (next: string) => {
      current = new Date(next);
    },
  };
};

// Fresh in-memory SQLite with all migrations applied. Call `db.destroy()` when done.
export const createTestDb = async (): Promise<Db> => {
  const db = openDatabase(':memory:');
  await migrateToLatest(db);
  return db;
};

export interface TestContext extends AppDeps {
  app: Application;
  clock: TestClock;
  mailer: FakeMailer;
  // Drains the outbox once through the fake mailer; returns how many were sent.
  sendEmails(): Promise<number>;
  close(): Promise<void>;
}

// App wired to an in-memory database, for supertest.
export const createTestContext = async (): Promise<TestContext> => {
  const db = await createTestDb();
  const clock = createTestClock();
  const app = createApp({ db, clock });
  const mailer = createFakeMailer();
  const sender = createEmailSender({
    db,
    clock,
    mailer,
    publicUrl: TEST_PUBLIC_URL,
    throttleMs: 0,
  });
  return {
    app,
    db,
    clock,
    mailer,
    sendEmails: sender.sendDue,
    close: () => db.destroy(),
  };
};
