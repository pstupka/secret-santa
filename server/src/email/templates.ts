import { readFileSync } from 'node:fs';

import { EmailTemplate } from '@db/schema';

// What each template needs in `email_outbox.payload`. `token` is the raw magic
// token; the sender strips it from the payload once the email is sent.

export interface OrganizerLinkPayload {
  token: string;
  organizerName: string;
  eventTitle: string;
}

export interface AccessLinkPayload {
  token: string;
}

export interface InvitationPayload {
  token: string;
  participantName: string;
  organizerName: string;
  eventTitle: string;
  exchangeOn: string; // YYYY-MM-DD
  budget: { amount: number; currency: string } | null; // amount in minor units
  rules: string | null;
}

export interface DrawResultPayload {
  eventId: string;
  eventTitle: string;
  exchangeOn: string; // YYYY-MM-DD
  giverName: string;
  recipientName: string;
  // Set when the giver is a managed participant: this copy goes to their caretaker.
  caretakerName: string | null;
}

export interface EmailPayloads {
  'organizer-link': OrganizerLinkPayload;
  'access-link': AccessLinkPayload;
  invitation: InvitationPayload;
  'draw-result': DrawResultPayload;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

type Messages = Record<string, Record<string, string>>;

const messages: Messages = JSON.parse(
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed path next to this module.
  readFileSync(new URL('../locales/pl.json', import.meta.url), 'utf8'),
).email;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const interpolate = (
  message: string,
  params: Record<string, string> = {},
): string =>
  message.replace(/\{(\w+)\}/g, (match, name: string) =>
    // eslint-disable-next-line security/detect-object-injection -- placeholder names come from our own locale file.
    name in params ? params[name] : match,
  );

const t = (
  section: string,
  key: string,
  params?: Record<string, string>,
): string => {
  // eslint-disable-next-line security/detect-object-injection -- section and key are literals in this module.
  const message = messages[section]?.[key];
  if (message === undefined) {
    throw new Error(`Missing email message: ${section}.${key}`);
  }
  return interpolate(message, params);
};

const formatDate = (date: string): string =>
  new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

const formatMoney = (amount: number, currency: string): string =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(
    amount / 100,
  );

const personalLink = (publicUrl: string, token: string): string =>
  `${publicUrl}/auth#token=${encodeURIComponent(token)}`;

// Paragraphs are plain text; the layout escapes them for HTML.
interface EmailContent {
  subject: string;
  greetingName?: string;
  paragraphs: string[];
  link: { label: string; url: string; confidential: boolean };
  afterLink?: string[];
}

const htmlParagraph = (text: string): string =>
  `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;

const layout = (content: EmailContent): RenderedEmail => {
  const greeting = content.greetingName
    ? t('layout', 'greeting', { name: content.greetingName })
    : t('layout', 'greetingAnonymous');
  const { link } = content;
  const afterLink = [
    ...(link.confidential ? [t('layout', 'confidential')] : []),
    ...(content.afterLink ?? []),
  ];
  const signature = t('layout', 'signature');
  const url = escapeHtml(link.url);

  const html = [
    '<!doctype html>',
    '<html lang="pl"><body style="font-family: sans-serif; line-height: 1.5; color: #1f2937;">',
    htmlParagraph(greeting),
    ...content.paragraphs.map(htmlParagraph),
    `<p><a href="${url}" style="display: inline-block; padding: 10px 20px; background: #b91c1c; color: #ffffff;` +
      ` text-decoration: none; border-radius: 6px;">${escapeHtml(
        link.label,
      )}</a></p>`,
    `<p style="font-size: 12px; color: #6b7280;">${escapeHtml(
      t('layout', 'linkFallback'),
    )}<br>${url}</p>`,
    ...afterLink.map(htmlParagraph),
    htmlParagraph(signature),
    '</body></html>',
  ].join('\n');

  const text = [
    greeting,
    ...content.paragraphs,
    `${link.label}: ${link.url}`,
    ...afterLink,
    signature,
  ].join('\n\n');

  return { subject: content.subject, html, text };
};

type Renderers = {
  [T in EmailTemplate]: (
    payload: EmailPayloads[T],
    publicUrl: string,
  ) => EmailContent;
};

const renderers: Renderers = {
  'organizer-link': (p, publicUrl) => ({
    subject: t('organizer-link', 'subject', { eventTitle: p.eventTitle }),
    greetingName: p.organizerName,
    paragraphs: [t('organizer-link', 'body', { eventTitle: p.eventTitle })],
    link: {
      label: t('organizer-link', 'cta'),
      url: personalLink(publicUrl, p.token),
      confidential: true,
    },
  }),

  'access-link': (p, publicUrl) => ({
    subject: t('access-link', 'subject'),
    paragraphs: [t('access-link', 'body')],
    link: {
      label: t('access-link', 'cta'),
      url: personalLink(publicUrl, p.token),
      confidential: true,
    },
    afterLink: [t('access-link', 'ignore')],
  }),

  invitation: (p, publicUrl) => {
    const names = { organizerName: p.organizerName, eventTitle: p.eventTitle };
    return {
      subject: t('invitation', 'subject', names),
      greetingName: p.participantName,
      paragraphs: [
        t('invitation', 'body', names),
        t('invitation', 'exchangeOn', { date: formatDate(p.exchangeOn) }),
        ...(p.budget
          ? [
              t('invitation', 'budget', {
                amount: formatMoney(p.budget.amount, p.budget.currency),
              }),
            ]
          : []),
        ...(p.rules ? [`${t('invitation', 'rulesHeading')}\n${p.rules}`] : []),
        t('invitation', 'instructions'),
      ],
      link: {
        label: t('invitation', 'cta'),
        url: personalLink(publicUrl, p.token),
        confidential: true,
      },
    };
  },

  'draw-result': (p, publicUrl) => {
    const names = {
      eventTitle: p.eventTitle,
      giverName: p.giverName,
      recipientName: p.recipientName,
    };
    return {
      subject: t('draw-result', 'subject', names),
      greetingName: p.caretakerName ?? p.giverName,
      paragraphs: [
        t('draw-result', p.caretakerName ? 'bodyCaretaker' : 'body', names),
        t('draw-result', 'exchangeOn', { date: formatDate(p.exchangeOn) }),
        t('draw-result', 'secret'),
      ],
      link: {
        label: t('draw-result', 'cta'),
        url: `${publicUrl}/events/${encodeURIComponent(p.eventId)}/assignment`,
        confidential: false,
      },
    };
  },
};

// Renders an outbox row into a subject plus HTML and plain-text bodies.
// `publicUrl` is the app origin without a trailing slash.
export const renderEmail = <T extends EmailTemplate>(
  template: T,
  payload: EmailPayloads[T],
  publicUrl: string,
): RenderedEmail => {
  // eslint-disable-next-line security/detect-object-injection -- template is a typed EmailTemplate.
  const render = renderers[template] as (
    p: EmailPayloads[T],
    url: string,
  ) => EmailContent;
  if (!render) {
    throw new Error(`Unknown email template: ${template}`);
  }
  return layout(render(payload, publicUrl));
};
