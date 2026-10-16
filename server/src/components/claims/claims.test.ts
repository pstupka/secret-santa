import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { agent as request, Test } from 'supertest';
import httpStatus from 'http-status';

import { ACTING_AS_HEADER } from '@components/events/eventAccess.middleware';
import { createTestContext, TestContext } from '@test/harness';
import {
  addManagedParticipant,
  addMember,
  decline,
  organizeEvent,
} from '@test/fixtures';

describe('Claims API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  afterEach(() => ctx.close());

  const finish = () => ctx.clock.set('2026-12-25T12:00:00.000Z');

  const withActingAs = (req: Test, actingAs?: string) =>
    actingAs ? req.set(ACTING_AS_HEADER, actingAs) : req;

  const claim = (
    eventId: string,
    token: string,
    itemId: string,
    actingAs?: string,
  ) =>
    withActingAs(
      request(ctx.app)
        .put(`/api/events/${eventId}/wishlist-items/${itemId}/claim`)
        .set('Authorization', `Bearer ${token}`),
      actingAs,
    );

  const release = (
    eventId: string,
    token: string,
    itemId: string,
    actingAs?: string,
  ) =>
    withActingAs(
      request(ctx.app)
        .delete(`/api/events/${eventId}/wishlist-items/${itemId}/claim`)
        .set('Authorization', `Bearer ${token}`),
      actingAs,
    );

  const myClaims = async (eventId: string, token: string, actingAs?: string) =>
    (
      await withActingAs(
        request(ctx.app)
          .get(`/api/events/${eventId}/my-claims`)
          .set('Authorization', `Bearer ${token}`),
        actingAs,
      ).expect(httpStatus.OK)
    ).body;

  const createWishlist = async (
    eventId: string,
    token: string,
    body: object,
    actingAs?: string,
  ) =>
    (
      await withActingAs(
        request(ctx.app)
          .post(`/api/events/${eventId}/wishlists`)
          .set('Authorization', `Bearer ${token}`)
          .send(body),
        actingAs,
      ).expect(httpStatus.CREATED)
    ).body;

  // The items of the child wishlist `wishlistId` as `token` sees them.
  const childItems = async (
    eventId: string,
    token: string,
    wishlistId: string,
    actingAs?: string,
  ) => {
    const res = await withActingAs(
      request(ctx.app)
        .get(`/api/events/${eventId}/wishlists`)
        .set('Authorization', `Bearer ${token}`),
      actingAs,
    ).expect(httpStatus.OK);
    return res.body.find(
      (wishlist: { id: string }) => wishlist.id === wishlistId,
    ).items;
  };

  // Organizer Ania, members Tomek and Ola, Babcia Zosia managed by Tomek.
  // Tomek is the parent of Staś, Ola of Kasia.
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
    const stas = await createWishlist(event.eventId, tomek.token, {
      childName: 'Staś',
      items: [
        { title: 'Klocki', url: 'https://example.com/klocki' },
        { title: 'Rower' },
      ],
    });
    ctx.clock.set('2026-11-02T08:00:00.000Z');
    const kasia = await createWishlist(event.eventId, ola.token, {
      childName: 'Kasia',
      items: [{ title: 'Lalka', notes: 'Z włosami' }],
    });
    ctx.clock.set('2026-11-03T09:00:00.000Z');
    const [klocki, rower] = stas.items;
    const [lalka] = kasia.items;
    return { event, tomek, ola, zosiaId, stas, kasia, klocki, rower, lalka };
  };

  describe('PUT /api/events/:eventId/wishlist-items/:itemId/claim', () => {
    test('claims a child wishlist item and returns it as a my-claims entry', async () => {
      const { event, ola, stas, klocki } = await setUpFamily();

      const res = await claim(event.eventId, ola.token, klocki.id).expect(
        httpStatus.OK,
      );

      expect(res.body).toEqual({
        wishlistId: stas.id,
        childName: 'Staś',
        parentName: 'Tomek',
        claimedAt: '2026-11-03T09:00:00.000Z',
        item: {
          id: klocki.id,
          title: 'Klocki',
          url: 'https://example.com/klocki',
          notes: null,
        },
      });
    });

    test('shows the claim to other participants, with claimedByMe for the claimer', async () => {
      const { event, ola, stas, klocki, rower } = await setUpFamily();
      await claim(event.eventId, ola.token, klocki.id).expect(httpStatus.OK);

      expect(await childItems(event.eventId, ola.token, stas.id)).toEqual([
        { ...klocki, claimedByMe: true, claimedBy: 'Ola' },
        { ...rower, claimedByMe: false, claimedBy: null },
      ]);
      expect(
        await childItems(event.eventId, event.organizerToken, stas.id),
      ).toEqual([
        { ...klocki, claimedByMe: false, claimedBy: 'Ola' },
        { ...rower, claimedByMe: false, claimedBy: null },
      ]);
    });

    test('the parent sees no claim fields on their child’s wishlist', async () => {
      const { event, tomek, ola, zosiaId, stas, klocki, rower } =
        await setUpFamily();
      await claim(event.eventId, ola.token, klocki.id).expect(httpStatus.OK);

      expect(await childItems(event.eventId, tomek.token, stas.id)).toEqual([
        klocki,
        rower,
      ]);
      // Nor when the parent acts as a managed participant.
      expect(
        await childItems(event.eventId, tomek.token, stas.id, zosiaId),
      ).toEqual([klocki, rower]);
    });

    test('a caretaker counts as the parent of a managed participant’s child', async () => {
      const { event, tomek, ola, zosiaId } = await setUpFamily();
      const wnuczek = await createWishlist(
        event.eventId,
        tomek.token,
        { childName: 'Wnuczek', items: [{ title: 'Piłka' }] },
        zosiaId,
      );
      const [pilka] = wnuczek.items;
      await claim(event.eventId, ola.token, pilka.id).expect(httpStatus.OK);

      expect(
        await childItems(event.eventId, tomek.token, wnuczek.id, zosiaId),
      ).toEqual([pilka]);
      expect(await childItems(event.eventId, tomek.token, wnuczek.id)).toEqual([
        pilka,
      ]);
      await claim(event.eventId, tomek.token, pilka.id).expect(
        httpStatus.FORBIDDEN,
      );
    });

    test('a second claimer gets 409', async () => {
      const { event, ola, klocki } = await setUpFamily();
      await claim(event.eventId, ola.token, klocki.id).expect(httpStatus.OK);

      await claim(event.eventId, event.organizerToken, klocki.id).expect(
        httpStatus.CONFLICT,
      );
      expect(await myClaims(event.eventId, event.organizerToken)).toEqual([]);
    });

    test('of two concurrent claims only one wins', async () => {
      const { event, ola, klocki } = await setUpFamily();

      const statuses = (
        await Promise.all([
          claim(event.eventId, ola.token, klocki.id),
          claim(event.eventId, event.organizerToken, klocki.id),
        ])
      ).map((res) => res.status);

      expect(statuses.sort()).toEqual([httpStatus.OK, httpStatus.CONFLICT]);
    });

    test('is idempotent for the same claimer', async () => {
      const { event, ola, klocki } = await setUpFamily();
      const first = await claim(event.eventId, ola.token, klocki.id).expect(
        httpStatus.OK,
      );
      ctx.clock.set('2026-11-04T10:00:00.000Z');

      const again = await claim(event.eventId, ola.token, klocki.id).expect(
        httpStatus.OK,
      );

      expect(again.body).toEqual(first.body);
    });

    test('the child’s parent cannot claim, also not via X-Acting-As', async () => {
      const { event, tomek, zosiaId, klocki } = await setUpFamily();

      await claim(event.eventId, tomek.token, klocki.id).expect(
        httpStatus.FORBIDDEN,
      );
      await claim(event.eventId, tomek.token, klocki.id, zosiaId).expect(
        httpStatus.FORBIDDEN,
      );
    });

    test('items of own wishlists, unknown items and other events’ items are 404', async () => {
      const { event, tomek, ola, lalka } = await setUpFamily();
      const own = await createWishlist(event.eventId, tomek.token, {
        items: [{ title: 'Szalik' }],
      });
      const other = await organizeEvent(ctx, {
        organizerEmail: 'obcy@example.com',
      });
      const otherChild = await createWishlist(
        other.eventId,
        other.organizerToken,
        { childName: 'Obcy', items: [{ title: 'Gra' }] },
      );

      await claim(event.eventId, ola.token, own.items[0].id).expect(
        httpStatus.NOT_FOUND,
      );
      await claim(event.eventId, tomek.token, 'nope').expect(
        httpStatus.NOT_FOUND,
      );
      await claim(event.eventId, ola.token, otherChild.items[0].id).expect(
        httpStatus.NOT_FOUND,
      );
      // An item of this event, through another event's URL.
      await claim(other.eventId, other.organizerToken, lalka.id).expect(
        httpStatus.NOT_FOUND,
      );
    });

    test('a caretaker claims for a managed participant with X-Acting-As', async () => {
      const { event, tomek, ola, zosiaId, kasia, lalka } = await setUpFamily();

      await claim(event.eventId, tomek.token, lalka.id, zosiaId).expect(
        httpStatus.OK,
      );

      expect(
        await childItems(event.eventId, tomek.token, kasia.id, zosiaId),
      ).toEqual([{ ...lalka, claimedByMe: true, claimedBy: 'Babcia Zosia' }]);
      expect(await childItems(event.eventId, tomek.token, kasia.id)).toEqual([
        { ...lalka, claimedByMe: false, claimedBy: 'Babcia Zosia' },
      ]);
      expect(await childItems(event.eventId, ola.token, kasia.id)).toEqual([
        lalka,
      ]);
      expect(await myClaims(event.eventId, tomek.token)).toEqual([]);
      expect(await myClaims(event.eventId, tomek.token, zosiaId)).toHaveLength(
        1,
      );
    });

    test('a declined participant can still claim', async () => {
      const { event, ola, klocki } = await setUpFamily();
      await decline(ctx, event.eventId, ola.token);

      await claim(event.eventId, ola.token, klocki.id).expect(httpStatus.OK);
    });

    test('is not allowed once the event is finished', async () => {
      const { event, ola, klocki } = await setUpFamily();
      finish();

      await claim(event.eventId, ola.token, klocki.id).expect(
        httpStatus.CONFLICT,
      );
    });

    test('rejects non-participants with 404', async () => {
      const { event, klocki } = await setUpFamily();
      const other = await organizeEvent(ctx, {
        organizerEmail: 'obcy@example.com',
      });

      await claim(event.eventId, other.organizerToken, klocki.id).expect(
        httpStatus.NOT_FOUND,
      );
    });
  });

  describe('DELETE /api/events/:eventId/wishlist-items/:itemId/claim', () => {
    test('the claimer releases their claim', async () => {
      const { event, ola, stas, klocki } = await setUpFamily();
      await claim(event.eventId, ola.token, klocki.id).expect(httpStatus.OK);

      await release(event.eventId, ola.token, klocki.id).expect(
        httpStatus.NO_CONTENT,
      );

      expect(
        (await childItems(event.eventId, ola.token, stas.id))[0],
      ).toMatchObject({ claimedByMe: false, claimedBy: null });
      expect(await myClaims(event.eventId, ola.token)).toEqual([]);
      // Releasing an unclaimed item changes nothing.
      await release(event.eventId, ola.token, klocki.id).expect(
        httpStatus.NO_CONTENT,
      );
    });

    test('only the claimer can release a claim', async () => {
      const { event, tomek, ola, klocki } = await setUpFamily();
      await claim(event.eventId, ola.token, klocki.id).expect(httpStatus.OK);

      await release(event.eventId, event.organizerToken, klocki.id).expect(
        httpStatus.FORBIDDEN,
      );
      await release(event.eventId, tomek.token, klocki.id).expect(
        httpStatus.FORBIDDEN,
      );
      expect(await myClaims(event.eventId, ola.token)).toHaveLength(1);
    });

    test('is not allowed once the event is finished', async () => {
      const { event, ola, klocki } = await setUpFamily();
      await claim(event.eventId, ola.token, klocki.id).expect(httpStatus.OK);
      finish();

      await release(event.eventId, ola.token, klocki.id).expect(
        httpStatus.CONFLICT,
      );
    });
  });

  describe('GET /api/events/:eventId/my-claims', () => {
    test('lists the caller’s claims by child wishlist with child and parent names', async () => {
      const { event, ola, stas, kasia, klocki, rower, lalka } =
        await setUpFamily();
      await claim(event.eventId, event.organizerToken, lalka.id).expect(
        httpStatus.OK,
      );
      await claim(event.eventId, event.organizerToken, rower.id).expect(
        httpStatus.OK,
      );
      await claim(event.eventId, event.organizerToken, klocki.id).expect(
        httpStatus.OK,
      );
      await claim(event.eventId, ola.token, klocki.id).expect(
        httpStatus.CONFLICT,
      );

      const claims = await myClaims(event.eventId, event.organizerToken);

      expect(
        claims.map(
          (entry: {
            wishlistId: string;
            childName: string;
            item: { id: string };
          }) => [entry.wishlistId, entry.childName, entry.item.id],
        ),
      ).toEqual([
        [stas.id, 'Staś', klocki.id],
        [stas.id, 'Staś', rower.id],
        [kasia.id, 'Kasia', lalka.id],
      ]);
      expect(claims[2]).toEqual({
        wishlistId: kasia.id,
        childName: 'Kasia',
        parentName: 'Ola',
        claimedAt: '2026-11-03T09:00:00.000Z',
        item: lalka,
      });
      expect(await myClaims(event.eventId, ola.token)).toEqual([]);
    });

    test('is readable once the event is finished', async () => {
      const { event, ola, lalka } = await setUpFamily();
      await claim(event.eventId, event.organizerToken, lalka.id).expect(
        httpStatus.OK,
      );
      finish();

      expect(await myClaims(event.eventId, event.organizerToken)).toHaveLength(
        1,
      );
      expect(await myClaims(event.eventId, ola.token)).toEqual([]);
    });
  });

  test('removing the claimer releases their claims', async () => {
    const { event, ola, klocki, stas } = await setUpFamily();
    const piotr = await addMember(ctx, event, 'piotr@example.com', 'Piotr');
    await claim(event.eventId, piotr.token, klocki.id).expect(httpStatus.OK);

    await request(ctx.app)
      .delete(
        `/api/events/${event.eventId}/participants/${piotr.participantId}`,
      )
      .set('Authorization', `Bearer ${event.organizerToken}`)
      .expect(httpStatus.NO_CONTENT);

    expect(
      (await childItems(event.eventId, ola.token, stas.id))[0],
    ).toMatchObject({ claimedByMe: false, claimedBy: null });
    await claim(event.eventId, ola.token, klocki.id).expect(httpStatus.OK);
  });

  test('a claim survives the parent editing the item', async () => {
    const { event, tomek, ola, stas, klocki } = await setUpFamily();
    await claim(event.eventId, ola.token, klocki.id).expect(httpStatus.OK);

    await request(ctx.app)
      .patch(`/api/events/${event.eventId}/wishlists/${stas.id}`)
      .set('Authorization', `Bearer ${tomek.token}`)
      .send({ items: [{ id: klocki.id, title: 'Klocki Lego' }] })
      .expect(httpStatus.OK);

    expect(await childItems(event.eventId, ola.token, stas.id)).toEqual([
      {
        ...klocki,
        title: 'Klocki Lego',
        url: null,
        claimedByMe: true,
        claimedBy: 'Ola',
      },
    ]);
  });
});
