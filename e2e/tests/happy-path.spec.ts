import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';

import { emailsTo, personalLinkIn, waitForEmail } from '../support/mailpit';

// The whole exchange through the UI, as several people in their own browser
// contexts: the organizer creates an event and gets their personal link by
// email, adds participants (one managed) and sends invitations; participants
// open their links and add wishlists, one adds a child wishlist and another
// claims an item from it; the organizer runs the draw; every participant
// sees their assignment, the caretaker also the managed participant's.

// Unique per run, so a reused environment (E2E_REUSE=1) still works.
const run = Date.now().toString(36);
const eventTitle = `Wigilia e2e ${run}`;
const emailOf = (name: string) => `${name.toLowerCase()}+${run}@example.com`;

const ORGANIZER = 'Ania';
const CARETAKER = 'Basia';
const MEMBER = 'Czarek';
const MANAGED = 'Zenek';
const CHILD = 'Staś';
const PARTICIPANTS = [ORGANIZER, CARETAKER, MEMBER, MANAGED];

// The single gift idea on each participant's own wishlist.
const giftOf = (name: string) => `Prezent dla: ${name}`;
const CHILD_GIFTS = ['Hulajnoga', 'Klocki LEGO'];

const exchangeDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
};

// A participant's own browser, signed in with their personal link.
const signIn = async (browser: Browser, personalLink: string) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(personalLink);
  await expect(page).toHaveURL(/\/events$/);
  return page;
};

const actAs = async (page: Page, profile: string) => {
  const radio = page.getByRole('radio', { name: profile, exact: true });
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
};

// Fills the open wishlist editor: an optional child's name and gift ideas.
const fillWishlistEditor = async (
  editor: Locator,
  { childName, gifts }: { childName?: string; gifts: string[] },
) => {
  if (childName) await editor.getByLabel('Imię dziecka').fill(childName);
  for (const [index, gift] of gifts.entries()) {
    if (index > 0) {
      await editor.getByRole('button', { name: 'Dodaj pomysł' }).click();
    }
    await editor
      .getByTestId('wishlist-editor-item')
      .nth(index)
      .getByLabel('Nazwa', { exact: true })
      .fill(gift);
  }
  await editor.getByTestId('wishlist-save').click();
  await expect(editor).toBeHidden();
};

const createOwnWishlist = async (page: Page, eventId: string) => {
  await page.goto(`/events/${eventId}/wishlists`);
  await page.getByTestId('wishlist-create-own').click();
  return page.getByTestId('wishlist-editor');
};

test('happy path: create event, invite, wishlists, claim, draw, assignments', async ({
  browser,
  page: organizer,
}) => {
  let eventId = '';

  await test.step('organizer creates the event', async () => {
    await organizer.goto('/new');
    await organizer.getByLabel('Nazwa wydarzenia').fill(eventTitle);
    await organizer.getByLabel('Data wymiany prezentów').fill(exchangeDate());
    await organizer.getByLabel('Twoje imię').fill(ORGANIZER);
    await organizer.getByLabel('Twój adres e-mail').fill(emailOf(ORGANIZER));
    await organizer.getByRole('button', { name: 'Utwórz wydarzenie' }).click();
    await expect(
      organizer.getByRole('heading', { name: 'Sprawdź skrzynkę' }),
    ).toBeVisible();
  });

  await test.step('organizer opens the personal link from the email', async () => {
    const email = await waitForEmail(emailOf(ORGANIZER), eventTitle);
    await organizer.goto(personalLinkIn(email));
    await expect(organizer).toHaveURL(/\/events$/);
    await organizer.getByRole('link', { name: eventTitle }).click();
    await expect(organizer).toHaveURL(/\/events\/[^/]+$/);
    eventId = new URL(organizer.url()).pathname.split('/')[2]!;
  });

  const rows = organizer.getByTestId('participant-row');
  const rowOf = (name: string) =>
    organizer.locator(
      `[data-testid="participant-row"][data-participant-name="${name}"]`,
    );

  await test.step('organizer adds participants, one of them managed', async () => {
    await organizer.goto(`/events/${eventId}/manage`);
    await expect(rows).toHaveCount(1);
    const form = organizer.getByTestId('add-participant-form');

    for (const name of [CARETAKER, MEMBER]) {
      await form.getByTestId('add-participant-name').fill(name);
      await form.getByTestId('add-participant-email').fill(emailOf(name));
      await form.getByTestId('add-participant-submit').click();
      await expect(rowOf(name)).toBeVisible();
    }

    await form.getByTestId('add-participant-managed').check();
    await form.getByTestId('add-participant-name').fill(MANAGED);
    await form
      .getByTestId('add-participant-caretaker')
      .selectOption({ label: CARETAKER });
    await form.getByTestId('add-participant-submit').click();
    await expect(rowOf(MANAGED)).toBeVisible();
    await expect(rows).toHaveCount(PARTICIPANTS.length);
    await expect(rowOf(MANAGED).getByTestId('invite-state')).toHaveText(
      'Pod opieką – bez zaproszenia',
    );
  });

  await test.step('organizer sends the invitations', async () => {
    const send = organizer.getByTestId('send-invitations');
    await expect(send).toHaveAttribute('data-pending-count', '2');
    await send.click();
    await expect(send).toBeHidden();
    for (const name of [CARETAKER, MEMBER]) {
      await expect(rowOf(name).getByTestId('invite-state')).toHaveText(
        'Zaproszenie wysłane',
      );
    }
  });

  const caretaker = await signIn(
    browser,
    personalLinkIn(await waitForEmail(emailOf(CARETAKER), eventTitle)),
  );
  const member = await signIn(
    browser,
    personalLinkIn(await waitForEmail(emailOf(MEMBER), eventTitle)),
  );

  await test.step('organizer and member add their wishlists', async () => {
    for (const [page, name] of [
      [organizer, ORGANIZER],
      [member, MEMBER],
    ] as const) {
      const editor = await createOwnWishlist(page, eventId);
      await fillWishlistEditor(editor, { gifts: [giftOf(name)] });
      await expect(
        page.getByTestId('wishlist').getByTestId('wishlist-item'),
      ).toHaveText([giftOf(name)]);
    }
  });

  await test.step('caretaker adds their own and a child wishlist', async () => {
    const editor = await createOwnWishlist(caretaker, eventId);
    await fillWishlistEditor(editor, { gifts: [giftOf(CARETAKER)] });

    await caretaker.getByTestId('wishlist-create-child').click();
    await fillWishlistEditor(caretaker.getByTestId('wishlist-editor'), {
      childName: CHILD,
      gifts: CHILD_GIFTS,
    });
    const child = caretaker
      .getByTestId('wishlist')
      .filter({ has: caretaker.getByRole('heading', { name: CHILD }) });
    await expect(child.getByTestId('wishlist-item')).toHaveText(CHILD_GIFTS);
  });

  await test.step('caretaker adds the managed participant’s wishlist', async () => {
    await actAs(caretaker, MANAGED);
    await caretaker.getByTestId('wishlist-create-own').click();
    await fillWishlistEditor(caretaker.getByTestId('wishlist-editor'), {
      gifts: [giftOf(MANAGED)],
    });
    await expect(
      caretaker.getByTestId('wishlist').getByTestId('wishlist-item'),
    ).toHaveText([giftOf(MANAGED)]);
    await actAs(caretaker, 'Ty');
  });

  await test.step('member claims an item from the child wishlist', async () => {
    await member.goto(`/events/${eventId}/kids`);
    const child = member
      .getByTestId('wishlist')
      .filter({ has: member.getByRole('heading', { name: CHILD }) });
    const claim = child
      .getByTestId('wishlist-item')
      .filter({ hasText: CHILD_GIFTS[0] })
      .getByTestId('claim');
    await expect(claim).toHaveAttribute('data-claim-state', 'free');
    await claim.getByTestId('claim-item').click();
    await expect(claim).toHaveAttribute('data-claim-state', 'mine');

    await member.goto(`/events/${eventId}/claims`);
    const group = member.getByTestId('claim-group');
    await expect(group).toHaveCount(1);
    await expect(group).toContainText(CHILD);
    const claimed = group.getByTestId('wishlist-item');
    await expect(claimed).toHaveCount(1);
    await expect(claimed).toContainText(CHILD_GIFTS[0]!);
    await expect(claimed.getByTestId('claim-release')).toBeVisible();
  });

  await test.step('others see the claim, the child’s family does not', async () => {
    await organizer.goto(`/events/${eventId}/kids`);
    const items = organizer
      .getByTestId('wishlist')
      .filter({ has: organizer.getByRole('heading', { name: CHILD }) })
      .getByTestId('wishlist-item');
    await expect(
      items.filter({ hasText: CHILD_GIFTS[0] }).getByTestId('claim'),
    ).toHaveAttribute('data-claim-state', 'taken');
    await expect(
      items.filter({ hasText: CHILD_GIFTS[1] }).getByTestId('claim'),
    ).toHaveAttribute('data-claim-state', 'free');

    // The managed participant is the child's family through the caretaker.
    await caretaker.goto(`/events/${eventId}/kids`);
    await actAs(caretaker, MANAGED);
    await expect(caretaker.getByText(CHILD_GIFTS[0]!)).toBeVisible();
    await expect(caretaker.getByTestId('claim')).toHaveCount(0);
    await actAs(caretaker, 'Ty');
  });

  await test.step('organizer runs the draw', async () => {
    await organizer.goto(`/events/${eventId}/manage`);
    await expect(rows).toHaveCount(PARTICIPANTS.length);
    for (const name of PARTICIPANTS) {
      await expect(rowOf(name).getByTestId('wishlist-filled')).toHaveAttribute(
        'data-filled',
        'true',
      );
    }
    await expect(organizer.getByTestId('draw-blockers')).toBeHidden();
    await organizer.getByTestId('run-draw').click();
    await organizer.getByTestId('confirm-draw').click();
    await expect(organizer.getByTestId('draw-done')).toBeVisible();
    await expect(organizer.getByTestId('redo-draw')).toBeVisible();
  });

  const recipients = new Map<string, string>();
  const readAssignment = async (page: Page, giver: string) => {
    const recipient = page.getByTestId('assignment-recipient');
    await expect(recipient).toBeVisible();
    const name = (await recipient.textContent())?.trim() ?? '';
    recipients.set(giver, name);
    // The recipient's wishlist comes with the assignment.
    await expect(
      page.getByTestId('recipient-wishlist').getByText(giftOf(name)),
    ).toBeVisible();
  };

  await test.step('every participant sees their assignment', async () => {
    for (const [page, giver] of [
      [organizer, ORGANIZER],
      [member, MEMBER],
      [caretaker, CARETAKER],
    ] as const) {
      await page.goto(`/events/${eventId}/assignment`);
      await readAssignment(page, giver);
    }
  });

  await test.step('caretaker sees the managed participant’s assignment', async () => {
    await actAs(caretaker, MANAGED);
    await expect(
      caretaker.getByText(`${MANAGED} kupuje prezent dla`),
    ).toBeVisible();
    await readAssignment(caretaker, MANAGED);

    await caretaker.getByTestId('assignment-print-link').click();
    await expect(
      caretaker.getByTestId('assignment-print-recipient'),
    ).toHaveText(recipients.get(MANAGED)!);
  });

  await test.step('the draw is a valid Secret Santa assignment', async () => {
    expect([...recipients.keys()].sort()).toEqual([...PARTICIPANTS].sort());
    // Everyone gives one gift and gets one; nobody draws themselves.
    expect([...recipients.values()].sort()).toEqual([...PARTICIPANTS].sort());
    for (const [giver, recipient] of recipients) {
      expect(recipient, `${giver} drew themselves`).not.toBe(giver);
    }
  });

  await test.step('draw results are emailed, the caretaker’s twice', async () => {
    const subject = `Losowanie w „${eventTitle}” zakończone`;
    for (const [name, count] of [
      [ORGANIZER, 1],
      [MEMBER, 1],
      [CARETAKER, 2],
    ] as const) {
      await expect
        .poll(async () => (await emailsTo(emailOf(name), subject)).length, {
          timeout: 20_000,
        })
        .toBe(count);
    }
  });
});
