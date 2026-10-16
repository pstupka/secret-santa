import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Migration, Migrator } from 'kysely/migration';

import { Database } from './schema';
import * as initialSchema from './migrations/0001-initial-schema';

export type Db = Kysely<Database>;

// Migrations are registered statically (not read from disk) so the same list
// works under Vitest, tsx and the compiled dist/.
const migrations: Record<string, Migration> = {
  '0001-initial-schema': initialSchema,
};

// Opens a SQLite database (file path or ':memory:') with WAL and foreign keys on.
export const openDatabase = (path: string): Db => {
  const sqlite = new SQLite(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  return new Kysely<Database>({
    dialect: new SqliteDialect({ database: sqlite }),
  });
};

export const migrateToLatest = async (db: Db): Promise<void> => {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: async () => migrations },
  });
  const { error } = await migrator.migrateToLatest();
  if (error) {
    throw error;
  }
};
