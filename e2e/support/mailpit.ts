import { expect } from '@playwright/test';

import { APP_URL, MAILPIT_URL } from './environment';

// Mailpit's REST API (https://mailpit.axllent.org/docs/api-v1/): just what
// the specs need to read the emails the app sends.

interface MessageSummary {
  ID: string;
  Subject: string;
}

interface Message {
  ID: string;
  Subject: string;
  Text: string;
}

const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${MAILPIT_URL}/api/v1${path}`, init);
  if (!response.ok) {
    throw new Error(`Mailpit ${path}: ${response.status}`);
  }
  return response;
};

const mailpit = async <T>(path: string): Promise<T> =>
  (await (await request(path)).json()) as T;

export const deleteAllEmails = async (): Promise<void> => {
  await request('/messages', { method: 'DELETE' });
};

// Emails sent to `to` whose subject contains `subject`, newest first.
export const emailsTo = async (
  to: string,
  subject: string,
): Promise<MessageSummary[]> => {
  const query = encodeURIComponent(`to:"${to}"`);
  const { messages } = await mailpit<{ messages: MessageSummary[] }>(
    `/search?query=${query}&limit=50`,
  );
  return messages.filter((message) => message.Subject.includes(subject));
};

// Waits for the outbox sender to deliver an email; returns the newest one.
export const waitForEmail = async (
  to: string,
  subject: string,
): Promise<Message> => {
  let found: MessageSummary | undefined;
  await expect
    .poll(
      async () => {
        [found] = await emailsTo(to, subject);
        return found !== undefined;
      },
      {
        message: `email to ${to} with subject containing "${subject}"`,
        timeout: 20_000,
      },
    )
    .toBe(true);
  return mailpit<Message>(`/message/${found!.ID}`);
};

// The personal link (`${PUBLIC_URL}/auth#token=…`) in an email.
export const personalLinkIn = (message: Message): string => {
  const escaped = APP_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const link = message.Text.match(
    new RegExp(`${escaped}/auth#token=[^\\s"<>]+`),
  )?.[0];
  if (!link) {
    throw new Error(`No personal link in "${message.Subject}"`);
  }
  return link;
};
