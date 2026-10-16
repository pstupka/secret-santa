import { agent as request } from 'supertest';
import httpStatus from 'http-status';

import { signIn, TestContext } from './harness';

// Shared API-level setup for integration tests: events and participants are
// created through the real endpoints.

export const newEvent = (overrides: Record<string, unknown> = {}) => ({
  title: 'Wigilia 2026',
  description: 'Rodzinne Mikołajki',
  budgetAmount: 15000,
  budgetCurrency: 'PLN',
  rules: 'Bez skarpetek.',
  timezone: 'Europe/Warsaw',
  exchangeOn: '2026-12-24',
  organizerName: 'Ania',
  organizerEmail: 'ania@example.com',
  ...overrides,
});

export interface OrganizedEvent {
  eventId: string;
  organizerToken: string;
  organizerParticipantId: string;
}

// Each event comes from its own IP so setup never hits the public rate limit.
let nextIp = 0;

// Creates an event through the API; returns it with the organizer's magic
// token and participant id.
export const organizeEvent = async (
  ctx: TestContext,
  overrides: Record<string, unknown> = {},
): Promise<OrganizedEvent> => {
  const body = newEvent(overrides);
  nextIp += 1;
  const res = await request(ctx.app)
    .post('/api/events')
    .set('X-Forwarded-For', `10.0.${Math.floor(nextIp / 256)}.${nextIp % 256}`)
    .send(body)
    .expect(httpStatus.CREATED);
  const { personId, token } = await signIn(ctx, body.organizerEmail as string);
  const organizer = await ctx.db
    .selectFrom('participants')
    .select('id')
    .where('event_id', '=', res.body.id)
    .where('person_id', '=', personId)
    .executeTakeFirstOrThrow();
  return {
    eventId: res.body.id as string,
    organizerToken: token,
    organizerParticipantId: organizer.id,
  };
};

// Adds a participant with an email through the organizer's API; returns
// their participant id and a magic token for them.
export const addMember = async (
  ctx: TestContext,
  { eventId, organizerToken }: OrganizedEvent,
  email: string,
  displayName: string,
): Promise<{ participantId: string; token: string }> => {
  const res = await request(ctx.app)
    .post(`/api/events/${eventId}/participants`)
    .set('Authorization', `Bearer ${organizerToken}`)
    .send({ displayName, email })
    .expect(httpStatus.CREATED);
  const { token } = await signIn(ctx, email);
  return { participantId: res.body.id as string, token };
};

// Adds a managed participant looked after by `caretakerParticipantId`;
// returns their participant id.
export const addManagedParticipant = async (
  ctx: TestContext,
  { eventId, organizerToken }: OrganizedEvent,
  caretakerParticipantId: string,
  displayName: string,
): Promise<string> => {
  const res = await request(ctx.app)
    .post(`/api/events/${eventId}/participants`)
    .set('Authorization', `Bearer ${organizerToken}`)
    .send({ displayName, managedByParticipantId: caretakerParticipantId })
    .expect(httpStatus.CREATED);
  return res.body.id as string;
};

// Declines through the API as the participant the token belongs to.
export const decline = async (
  ctx: TestContext,
  eventId: string,
  token: string,
): Promise<void> => {
  await request(ctx.app)
    .post(`/api/events/${eventId}/participation/decline`)
    .set('Authorization', `Bearer ${token}`)
    .expect(httpStatus.OK);
};
