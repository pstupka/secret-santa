import { Generated, Insertable, Selectable, Updateable } from 'kysely';

// Typed view of the SQLite schema created by the migrations in ./migrations.
// All ids are UUIDv7 text, all timestamps ISO-8601 UTC text, dates YYYY-MM-DD.

export interface PersonsTable {
  id: string;
  email: string;
  created_at: string;
}

export interface AccessTokensTable {
  id: string;
  person_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export type StoredEventStatus = 'open' | 'drawn';

export interface EventsTable {
  id: string;
  title: string;
  description: string | null;
  budget_amount: number | null;
  budget_currency: string | null;
  rules: string | null;
  timezone: string;
  exchange_on: string;
  status: StoredEventStatus;
  drawn_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ParticipantRole = 'organizer' | 'member';
export type ParticipantStatus = 'active' | 'declined';

export interface ParticipantsTable {
  id: string;
  event_id: string;
  person_id: string | null;
  managed_by_participant_id: string | null;
  display_name: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  added_at: string;
  invite_sent_at: string | null;
  first_opened_at: string | null;
  responded_at: string | null;
}

export interface WishlistsTable {
  id: string;
  event_id: string;
  participant_id: string;
  child_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WishlistItemsTable {
  id: string;
  wishlist_id: string;
  position: number;
  title: string;
  url: string | null;
  notes: string | null;
  claimed_by_participant_id: string | null;
  claimed_at: string | null;
}

export interface ExclusionsTable {
  event_id: string;
  participant_a_id: string;
  participant_b_id: string;
}

export interface AssignmentsTable {
  event_id: string;
  giver_id: string;
  receiver_id: string;
}

export type EmailTemplate =
  | 'organizer-link'
  | 'access-link'
  | 'invitation'
  | 'draw-result';

export interface EmailOutboxTable {
  id: string;
  to_email: string;
  template: EmailTemplate;
  payload: string;
  send_after: string;
  sent_at: string | null;
  attempts: Generated<number>;
  last_error: string | null;
}

export interface Database {
  persons: PersonsTable;
  access_tokens: AccessTokensTable;
  events: EventsTable;
  participants: ParticipantsTable;
  wishlists: WishlistsTable;
  wishlist_items: WishlistItemsTable;
  exclusions: ExclusionsTable;
  assignments: AssignmentsTable;
  email_outbox: EmailOutboxTable;
}

export type PersonRow = Selectable<PersonsTable>;
export type EventRow = Selectable<EventsTable>;
export type NewEvent = Insertable<EventsTable>;
export type EventUpdate = Updateable<EventsTable>;
export type ParticipantRow = Selectable<ParticipantsTable>;
export type NewParticipant = Insertable<ParticipantsTable>;
export type WishlistRow = Selectable<WishlistsTable>;
export type WishlistItemRow = Selectable<WishlistItemsTable>;
export type EmailOutboxRow = Selectable<EmailOutboxTable>;
