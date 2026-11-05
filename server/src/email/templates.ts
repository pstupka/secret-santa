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
  description: string | null;
  exchangeOn: string; // YYYY-MM-DD
  budget: { amount: number; currency: string } | null; // amount in minor units
  rules: string | null;
}

export interface DrawResultPayload {
  // Signs the addressee in (the giver, or their caretaker) and opens `next`.
  token: string;
  // App path the personal link opens after signing in: the assignment page,
  // or the print view of a managed participant's draw result.
  next: string;
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

// `next`: an app path to open once signed in (the token stays in the fragment,
// so it never reaches server logs).
const personalLink = (
  publicUrl: string,
  token: string,
  next?: string,
): string =>
  `${publicUrl}/auth${
    next ? `?next=${encodeURIComponent(next)}` : ''
  }#token=${encodeURIComponent(token)}`;

// A block of the email body: a paragraph, a list of labelled facts, or a
// paragraph under its own heading. All text is plain; the layout escapes it.
type Block =
  | string
  | { details: { label: string; value: string }[] }
  | { heading: string; text: string }
  | { reveal: { label: string; name: string } };

// Every email is a Christmas card: a front with a title and a wax seal, and
// inside a letter from the elves. The kicker, place line, sign-off and
// postscript are the same on every card.
interface Card {
  title: string;
  byline: string;
  sealInitial: string;
}

interface EmailContent {
  subject: string;
  greetingName?: string;
  card: Card;
  paragraphs: Block[];
  // Always a personal link; the postscript warns not to pass it on.
  link: { label: string; url: string };
  afterLink?: string[];
}

// First letter of a name, for a wax seal.
const initial = (name: string): string =>
  Array.from(name.trim())[0]?.toUpperCase() ?? '';

const htmlText = (text: string): string =>
  escapeHtml(text).replace(/\n/g, '<br>');

const textBlock = (block: Block): string => {
  if (typeof block === 'string') return block;
  if ('reveal' in block) return `${block.reveal.label}: ${block.reveal.name}`;
  if ('details' in block) {
    return block.details.map((d) => `${d.label}: ${d.value}`).join('\n');
  }
  return `${block.heading}\n${block.text}`;
};

// Colours and faces from DESIGN.md. Email clients have no web fonts we can
// rely on, so the stacks fall back to Georgia and the system sans.
const C = {
  ground: '#d8c3a5',
  paper: '#fffcf6',
  kraft300: '#cfb48a',
  kraft400: '#b8996c',
  cranberry600: '#9f1d2b',
  cranberry700: '#821824',
  pine100: '#d6ebdd',
  pine900: '#0f3322',
  gold300: '#f2d48a',
  gold400: '#e9b949',
  stone600: '#574533',
  stone700: '#45362a',
  stone800: '#2f241b',
  white: '#ffffff',
};
const SERIF = "'Poltawski Nowy', Georgia, 'Times New Roman', serif";
const SANS =
  "'Atkinson Hyperlegible Next', 'Segoe UI', Helvetica, Arial, sans-serif";

// Inline styles, since email clients drop <style> blocks.
const css = (...declarations: string[]): string => declarations.join('; ');
const sans = (size: number, color: string, weight = 400): string =>
  css(
    `font-family: ${SANS}`,
    `font-size: ${size}px`,
    `font-weight: ${weight}`,
    'line-height: 1.5',
    `color: ${color}`,
  );
const serif = (size: number, color: string): string =>
  css(
    `font-family: ${SERIF}`,
    `font-size: ${size}px`,
    'font-weight: 700',
    'line-height: 1.3',
    `color: ${color}`,
  );

const S = {
  body: css('margin: 0 0 16px', sans(16, C.stone800)),
  small: css('margin: 0 0 12px', sans(14, C.stone600)),
  label: sans(14, C.stone700, 700),
  rulesText: css(
    'margin: 4px 0 16px',
    'padding-left: 12px',
    `border-left: 3px solid ${C.cranberry600}`,
    sans(16, C.stone800),
  ),
  details: css(
    'margin: 8px 0 24px',
    `border-top: 1px dashed ${C.kraft400}`,
    `border-bottom: 1px dashed ${C.kraft400}`,
  ),
  ground: `margin: 0; padding: 0; background: ${C.ground}`,
  sheet: css(
    'max-width: 560px',
    `background: ${C.paper}`,
    `border: 1px solid ${C.kraft300}`,
    'border-radius: 6px',
    'box-shadow: 0 12px 28px -16px rgba(74, 52, 28, 0.45)',
  ),
  front: css(
    'padding: 40px 28px 32px',
    `background: ${C.pine900}`,
    'border-radius: 5px 5px 0 0',
  ),
  kicker: css(
    'margin: 0 0 12px',
    sans(13, C.pine100, 700),
    'letter-spacing: 0.12em',
    'text-transform: uppercase',
  ),
  title: css('margin: 0', serif(34, C.white), 'line-height: 1.15'),
  foil: css(
    'width: 80px',
    'height: 4px',
    'line-height: 4px',
    'font-size: 0',
    'margin: 18px auto',
    `background: ${C.gold400}`,
    'border-radius: 2px',
  ),
  byline: css('margin: 0', serif(18, C.pine100), 'font-weight: 400'),
  twine: css(
    'height: 3px',
    'line-height: 3px',
    'font-size: 0',
    `background: ${C.cranberry600}`,
  ),
  seal: css(
    'width: 50px',
    'height: 50px',
    'padding: 5px',
    'border-radius: 50%',
    `background: ${C.cranberry600}`,
    'box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25)',
  ),
  sealRing: css(
    'width: 46px',
    'height: 46px',
    `border: 2px solid ${C.gold300}`,
    'border-radius: 50%',
    'text-align: center',
    serif(24, C.gold300),
    'line-height: 46px',
  ),
  inside: 'padding: 12px 32px 32px',
  greeting: css('margin: 0 0 16px', serif(24, C.pine900)),
  button: css(
    'display: inline-block',
    'padding: 12px 24px',
    sans(16, C.white, 700),
    'text-decoration: none',
    'border-radius: 6px',
  ),
  fallbackLink: `color: ${C.stone600}; word-break: break-all`,
  revealTag: css(
    'padding: 24px 20px 8px',
    `background: ${C.white}`,
    `border: 1px solid ${C.kraft300}`,
    'border-radius: 6px',
  ),
  revealLabel: css('margin: 0 0 8px', sans(14, C.stone700, 700)),
  revealName: css('margin: 0', serif(36, C.cranberry700), 'line-height: 1.25'),
  place: css(
    'margin: 0 0 20px',
    'text-align: right',
    sans(14, C.stone600),
    'font-style: italic',
  ),
  signature: css(
    'margin: 8px 0 0',
    'text-align: right',
    serif(20, C.cranberry700),
  ),
  fold: css(
    'margin-top: 28px',
    'padding-top: 16px',
    `border-top: 1px dashed ${C.kraft400}`,
  ),
};

// A layout table, the only structure every email client lays out reliably.
const table = (rows: string, style = '', width = '100%'): string =>
  `<table role="presentation" width="${width}" cellpadding="0"` +
  ` cellspacing="0" style="${style}">${rows}</table>`;

const cardBlock = (block: Block): string => {
  if (typeof block === 'string') {
    return `<p style="${S.body}">${htmlText(block)}</p>`;
  }
  if ('reveal' in block) {
    // The drawn name, set like a revealed gift tag over a gold foil rule.
    const { label, name } = block.reveal;
    return table(
      `<tr><td align="center" style="${S.revealTag}">` +
        `<p style="${S.revealLabel}">${htmlText(label)}</p>` +
        `<p style="${S.revealName}">${htmlText(name)}</p>` +
        `<div style="${S.foil}">&nbsp;</div></td></tr>`,
      'margin: 8px 0 24px',
    );
  }
  if ('details' in block) {
    const rows = block.details
      .map(
        (d) =>
          `<tr><td style="padding: 6px 0; ${S.label}">${htmlText(
            d.label,
          )}</td>` +
          `<td align="right" style="padding: 6px 0; ${serif(18, C.pine900)}">` +
          `${htmlText(d.value)}</td></tr>`,
      )
      .join('');
    return table(
      `<tr><td style="padding: 10px 0;">${table(rows)}</td></tr>`,
      S.details,
    );
  }
  return (
    `<p style="margin: 0; ${S.label}">${htmlText(block.heading)}</p>` +
    `<p style="${S.rulesText}">${htmlText(block.text)}</p>`
  );
};

const cardHtml = (
  card: Card,
  content: EmailContent,
  greeting: string,
): string => {
  const url = escapeHtml(content.link.url);
  const twine = `<td valign="middle"><div style="${S.twine}">&nbsp;</div></td>`;

  // Front: the event name on a pine band over a gold foil rule.
  const front = [
    `<p style="${S.kicker}">${htmlText(t('layout', 'kicker'))}</p>`,
    `<h1 style="${S.title}">${htmlText(card.title)}</h1>`,
    `<div style="${S.foil}">&nbsp;</div>`,
    `<p style="${S.byline}">${htmlText(card.byline)}</p>`,
  ].join('\n');

  // Cranberry twine across the card, closed with a wax seal.
  const seal =
    `<td width="60" valign="middle" style="padding: 12px;">` +
    `<div style="${S.seal}"><div style="${S.sealRing}">` +
    `${htmlText(card.sealInitial)}</div></div></td>`;

  const button = table(
    `<tr><td style="background: ${C.cranberry600}; border-radius: 6px;">` +
      `<a href="${url}" style="${S.button}">` +
      `${htmlText(content.link.label)}</a></td></tr>`,
    'margin: 8px 0 20px',
    'auto',
  );

  const inside = [
    `<p style="${S.place}">${htmlText(t('layout', 'place'))}</p>`,
    `<p style="${S.greeting}">${htmlText(greeting)}</p>`,
    ...content.paragraphs.map(cardBlock),
    button,
    ...(content.afterLink ?? []).map(cardBlock),
    `<p style="${S.signature}">${htmlText(t('layout', 'signature'))}</p>`,
    // Small print below a fold line.
    `<div style="${S.fold}">`,
    `<p style="${S.small}">${htmlText(t('layout', 'postscript'))}</p>`,
    `<p style="${S.small}">${htmlText(t('layout', 'linkFallback'))}<br>` +
      `<a href="${url}" style="${S.fallbackLink}">${url}</a></p>`,
    '</div>',
  ].join('\n');

  const sheet = table(
    [
      `<tr><td align="center" style="${S.front}">${front}</td></tr>`,
      `<tr><td>${table(`<tr>${twine}${seal}${twine}</tr>`)}</td></tr>`,
      `<tr><td style="${S.inside}">${inside}</td></tr>`,
    ].join('\n'),
    S.sheet,
  );

  return [
    '<!doctype html>',
    '<html lang="pl"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light">',
    '<meta name="supported-color-schemes" content="light">',
    `<title>${escapeHtml(content.subject)}</title></head>`,
    `<body style="${S.ground}">`,
    table(
      `<tr><td align="center" style="padding: 32px 12px;">${sheet}</td></tr>`,
      `background: ${C.ground}`,
    ),
    '</body></html>',
  ].join('\n');
};

const layout = (content: EmailContent): RenderedEmail => {
  const greeting = content.greetingName
    ? t('layout', 'greeting', { name: content.greetingName })
    : t('layout', 'greetingAnonymous');
  const { link } = content;
  const text = [
    greeting,
    ...content.paragraphs.map(textBlock),
    `${link.label}: ${link.url}`,
    ...(content.afterLink ?? []),
    t('layout', 'signature'),
    t('layout', 'postscript'),
  ].join('\n\n');
  return {
    subject: content.subject,
    html: cardHtml(content.card, content, greeting),
    text,
  };
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
    card: {
      title: p.eventTitle,
      byline: t('organizer-link', 'cardByline'),
      sealInitial: initial(p.organizerName),
    },
    paragraphs: [
      t('organizer-link', 'news', { eventTitle: p.eventTitle }),
      t('organizer-link', 'body'),
    ],
    link: {
      label: t('organizer-link', 'cta'),
      url: personalLink(publicUrl, p.token),
    },
    afterLink: [t('organizer-link', 'keep')],
  }),

  // Sent to whoever asked for it, so it names no one and no event.
  'access-link': (p, publicUrl) => ({
    subject: t('access-link', 'subject'),
    card: {
      title: t('access-link', 'cardTitle'),
      byline: t('access-link', 'cardByline'),
      sealInitial: 'M',
    },
    paragraphs: [t('access-link', 'news'), t('access-link', 'body')],
    link: {
      label: t('access-link', 'cta'),
      url: personalLink(publicUrl, p.token),
    },
    afterLink: [t('access-link', 'ignore')],
  }),

  invitation: (p, publicUrl) => {
    const names = { organizerName: p.organizerName, eventTitle: p.eventTitle };
    return {
      subject: t('invitation', 'subject', names),
      greetingName: p.participantName,
      card: {
        title: p.eventTitle,
        byline: t('invitation', 'cardByline', names),
        sealInitial: initial(p.organizerName),
      },
      paragraphs: [
        t('invitation', 'news'),
        t('invitation', 'body', names),
        ...(p.description
          ? [
              {
                heading: t('invitation', 'descriptionHeading', names),
                text: p.description,
              },
            ]
          : []),
        {
          details: [
            {
              label: t('invitation', 'exchangeOnLabel'),
              value: formatDate(p.exchangeOn),
            },
            ...(p.budget
              ? [
                  {
                    label: t('invitation', 'budgetLabel'),
                    value: formatMoney(p.budget.amount, p.budget.currency),
                  },
                ]
              : []),
          ],
        },
        ...(p.rules
          ? [{ heading: t('invitation', 'rulesHeading'), text: p.rules }]
          : []),
        t('invitation', 'instructions'),
      ],
      link: {
        label: t('invitation', 'cta'),
        url: personalLink(publicUrl, p.token),
      },
      afterLink: [t('invitation', 'deadline')],
    };
  },

  'draw-result': (p, publicUrl) => {
    const names = { eventTitle: p.eventTitle, giverName: p.giverName };
    // A caretaker's copy is about their managed participant, who has no
    // email of their own.
    const forCaretaker = p.caretakerName !== null;
    return {
      subject: t('draw-result', 'subject', names),
      greetingName: p.caretakerName ?? p.giverName,
      card: {
        title: p.eventTitle,
        byline: t('draw-result', 'cardByline'),
        // Like the envelopes on the draw page: sealed with the giver's initial.
        sealInitial: initial(p.giverName),
      },
      paragraphs: [
        t('draw-result', 'news'),
        {
          reveal: {
            label: forCaretaker
              ? t('draw-result', 'revealLabelCaretaker', names)
              : t('draw-result', 'revealLabel'),
            name: p.recipientName,
          },
        },
        {
          details: [
            {
              label: t('draw-result', 'exchangeOnLabel'),
              value: formatDate(p.exchangeOn),
            },
          ],
        },
        t(
          'draw-result',
          forCaretaker ? 'instructionsCaretaker' : 'instructions',
        ),
      ],
      link: {
        label: t('draw-result', forCaretaker ? 'ctaCaretaker' : 'cta'),
        url: personalLink(publicUrl, p.token, p.next),
      },
      afterLink: [t('draw-result', 'secret')],
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
