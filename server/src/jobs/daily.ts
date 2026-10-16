// Daily maintenance (PLAN.md, Deployment): run once a day by supercronic in
// the `cron` service, against the same /data volume as the app.
//   node dist/jobs/daily.js
import config from '@config/config';
import { migrateToLatest, openDatabase } from '@db/database';
import { systemClock } from '@shared/clock';
import logger from '@core/utils/logger';
import { runDailyJob } from './dailyJob';

const { databasePath, backupDir, backupRcloneRemote } = config;

const main = async (): Promise<void> => {
  const db = openDatabase(databasePath);
  try {
    // Normally a no-op: the app migrates on start. Keeps retention queries
    // valid if the job runs before the app has started on a new image.
    await migrateToLatest(db);
    const { retention, backup } = await runDailyJob({
      db,
      clock: systemClock,
      backupDir,
      rcloneRemote: backupRcloneRemote,
    });
    logger.info(
      `Retention deleted ${retention.events} event(s), ${retention.persons} person(s), ${retention.sentEmails} sent email(s)`,
    );
    const offsite = backup.copiedTo
      ? `copied to ${backup.copiedTo}`
      : 'no offsite copy (BACKUP_RCLONE_REMOTE unset)';
    logger.info(
      `Backup written to ${backup.file} (${backup.deleted.length} old snapshot(s) removed), ${offsite}`,
    );
  } finally {
    await db.destroy();
  }
};

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error : String(error));
  process.exitCode = 1;
});
