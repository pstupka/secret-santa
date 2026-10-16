/* eslint-disable security/detect-non-literal-fs-filename */
import { execFile } from 'node:child_process';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { sql } from 'kysely';

import { Db } from '@db/database';
import { Clock } from '@shared/clock';

// Snapshots kept locally; older ones are deleted after each backup.
export const BACKUPS_KEPT = 14;

const SNAPSHOT_PATTERN = /^santa-\d{4}-\d{2}-\d{2}\.db$/;

// Copies a snapshot file somewhere off the VPS.
export type OffsiteCopy = (file: string, remote: string) => Promise<void>;

// `rclone copy <file> <remote>`: the remote is configured outside the app
// (e.g. RCLONE_CONFIG_<NAME>_* environment variables).
export const rcloneCopy: OffsiteCopy = async (file, remote) => {
  await promisify(execFile)('rclone', ['copy', file, remote]);
};

export interface BackupOptions {
  db: Db;
  clock: Clock;
  dir: string;
  // rclone destination such as `b2:santa-backups`; no offsite copy when unset.
  remote?: string;
  copyOffsite?: OffsiteCopy;
  keep?: number;
}

export interface BackupResult {
  file: string;
  deleted: string[];
  copiedTo?: string;
}

// santa-YYYY-MM-DD.db, dated in UTC (the cron schedule's timezone).
export const snapshotName = (clock: Clock): string =>
  `santa-${clock.now().toISOString().slice(0, 10)}.db`;

// Writes a consistent snapshot with VACUUM INTO, keeps the newest `keep`
// snapshots in `dir`, then copies the new one offsite when a remote is set.
// A second run on the same day replaces that day's snapshot.
export const backupDatabase = async ({
  db,
  clock,
  dir,
  remote,
  copyOffsite = rcloneCopy,
  keep = BACKUPS_KEPT,
}: BackupOptions): Promise<BackupResult> => {
  await mkdir(dir, { recursive: true });
  const file = join(dir, snapshotName(clock));
  // VACUUM INTO refuses an existing file; write aside and rename so a failed
  // run never leaves a half-written snapshot under a real name.
  const partial = `${file}.partial`;
  await rm(partial, { force: true });
  await sql`VACUUM INTO ${partial}`.execute(db);
  await rename(partial, file);

  const snapshots = (await readdir(dir))
    .filter((name) => SNAPSHOT_PATTERN.test(name))
    .sort()
    .reverse();
  const deleted = snapshots.slice(keep);
  await Promise.all(deleted.map((name) => rm(join(dir, name))));

  if (remote) {
    await copyOffsite(file, remote);
  }
  return { file, deleted, copiedTo: remote || undefined };
};
