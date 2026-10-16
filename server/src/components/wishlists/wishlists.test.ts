import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { agent as request, Test } from 'supertest';
import httpStatus from 'http-status';

import newId from '@shared/ids';
import { ACTING_AS_HEADER } from '@components/events/eventAccess.middleware';
import { createTestContext, TestContext } from '@test/harness';
import {
  addManagedParticipant,
  addMember,
  OrganizedEvent,
  organizeEvent,
} from '@test/fixtures';
import { findOwnWishlist } from './wishlists.service';
import { MAX_ITEMS_PER_WISHLIST } from './wishlists.validation';

describe('Wishlists API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(() => ctx.close());

  const finish = () => ctx.clock.set('2026-12-25T12:00:00.000Z');

  const markDrawn = (eventId: string) =>
    ctx.db
      .updateTable('events')
      .set({ status: 'drawn', drawn_at: ctx.clock.now().toISOString() })
      .where('id', '=', eventId)
      .execute();

  const withActingAs = (req: Test, actingAs?: string) =>
    actingAs ? req.set(ACTING_AS_HEADER, actingAs) : req;

  const listWishlists = (eventId: string, token: string, actingAs?: string) =>
    withActingAs(
      request(ctx.app)
        .get(`/api/events/${eventId}/wishlists`)
        .set('Authorization', `Bearer ${token}`),
      actingAs,
    );

  const createWishlist = (
    eventId: string,
    token: string,
    body: object,
    actingAs?: string,
  ) =>
    withActingAs(
      request(ctx.app)
        .post(`/api/events/${eventId}/wishlists`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
      actingAs,
    );

  const updateWishlist = (
    eventId: string,
    token: string,
    wishlistId: string,
    body: object,
    actingAs?: string,
  ) =>
    withActingAs(
      request(ctx.app)
        .patch(`/api/events/${eventId}/wishlists/${wishlistId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
      actingAs,
    );

  const deleteWishlist = (
    eventId: string,
    token: string,
    wishlistId: string,
    actingAs?: string,
  ) =>
    withActingAs(
      request(ctx.app)
        .delete(`/api/events/${eventId}/wishlists/${wishlistId}`)
        .set('Authorization', `Bearer ${token}`),
      actingAs,
    );

  // Organizer Ania, members Tomek and Ola, Babcia Zosia managed by Tomek.
  const setUpFamily = async () => {
    const event = await organizeEvent(ctx);
    const tomek = await addMember(ctx, event, 'tomek@example.com', 'Tomek');
    const ola = await addMember(ctx, event, 'ola@example.com', 'Ola');
    const zosiaId = await addManagedParticipant(
      ctx,
      event,
      tomek.participantId,
      'Babcia Zosia',
    );
    return { event, tomek, ola, zosiaId };
  };

  const ownWishlist = {
    notes: 'Rozmiar M',
    items: [
      { title: 'Szalik', url: 'https://example.com/szalik', notes: 'Zielony' },
      { title: 'Książka' },
    ],
  };

  const createOwn = async (eventId: string, token: string, actingAs?: string) =>
    (
      await createWishlist(eventId, token, ownWishlist, actingAs).expect(
        httpStatus.CREATED,
      )
    ).body;

  const createChild = async (
    eventId: string,
    token: string,
    childName: string,
  ) =>
    (
      await createWishlist(eventId, token, {
        childName,
        items: [{ title: 'Klocki' }],
      }).expect(httpStatus.CREATED)
    ).body;

  describe('POST /api/events/:eventId/wishlists', () => {
    test('creates the participant’s own wishlist with items in order', async () => {
      const { event, tomek } = await setUpFamily();

      const res = await createWishlist(
        event.eventId,
        tomek.token,
        ownWishlist,
      ).expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.any(String),
        participantId: tomek.participantId,
        participantName: 'Tomek',
        childName: null,
        notes: 'Rozmiar M',
        createdAt: '2026-11-01T12:00:00.000Z',
        updatedAt: '2026-11-01T12:00:00.000Z',
        items: [
          {
            id: expect.any(String),
            title: 'Szalik',
            url: 'https://example.com/szalik',
            notes: 'Zielony',
          },
          { id: expect.any(String), title: 'Książka', url: null, notes: null },
        ],
      });
    });

    test('creates a child wishlist; blank notes and urls become null', async () => {
      const { event, tomek } = await setUpFamily();

      const res = await createWishlist(event.eventId, tomek.token, {
        childName: '  Staś ',
        notes: '  ',
        items: [{ title: 'Klocki', url: '', notes: '' }],
      }).expect(httpStatus.CREATED);

      expect(res.body).toMatchObject({
        childName: 'Staś',
        notes: null,
        items: [{ title: 'Klocki', url: null, notes: null }],
      });
    });

    test('allows at most one own wishlist per participant', async () => {
      const { event, tomek } = await setUpFamily();
      await createOwn(event.eventId, tomek.token);

      await createWishlist(event.eventId, tomek.token, {
        childName: null,
        items: [],
      }).expect(httpStatus.CONFLICT);
      // Child wishlists are not limited by that.
      await createChild(event.eventId, tomek.token, 'Staś');
      await createChild(event.eventId, tomek.token, 'Kasia');
    });

    test('rejects invalid input with 400', async () => {
      const { event, tomek } = await setUpFamily();
      const rejects = (body: object) =>
        createWishlist(event.eventId, tomek.token, body).expect(
          httpStatus.BAD_REQUEST,
        );

      await rejects({ items: [{ title: ' ' }] });
      await rejects({
        items: [{ title: 'Szalik', url: 'ftp://example.com/x' }],
      });
      await rejects({ items: [{ title: 'Szalik', id: newId() }] });
      await rejects({ childName: '' });
      await rejects({
        items: Array.from({ length: MAX_ITEMS_PER_WISHLIST + 1 }, () => ({
          title: 'Szalik',
        })),
      });
    });

    test('lets a caretaker create a managed participant’s wishlist with X-Acting-As', async () => {
      const { event, tomek, zosiaId } = await setUpFamily();

      const res = await createWishlist(
        event.eventId,
        tomek.token,
        ownWishlist,
        zosiaId,
      ).expect(httpStatus.CREATED);

      expect(res.body).toMatchObject({
        participantId: zosiaId,
        participantName: 'Babcia Zosia',
        childName: null,
      });
      // Tomek's own wishlist is still free.
      await createOwn(event.eventId, tomek.token);
    });

    test('rejects X-Acting-As from someone who is not the caretaker with 403', async () => {
      const { event, ola, zosiaId } = await setUpFamily();

      await createWishlist(
        event.eventId,
        ola.token,
        ownWishlist,
        zosiaId,
      ).expect(httpStatus.FORBIDDEN);
    });

    test('is allowed after the draw but not once the event is finished', async () => {
      const { event, tomek, ola } = await setUpFamily();
      await markDrawn(event.eventId);
      await createOwn(event.eventId, tomek.token);

      finish();
      await createWishlist(event.eventId, ola.token, ownWishlist).expect(
        httpStatus.CONFLICT,
      );
    });

    test('rejects non-participants with 404', async () => {
      const { event } = await setUpFamily();
      const other = await organizeEvent(ctx, {
        organizerEmail: 'obcy@example.com',
      });

      await createWishlist(
        event.eventId,
        other.organizerToken,
        ownWishlist,
      ).expect(httpStatus.NOT_FOUND);
    });
  });

  describe('GET /api/events/:eventId/wishlists', () => {
    test('member A can’t see member B’s own wishlist; everyone sees child wishlists', async () => {
      const { event, tomek, ola } = await setUpFamily();
      const tomekOwn = await createOwn(event.eventId, tomek.token);
      const olaOwn = await createOwn(event.eventId, ola.token);
      const stas = await createChild(event.eventId, tomek.token, 'Staś');
      ctx.clock.set('2026-11-02T08:00:00.000Z');
      const kasia = await createChild(event.eventId, ola.token, 'Kasia');

      const ids = async (token: string, actingAs?: string) =>
        (
          await listWishlists(event.eventId, token, actingAs).expect(
            httpStatus.OK,
          )
        ).body.map((wishlist: { id: string }) => wishlist.id);

      // Own wishlist first, then child wishlists oldest first.
      expect(await ids(tomek.token)).toEqual([tomekOwn.id, stas.id, kasia.id]);
      expect(await ids(ola.token)).toEqual([olaOwn.id, stas.id, kasia.id]);
      expect(await ids(event.organizerToken)).toEqual([stas.id, kasia.id]);
    });

    test('returns full wishlists with items', async () => {
      const { event, tomek, ola } = await setUpFamily();
      const stas = await createChild(event.eventId, tomek.token, 'Staś');

      const res = await listWishlists(event.eventId, ola.token).expect(
        httpStatus.OK,
      );

      // Ola is not Staś's parent, so the items carry claim info.
      expect(res.body).toEqual([
        {
          ...stas,
          items: [{ ...stas.items[0], claimedByMe: false, claimedBy: null }],
        },
      ]);
    });

    test('a caretaker sees the managed participant’s own wishlist with X-Acting-As', async () => {
      const { event, tomek, ola, zosiaId } = await setUpFamily();
      const zosiaOwn = await createOwn(event.eventId, tomek.token, zosiaId);
      const tomekOwn = await createOwn(event.eventId, tomek.token);

      const asZosia = await listWishlists(
        event.eventId,
        tomek.token,
        zosiaId,
      ).expect(httpStatus.OK);
      expect(asZosia.body).toEqual([zosiaOwn]);

      const asTomek = await listWishlists(event.eventId, tomek.token).expect(
        httpStatus.OK,
      );
      expect(asTomek.body).toEqual([tomekOwn]);

      // Nobody else sees it, the organizer included.
      expect(
        (await listWishlists(event.eventId, ola.token).expect(httpStatus.OK))
          .body,
      ).toEqual([]);
      expect(
        (
          await listWishlists(event.eventId, event.organizerToken).expect(
            httpStatus.OK,
          )
        ).body,
      ).toEqual([]);
    });

    test('does not show wishlists of other events', async () => {
      const { event, tomek } = await setUpFamily();
      await createChild(event.eventId, tomek.token, 'Staś');
      const other = await organizeEvent(ctx, {
        organizerEmail: 'obcy@example.com',
      });
      await addMember(ctx, other, 'tomek@example.com', 'Tomek');

      const res = await listWishlists(other.eventId, tomek.token).expect(
        httpStatus.OK,
      );
      expect(res.body).toEqual([]);
    });

    test('is readable once the event is finished', async () => {
      const { event, tomek } = await setUpFamily();
      const own = await createOwn(event.eventId, tomek.token);
      finish();

      const res = await listWishlists(event.eventId, tomek.token).expect(
        httpStatus.OK,
      );
      expect(res.body).toEqual([own]);
    });
  });

  describe('PATCH /api/events/:eventId/wishlists/:wishlistId', () => {
    test('replaces fields and items, keeping the ids of items passed with an id', async () => {
      const { event, tomek } = await setUpFamily();
      const own = await createOwn(event.eventId, tomek.token);
      const [szalik, ksiazka] = own.items;
      // A claim on the kept item must survive the edit (claims come with #9).
      await ctx.db
        .updateTable('wishlist_items')
        .set({
          claimed_by_participant_id: event.organizerParticipantId,
          claimed_at: '2026-11-01T12:00:00.000Z',
        })
        .where('id', '=', ksiazka.id)
        .execute();
      ctx.clock.set('2026-11-02T08:00:00.000Z');

      const res = await updateWishlist(event.eventId, tomek.token, own.id, {
        notes: '',
        items: [
          { id: ksiazka.id, title: 'Książka kucharska', url: null },
          { title: 'Rękawiczki', url: 'http://example.com/r' },
        ],
      }).expect(httpStatus.OK);

      expect(res.body).toEqual({
        ...own,
        notes: null,
        updatedAt: '2026-11-02T08:00:00.000Z',
        items: [
          {
            id: ksiazka.id,
            title: 'Książka kucharska',
            url: null,
            notes: null,
          },
          {
            id: expect.any(String),
            title: 'Rękawiczki',
            url: 'http://example.com/r',
            notes: null,
          },
        ],
      });
      const stored = await ctx.db
        .selectFrom('wishlist_items')
        .selectAll()
        .where('wishlist_id', '=', own.id)
        .orderBy('position')
        .execute();
      expect(stored.map((item) => item.id)).not.toContain(szalik.id);
      expect(stored[0]).toMatchObject({
        id: ksiazka.id,
        position: 0,
        claimed_by_participant_id: event.organizerParticipantId,
      });
    });

    test('leaves items and notes alone when not given', async () => {
      const { event, tomek } = await setUpFamily();
      const stas = await createChild(event.eventId, tomek.token, 'Staś');

      const res = await updateWishlist(event.eventId, tomek.token, stas.id, {
        childName: 'Stasiu',
      }).expect(httpStatus.OK);

      expect(res.body).toEqual({ ...stas, childName: 'Stasiu' });
    });

    test('rejects item ids from another wishlist and child names on an own wishlist with 400', async () => {
      const { event, tomek } = await setUpFamily();
      const own = await createOwn(event.eventId, tomek.token);
      const stas = await createChild(event.eventId, tomek.token, 'Staś');

      await updateWishlist(event.eventId, tomek.token, own.id, {
        items: [{ id: stas.items[0].id, title: 'Klocki' }],
      }).expect(httpStatus.BAD_REQUEST);
      await updateWishlist(event.eventId, tomek.token, own.id, {
        items: [
          { id: own.items[0].id, title: 'A' },
          { id: own.items[0].id, title: 'B' },
        ],
      }).expect(httpStatus.BAD_REQUEST);
      await updateWishlist(event.eventId, tomek.token, own.id, {
        childName: 'Staś',
      }).expect(httpStatus.BAD_REQUEST);
      await updateWishlist(event.eventId, tomek.token, own.id, {}).expect(
        httpStatus.BAD_REQUEST,
      );

      expect(await findOwnWishlist(ctx.db, tomek.participantId)).toEqual(own);
    });

    test('only the owner can change a wishlist', async () => {
      const { event, tomek, ola } = await setUpFamily();
      const own = await createOwn(event.eventId, tomek.token);
      const stas = await createChild(event.eventId, tomek.token, 'Staś');
      const change = { notes: 'Zmiana' };

      // Someone else's own wishlist is not visible at all.
      await updateWishlist(event.eventId, ola.token, own.id, change).expect(
        httpStatus.NOT_FOUND,
      );
      await updateWishlist(event.eventId, ola.token, stas.id, change).expect(
        httpStatus.FORBIDDEN,
      );
      await updateWishlist(
        event.eventId,
        event.organizerToken,
        stas.id,
        change,
      ).expect(httpStatus.FORBIDDEN);
      await updateWishlist(event.eventId, ola.token, newId(), change).expect(
        httpStatus.NOT_FOUND,
      );
    });

    test('caretaker can edit managed participant’s wishlist via X-Acting-As', async () => {
      const { event, tomek, zosiaId } = await setUpFamily();
      const zosiaOwn = await createOwn(event.eventId, tomek.token, zosiaId);

      // Without the header the caretaker acts as themselves.
      await updateWishlist(event.eventId, tomek.token, zosiaOwn.id, {
        notes: 'Ciepłe skarpety',
      }).expect(httpStatus.NOT_FOUND);

      const res = await updateWishlist(
        event.eventId,
        tomek.token,
        zosiaOwn.id,
        { notes: 'Ciepłe skarpety', items: [{ title: 'Kapcie' }] },
        zosiaId,
      ).expect(httpStatus.OK);
      expect(res.body).toMatchObject({
        participantId: zosiaId,
        notes: 'Ciepłe skarpety',
        items: [{ title: 'Kapcie' }],
      });
    });

    test('is allowed after the draw but not once the event is finished', async () => {
      const { event, tomek } = await setUpFamily();
      const own = await createOwn(event.eventId, tomek.token);
      await markDrawn(event.eventId);
      await updateWishlist(event.eventId, tomek.token, own.id, {
        notes: 'Po losowaniu',
      }).expect(httpStatus.OK);

      finish();
      await updateWishlist(event.eventId, tomek.token, own.id, {
        notes: 'Za późno',
      }).expect(httpStatus.CONFLICT);
    });
  });

  describe('DELETE /api/events/:eventId/wishlists/:wishlistId', () => {
    test('deletes the owner’s wishlist with its items', async () => {
      const { event, tomek } = await setUpFamily();
      const own = await createOwn(event.eventId, tomek.token);

      await deleteWishlist(event.eventId, tomek.token, own.id).expect(
        httpStatus.NO_CONTENT,
      );

      expect(
        await findOwnWishlist(ctx.db, tomek.participantId),
      ).toBeUndefined();
      expect(
        await ctx.db
          .selectFrom('wishlist_items')
          .select('id')
          .where('wishlist_id', '=', own.id)
          .execute(),
      ).toEqual([]);
      // A new own wishlist can be created again.
      await createOwn(event.eventId, tomek.token);
    });

    test('only the owner can delete; a caretaker via X-Acting-As', async () => {
      const { event, tomek, ola, zosiaId } = await setUpFamily();
      const stas = await createChild(event.eventId, tomek.token, 'Staś');
      const zosiaOwn = await createOwn(event.eventId, tomek.token, zosiaId);

      await deleteWishlist(event.eventId, ola.token, stas.id).expect(
        httpStatus.FORBIDDEN,
      );
      await deleteWishlist(event.eventId, ola.token, zosiaOwn.id).expect(
        httpStatus.NOT_FOUND,
      );
      await deleteWishlist(
        event.eventId,
        tomek.token,
        zosiaOwn.id,
        zosiaId,
      ).expect(httpStatus.NO_CONTENT);
    });

    test('is not allowed once the event is finished', async () => {
      const { event, tomek } = await setUpFamily();
      const own = await createOwn(event.eventId, tomek.token);
      finish();

      await deleteWishlist(event.eventId, tomek.token, own.id).expect(
        httpStatus.CONFLICT,
      );
    });
  });

  describe('wishlistFilled in the organizer’s participant list', () => {
    const filledFlags = async (event: OrganizedEvent) =>
      Object.fromEntries(
        (
          await request(ctx.app)
            .get(`/api/events/${event.eventId}/participants`)
            .set('Authorization', `Bearer ${event.organizerToken}`)
            .expect(httpStatus.OK)
        ).body.map((p: { displayName: string; wishlistFilled: boolean }) => [
          p.displayName,
          p.wishlistFilled,
        ]),
      );

    test('is set by an own wishlist with at least one item', async () => {
      const { event, tomek, ola, zosiaId } = await setUpFamily();
      await createOwn(event.eventId, tomek.token, zosiaId);
      // Notes only, no items.
      await createWishlist(event.eventId, ola.token, {
        notes: 'Cokolwiek',
      }).expect(httpStatus.CREATED);
      // Child wishlists do not count.
      await createChild(event.eventId, event.organizerToken, 'Staś');

      expect(await filledFlags(event)).toEqual({
        Ania: false,
        Tomek: false,
        Ola: false,
        'Babcia Zosia': true,
      });
    });
  });
});
