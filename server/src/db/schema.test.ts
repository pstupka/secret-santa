import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { sql } from 'kysely';

import { Db } from '@db/database';
import newId from '@shared/ids';
import { createTestDb } from '@test/harness';

const NOW = '2026-11-01T12:00:00.000Z';

describe('Database schema', () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(() => db.destroy());

  const insertPerson = async (email = `${newId()}@example.com`) => {
    const id = newId();
    await db
      .insertInto('persons')
      .values({ id, email, created_at: NOW })
      .execute();
    return id;
  };

  const insertEvent = async () => {
    const id = newId();
    await db
      .insertInto('events')
      .values({
        id,
        title: 'Family Christmas',
        timezone: 'Europe/Warsaw',
        exchange_on: '2026-12-24',
        status: 'open',
        created_at: NOW,
        updated_at: NOW,
      })
      .execute();
    return id;
  };

  const insertParticipant = async (
    eventId: string,
    owner: { personId: string } | { caretakerId: string },
  ) => {
    const id = newId();
    await db
      .insertInto('participants')
      .values({
        id,
        event_id: eventId,
        person_id: 'personId' in owner ? owner.personId : null,
        managed_by_participant_id:
          'caretakerId' in owner ? owner.caretakerId : null,
        display_name: 'Someone',
        role: 'member',
        status: 'active',
        added_at: NOW,
      })
      .execute();
    return id;
  };

  test('migrations create every table from the design', async () => {
    const tables = await sql<{ name: string }>`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'kysely_%' AND name NOT LIKE 'sqlite_%'
      ORDER BY name`.execute(db);

    expect(tables.rows.map((t) => t.name)).toEqual([
      'access_tokens',
      'assignments',
      'email_outbox',
      'events',
      'exclusions',
      'participants',
      'persons',
      'wishlist_items',
      'wishlists',
    ]);
  });

  test('foreign keys are enforced', async () => {
    await expect(
      insertParticipant(newId(), { personId: await insertPerson() }),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  test('person email is unique regardless of case', async () => {
    await insertPerson('Santa@Example.com');
    await expect(insertPerson('santa@example.com')).rejects.toThrow(/UNIQUE/);
  });

  test('event status must be open or drawn', async () => {
    const eventId = await insertEvent();
    await expect(
      sql`UPDATE events SET status = 'finished' WHERE id = ${eventId}`.execute(
        db,
      ),
    ).rejects.toThrow(/CHECK/);
  });

  describe('participants', () => {
    test('a participant with neither person nor caretaker is rejected', async () => {
      const eventId = await insertEvent();
      await expect(
        db
          .insertInto('participants')
          .values({
            id: newId(),
            event_id: eventId,
            display_name: 'Nobody',
            role: 'member',
            status: 'active',
            added_at: NOW,
          })
          .execute(),
      ).rejects.toThrow(/CHECK/);
    });

    test('a participant with both person and caretaker is rejected', async () => {
      const eventId = await insertEvent();
      const caretakerId = await insertParticipant(eventId, {
        personId: await insertPerson(),
      });
      await expect(
        db
          .insertInto('participants')
          .values({
            id: newId(),
            event_id: eventId,
            person_id: await insertPerson(),
            managed_by_participant_id: caretakerId,
            display_name: 'Both',
            role: 'member',
            status: 'active',
            added_at: NOW,
          })
          .execute(),
      ).rejects.toThrow(/CHECK/);
    });

    test('a person takes part in an event at most once', async () => {
      const eventId = await insertEvent();
      const personId = await insertPerson();
      await insertParticipant(eventId, { personId });
      await expect(insertParticipant(eventId, { personId })).rejects.toThrow(
        /UNIQUE/,
      );
    });

    test('one caretaker can have several managed participants', async () => {
      const eventId = await insertEvent();
      const caretakerId = await insertParticipant(eventId, {
        personId: await insertPerson(),
      });
      await insertParticipant(eventId, { caretakerId });
      await expect(
        insertParticipant(eventId, { caretakerId }),
      ).resolves.toBeDefined();
    });

    test('role and status are restricted', async () => {
      const eventId = await insertEvent();
      const id = await insertParticipant(eventId, {
        personId: await insertPerson(),
      });
      await expect(
        sql`UPDATE participants SET role = 'admin' WHERE id = ${id}`.execute(
          db,
        ),
      ).rejects.toThrow(/CHECK/);
      await expect(
        sql`UPDATE participants SET status = 'invited' WHERE id = ${id}`.execute(
          db,
        ),
      ).rejects.toThrow(/CHECK/);
    });
  });

  describe('exclusions', () => {
    const twoParticipants = async () => {
      const eventId = await insertEvent();
      const ids = [
        await insertParticipant(eventId, { personId: await insertPerson() }),
        await insertParticipant(eventId, { personId: await insertPerson() }),
      ].sort();
      return { eventId, lower: ids[0], higher: ids[1] };
    };

    test('an exclusion stored with a < b is accepted', async () => {
      const { eventId, lower, higher } = await twoParticipants();
      await expect(
        db
          .insertInto('exclusions')
          .values({
            event_id: eventId,
            participant_a_id: lower,
            participant_b_id: higher,
          })
          .execute(),
      ).resolves.toBeDefined();
    });

    test('an exclusion with a > b is rejected', async () => {
      const { eventId, lower, higher } = await twoParticipants();
      await expect(
        db
          .insertInto('exclusions')
          .values({
            event_id: eventId,
            participant_a_id: higher,
            participant_b_id: lower,
          })
          .execute(),
      ).rejects.toThrow(/CHECK/);
    });
  });

  describe('assignments', () => {
    test('a participant cannot be assigned to themselves', async () => {
      const eventId = await insertEvent();
      const id = await insertParticipant(eventId, {
        personId: await insertPerson(),
      });
      await expect(
        db
          .insertInto('assignments')
          .values({ event_id: eventId, giver_id: id, receiver_id: id })
          .execute(),
      ).rejects.toThrow(/CHECK/);
    });

    test('a recipient has exactly one Santa', async () => {
      const eventId = await insertEvent();
      const [a, b, c] = [
        await insertParticipant(eventId, { personId: await insertPerson() }),
        await insertParticipant(eventId, { personId: await insertPerson() }),
        await insertParticipant(eventId, { personId: await insertPerson() }),
      ];
      await db
        .insertInto('assignments')
        .values({ event_id: eventId, giver_id: a, receiver_id: c })
        .execute();
      await expect(
        db
          .insertInto('assignments')
          .values({ event_id: eventId, giver_id: b, receiver_id: c })
          .execute(),
      ).rejects.toThrow(/UNIQUE/);
    });
  });

  test('a participant has at most one own wishlist but many child wishlists', async () => {
    const eventId = await insertEvent();
    const participantId = await insertParticipant(eventId, {
      personId: await insertPerson(),
    });
    const wishlist = (childName: string | null) =>
      db
        .insertInto('wishlists')
        .values({
          id: newId(),
          event_id: eventId,
          participant_id: participantId,
          child_name: childName,
          created_at: NOW,
          updated_at: NOW,
        })
        .execute();

    await wishlist(null);
    await wishlist('Ala');
    await wishlist('Olek');
    await expect(wishlist(null)).rejects.toThrow(/UNIQUE/);
  });

  test('deleting an event cascades to all its data', async () => {
    const eventId = await insertEvent();
    const caretakerId = await insertParticipant(eventId, {
      personId: await insertPerson(),
    });
    const managedId = await insertParticipant(eventId, { caretakerId });
    const wishlistId = newId();
    await db
      .insertInto('wishlists')
      .values({
        id: wishlistId,
        event_id: eventId,
        participant_id: managedId,
        created_at: NOW,
        updated_at: NOW,
      })
      .execute();
    await db
      .insertInto('wishlist_items')
      .values({
        id: newId(),
        wishlist_id: wishlistId,
        position: 0,
        title: 'Warm socks',
      })
      .execute();

    await db.deleteFrom('events').where('id', '=', eventId).execute();

    const counts = await Promise.all(
      (['participants', 'wishlists', 'wishlist_items'] as const).map((table) =>
        db
          .selectFrom(table)
          .select((eb) => eb.fn.countAll<number>().as('n'))
          .executeTakeFirstOrThrow(),
      ),
    );
    expect(counts.map((c) => c.n)).toEqual([0, 0, 0]);
    // Persons outlive events; retention cleans them up separately.
    const persons = await db.selectFrom('persons').select('id').execute();
    expect(persons).toHaveLength(1);
  });
});
