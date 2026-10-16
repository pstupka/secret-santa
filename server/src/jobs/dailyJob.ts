import { Db } from '@db/database';
import { Clock } from '@shared/clock';
import { backupDatabase, BackupResult, OffsiteCopy } from './backup';
import { applyRetention, RetentionResult } from './retention';

export interface DailyJobOptions {
  db: Db;
  clock: Clock;
  backupDir: string;
  rcloneRemote?: string;
  copyOffsite?: OffsiteCopy;
}

export interface DailyJobResult {
  retention: RetentionResult;
  backup: BackupResult;
}

// Retention first, so the snapshot never holds data that is due for deletion.
export const runDailyJob = async ({
  db,
  clock,
  backupDir,
  rcloneRemote,
  copyOffsite,
}: DailyJobOptions): Promise<DailyJobResult> => {
  const retention = await applyRetention(db, clock);
  const backup = await backupDatabase({
    db,
    clock,
    dir: backupDir,
    remote: rcloneRemote,
    copyOffsite,
  });
  return { retention, backup };
};
