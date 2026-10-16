/* eslint-disable security/detect-non-literal-fs-filename */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import SQLite from 'better-sqlite3';

import { Db } from '@db/database';
import { createTestClock, createTestDb, TestClock } from '@test/harness';
import { backupDatabase, BACKUPS_KEPT } from './backup';

describe('Backup', () => {
  let db: Db;
  let clock: TestClock;
  let dir: string;

  beforeEach(async () => {
    db = await createTestDb();
    clock = createTestClock('2026-12-10T03:00:00.000Z');
    dir = await mkdtemp(join(tmpdir(), 'santa-backup-'));
    await db
      .insertInto('persons')
      .values({
        id: 'person-1',
        email: 'ania@example.com',
        created_at: '2026-12-01T00:00:00.000Z',
      })
      .execute();
  });

  afterEach(async () => {
    await db.destroy();
    await rm(dir, { recursive: true, force: true });
  });

  const emailsIn = (file: string): string[] => {
    const snapshot = new SQLite(file, { readonly: true });
    try {
      return snapshot
        .prepare('SELECT email FROM persons')
        .all()
        .map((row) => (row as { email: string }).email);
    } finally {
      snapshot.close();
    }
  };

  test('writes a dated snapshot of the database', async () => {
    const result = await backupDatabase({ db, clock, dir });

    expect(result.file).toBe(join(dir, 'santa-2026-12-10.db'));
    expect(emailsIn(result.file)).toEqual(['ania@example.com']);
    expect(await readdir(dir)).toEqual(['santa-2026-12-10.db']);
  });

  test('a second run on the same day replaces that day’s snapshot', async () => {
    await backupDatabase({ db, clock, dir });
    await db
      .insertInto('persons')
      .values({
        id: 'person-2',
        email: 'basia@example.com',
        created_at: '2026-12-10T04:00:00.000Z',
      })
      .execute();

    const result = await backupDatabase({ db, clock, dir });

    expect(emailsIn(result.file)).toHaveLength(2);
    expect(await readdir(dir)).toEqual(['santa-2026-12-10.db']);
  });

  test(`keeps the latest ${BACKUPS_KEPT} snapshots and leaves other files alone`, async () => {
    const older = Array.from(
      { length: 20 },
      (_, i) => `santa-2026-11-${String(i + 1).padStart(2, '0')}.db`,
    );
    await Promise.all(
      [...older, 'notes.txt'].map((name) => writeFile(join(dir, name), '')),
    );

    const result = await backupDatabase({ db, clock, dir });

    const kept = (await readdir(dir)).sort();
    expect(kept).toEqual(
      [
        ...older.slice(-(BACKUPS_KEPT - 1)),
        'notes.txt',
        'santa-2026-12-10.db',
      ].sort(),
    );
    expect(result.deleted.sort()).toEqual(
      older.slice(0, 20 - (BACKUPS_KEPT - 1)),
    );
  });

  test('copies the new snapshot offsite when a remote is set', async () => {
    const copyOffsite = vi.fn(async () => {});

    const result = await backupDatabase({
      db,
      clock,
      dir,
      remote: 'b2:santa-backups',
      copyOffsite,
    });

    expect(copyOffsite).toHaveBeenCalledWith(
      join(dir, 'santa-2026-12-10.db'),
      'b2:santa-backups',
    );
    expect(result.copiedTo).toBe('b2:santa-backups');
  });

  test('makes no offsite copy without a remote', async () => {
    const copyOffsite = vi.fn(async () => {});

    const result = await backupDatabase({ db, clock, dir, copyOffsite });

    expect(copyOffsite).not.toHaveBeenCalled();
    expect(result.copiedTo).toBeUndefined();
  });
});
