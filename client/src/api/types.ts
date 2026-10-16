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

export type ParticipantRole = 'organizer' | 'member';

// Participants are in by default (ADR-0004) until they decline.
export type ParticipantStatus = 'active' | 'declined';

// The caller's own participant in an event.
export interface MyParticipant {
  id: string;
  role: ParticipantRole;
  status: ParticipantStatus;
}

// What every participant may see about the others: names and statuses.
export interface ParticipantSummary {
  id: string;
  displayName: string;
  role: ParticipantRole;
  status: ParticipantStatus;
}

// The organizer's view of a participant (`GET /events/:id/participants`).
export interface OrganizerParticipant extends ParticipantSummary {
  // null for a managed participant.
  email: string | null;
  // The caretaker of a managed participant, otherwise null.
  managedByParticipantId: string | null;
  inviteSentAt: string | null;
  firstOpenedAt: string | null;
  wishlistFilled: boolean;
}

// One of the person's events (`GET /api/events`).
export interface MyEvent extends Event {
  myParticipant: MyParticipant;
}

// `GET /api/events/:eventId`.
export interface EventDetails extends MyEvent {
  participants: ParticipantSummary[];
  // The caller's managed participants, whom they can act as (`X-Acting-As`).
  managedParticipants: ParticipantSummary[];
}

// One gift idea on a wishlist.
export interface WishlistItem {
  id: string;
  title: string;
  url: string | null;
  notes: string | null;
  // Claim info, only on child wishlists and never for the child's parent:
  // whether the reader holds the claim, and the claimer's name (null =
  // unclaimed).
  claimedByMe?: boolean;
  claimedBy?: string | null;
}

export interface Wishlist {
  id: string;
  // The owner: the participant whose wishlist it is, or the parent of a child.
  participantId: string;
  participantName: string;
  // null = the participant's own wishlist; otherwise a child wishlist.
  childName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // In the owner's order.
  items: WishlistItem[];
}

// `GET /api/events/:eventId/my-assignment`: whom the acting participant gives
// a gift to, with the recipient's own wishlist (null until they write one).
export interface MyAssignment {
  recipient: { id: string; displayName: string };
  wishlist: Wishlist | null;
}
