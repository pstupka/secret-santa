// Shapes of the server's JSON (see server/src/swagger.json).

// The person a magic token identifies (`GET /api/me`).
export interface Person {
  id: string;
  email: string;
}

export type EventStatus = 'open' | 'drawn' | 'finished';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  // Minor units, e.g. 15000 = 150.00 PLN.
  budgetAmount: number | null;
  // ISO 4217, e.g. 'PLN'.
  budgetCurrency: string | null;
  rules: string | null;
  // IANA, e.g. 'Europe/Warsaw'.
  timezone: string;
  // Exchange date, YYYY-MM-DD in `timezone`.
  exchangeOn: string;
  status: EventStatus;
  drawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// `POST /api/events` (public): creates the event and its organizer, then
// emails the organizer their personal link.
export interface CreateEventInput {
  title: string;
  description?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
  rules?: string;
  timezone: string;
  exchangeOn: string;
  organizerName: string;
  organizerEmail: string;
}
