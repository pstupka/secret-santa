import { createTransport } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Delivers one rendered email. Rejects when delivery fails.
export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

// Nodemailer over SMTP, e.g. `smtps://user:app-password@smtp.gmail.com:465`.
export const createSmtpMailer = (smtpUrl: string, from: string): Mailer => {
  const transport = createTransport(smtpUrl, { from });
  return {
    send: async (message) => {
      await transport.sendMail(message);
    },
  };
};
