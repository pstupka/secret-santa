import { describe, test, expect } from 'vitest';

import { renderEmail } from './templates';

const PUBLIC_URL = 'https://santa.example.com';

describe('Email templates', () => {
  test('organizer-link carries the personal link in the URL fragment', () => {
    const email = renderEmail(
      'organizer-link',
      { token: 'tok_123', organizerName: 'Ania', eventTitle: 'Wigilia 2026' },
      PUBLIC_URL,
    );

    expect(email.subject).toContain('Wigilia 2026');
    expect(email.text).toContain('Cześć Ania!');
    expect(email.text).toContain(
      'https://santa.example.com/auth#token=tok_123',
    );
    expect(email.html).toContain(
      'href="https://santa.example.com/auth#token=tok_123"',
    );
  });

  test('access-link has no greeting name', () => {
    const email = renderEmail('access-link', { token: 'tok' }, PUBLIC_URL);

    expect(email.text.startsWith('Cześć!')).toBe(true);
    expect(email.text).toContain('/auth#token=tok');
  });

  test('invitation includes description, exchange date, budget and rules', () => {
    const email = renderEmail(
      'invitation',
      {
        token: 'tok',
        participantName: 'Kasia',
        organizerName: 'Ania',
        eventTitle: 'Wigilia',
        description: 'Spotykamy się u babci.',
        exchangeOn: '2026-12-24',
        budget: { amount: 15000, currency: 'PLN' },
        rules: 'Bez skarpetek.\nTylko rękodzieło.',
      },
      PUBLIC_URL,
    );

    expect(email.subject).toBe('Ania zaprasza Cię na Mikołajki „Wigilia”');
    expect(email.text).toContain('Spotykamy się u babci.');
    expect(email.text).toContain('24 grudnia 2026');
    expect(email.text).toMatch(/150,00\s*zł/);
    expect(email.text).toContain('Bez skarpetek.\nTylko rękodzieło.');
    expect(email.html).toContain('Bez skarpetek.<br>Tylko rękodzieło.');
  });

  test('invitation omits budget and rules when not set', () => {
    const email = renderEmail(
      'invitation',
      {
        token: 'tok',
        participantName: 'Kasia',
        organizerName: 'Ania',
        eventTitle: 'Wigilia',
        description: null,
        exchangeOn: '2026-12-24',
        budget: null,
        rules: null,
      },
      PUBLIC_URL,
    );

    expect(email.text).not.toContain('Budżet');
    expect(email.text).not.toContain('Zasady');
  });

  test('draw-result names the recipient and links to the assignment', () => {
    const email = renderEmail(
      'draw-result',
      {
        eventId: 'evt-1',
        eventTitle: 'Wigilia',
        exchangeOn: '2026-12-24',
        giverName: 'Kasia',
        recipientName: 'Tomek',
        caretakerName: null,
      },
      PUBLIC_URL,
    );

    expect(email.text).toContain('Cześć Kasia!');
    expect(email.text).toContain('Kupujesz prezent dla: Tomek.');
    expect(email.text).toContain(
      'https://santa.example.com/events/evt-1/assignment',
    );
    expect(email.text).not.toContain('#token=');
  });

  test('draw-result for a managed participant addresses their caretaker', () => {
    const email = renderEmail(
      'draw-result',
      {
        eventId: 'evt-1',
        eventTitle: 'Wigilia',
        exchangeOn: '2026-12-24',
        giverName: 'Babcia Zosia',
        recipientName: 'Tomek',
        caretakerName: 'Kasia',
      },
      PUBLIC_URL,
    );

    expect(email.text).toContain('Cześć Kasia!');
    expect(email.text).toContain('Babcia Zosia kupuje prezent dla: Tomek.');
  });

  test('user-provided text is HTML-escaped', () => {
    const email = renderEmail(
      'organizer-link',
      {
        token: 'tok',
        organizerName: '<script>alert(1)</script>',
        eventTitle: 'Tom & Jerry',
      },
      PUBLIC_URL,
    );

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('Tom &amp; Jerry');
    expect(email.text).toContain('Tom & Jerry');
  });
});
