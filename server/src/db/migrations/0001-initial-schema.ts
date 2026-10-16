import { Kysely, sql } from 'kysely';

// Schema from PLAN.md "Database design". Written as raw DDL so the CHECK and
// UNIQUE constraints read exactly as designed.
const statements = [
  sql`CREATE TABLE persons (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at    TEXT NOT NULL
  )`,

  sql`CREATE TABLE access_tokens (
    id            TEXT PRIMARY KEY,
    person_id     TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL UNIQUE,
    created_at    TEXT NOT NULL,
    expires_at    TEXT NOT NULL,
    last_used_at  TEXT,
    revoked_at    TEXT
  )`,
  sql`CREATE INDEX access_tokens_person_id ON access_tokens(person_id)`,

  sql`CREATE TABLE events (
    id               TEXT PRIMARY KEY,
    title            TEXT NOT NULL,
    description      TEXT,
    budget_amount    INTEGER,
    budget_currency  TEXT,
    rules            TEXT,
    timezone         TEXT NOT NULL,
    exchange_on      TEXT NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('open','drawn')),
    drawn_at         TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  )`,

  sql`CREATE TABLE participants (
    id            TEXT PRIMARY KEY,
    event_id      TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    person_id     TEXT REFERENCES persons(id),
    managed_by_participant_id TEXT REFERENCES participants(id) ON DELETE CASCADE,
    display_name  TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('organizer','member')),
    status        TEXT NOT NULL CHECK (status IN ('active','declined')),
    added_at      TEXT NOT NULL,
    invite_sent_at TEXT,
    first_opened_at TEXT,
    responded_at  TEXT,
    UNIQUE (event_id, person_id),
    CHECK ((person_id IS NULL) = (managed_by_participant_id IS NOT NULL))
  )`,
  sql`CREATE INDEX participants_person_id ON participants(person_id)`,
  sql`CREATE INDEX participants_managed_by ON participants(managed_by_participant_id)`,

  sql`CREATE TABLE wishlists (
    id              TEXT PRIMARY KEY,
    event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    participant_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    child_name      TEXT,
    notes           TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  )`,
  sql`CREATE INDEX wishlists_event_id ON wishlists(event_id)`,
  // A participant has at most one own (non-child) wishlist.
  sql`CREATE UNIQUE INDEX wishlists_one_own_per_participant
    ON wishlists(participant_id) WHERE child_name IS NULL`,

  sql`CREATE TABLE wishlist_items (
    id           TEXT PRIMARY KEY,
    wishlist_id  TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    position     INTEGER NOT NULL,
    title        TEXT NOT NULL,
    url          TEXT,
    notes        TEXT,
    claimed_by_participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL,
    claimed_at   TEXT
  )`,
  sql`CREATE INDEX wishlist_items_wishlist_id ON wishlist_items(wishlist_id)`,
  sql`CREATE INDEX wishlist_items_claimed_by ON wishlist_items(claimed_by_participant_id)`,

  sql`CREATE TABLE exclusions (
    event_id          TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    participant_a_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    participant_b_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, participant_a_id, participant_b_id),
    CHECK (participant_a_id < participant_b_id)
  )`,

  sql`CREATE TABLE assignments (
    event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    giver_id        TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    receiver_id     TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, giver_id),
    UNIQUE (event_id, receiver_id),
    CHECK (giver_id <> receiver_id)
  )`,

  sql`CREATE TABLE email_outbox (
    id           TEXT PRIMARY KEY,
    to_email     TEXT NOT NULL,
    template     TEXT NOT NULL,
    payload      TEXT NOT NULL,
    send_after   TEXT NOT NULL,
    sent_at      TEXT,
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_error   TEXT
  )`,
  sql`CREATE INDEX email_outbox_pending ON email_outbox(send_after) WHERE sent_at IS NULL`,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  // eslint-disable-next-line no-restricted-syntax
  for (const statement of statements) {
    // eslint-disable-next-line no-await-in-loop
    await statement.execute(db);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  const tables = [
    'email_outbox',
    'assignments',
    'exclusions',
    'wishlist_items',
    'wishlists',
    'participants',
    'events',
    'access_tokens',
    'persons',
  ];
  // eslint-disable-next-line no-restricted-syntax
  for (const table of tables) {
    // eslint-disable-next-line no-await-in-loop
    await db.schema.dropTable(table).execute();
  }
}
