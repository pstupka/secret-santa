import { EmailMessage, Mailer } from '@email/mailer';

// Captures sent emails instead of delivering them. Set `failure` to make every
// send reject until it is cleared.
export interface FakeMailer extends Mailer {
  sent: EmailMessage[];
  failure: Error | null;
}

export const createFakeMailer = (): FakeMailer => {
  const mailer: FakeMailer = {
    sent: [],
    failure: null,
    send: async (message) => {
      if (mailer.failure) {
        throw mailer.failure;
      }
      mailer.sent.push(message);
    },
  };
  return mailer;
};
