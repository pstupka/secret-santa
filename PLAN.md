# Secret Santa — Plan

> Status: **agreed design (2026-10-16)**, pending final confirmation.

## Tech stack

- Monorepo (yarn workspaces): `server/`, `client/`.
- Backend: Node 24, Express 5, TypeScript, Joi validation (existing template).
- Database: SQLite via `better-sqlite3` + Kysely (typed query builder) + Kysely migrations.
- Email: Nodemailer over SMTP (`SMTP_URL`). Production uses Gmail SMTP with an app password (requires 2FA on the account; ~500 recipients/day limit). Dev uses Mailpit in docker compose.
- Frontend: Vite, Vue 3, TypeScript, Tailwind CSS, Vue Router, Pinia, vue-i18n (default and only shipped locale: `pl`; all copy in message files). Emails use the same locale.
- Deployment: a single Docker image (API + built client static files) on own VPS behind Caddy, SQLite file on a mounted volume.

## Current repo state (2026-10-16)

- `server/` is an Express template: healthcheck, 404, swagger, error handling, request id, logger, Joi `validate` middleware, `x-api-key` middleware (being renamed to `protectedByApiKey`).
- `server/src/components/user/` is a template sample with in-memory storage — to be removed.
- `server/src/components/secret-event/` is an unwired stub (not mounted in `api.ts`, routes don't match the endpoint design below) — to be replaced.
- `client/` contains only `package.json`.
- No database, no email, no scheduler, no tests beyond template middleware tests.
- Docker: dev compose for the server only; prod Dockerfile builds only the server.

## General Flow

1. Organizer creates an event (public, no account) and receives their personal link by email.
2. Organizer builds the participant list **silently** — adding a participant sends nothing.
3. Organizer sends invitations when ready: **in bulk** (all participants not yet invited) or **to a single participant** (send or resend). The invitation is the "mail from Santa": event info, rules, instructions, wishlist reminder and the personal link.
4. Participants are **in by default** once invited. Their personal link lets them view the event, edit wishlists, or **decline**. The organizer sees per participant: not invited / invited / opened / declined, and a "wishlist filled ✓/✗" flag (nothing else about the wishlist).
   - The personal link is unique to each person and confidential.
   - A lost link can be requested again by email.
5. Participants provide wishlists.
   - Each participant has their own wishlist. Before the draw only the owner (and their caretaker) can read it; after the draw also their Secret Santa.
   - A participant can add wishlists for their children; these are readable by all participants. Children are not part of the draw — they get gifts from the group outside the draw.
   - Items on children's wishlists can be **claimed** ("I'll buy this"). Claims are visible to other participants but hidden from the child's parent. Each participant has a "my claims" shopping list.
   - Wishlists can be updated or removed until the exchange date.
6. Draw: the organizer triggers it manually. It includes every participant who is not declined, requires ≥ 3 of them, and requires every non-managed participant to have been invited. Each drawn participant is assigned exactly one other drawn participant (classic Secret Santa), respecting **exclusion pairs** set by the organizer. Everyone gets a "your recipient" email.
   - The organizer is a normal participant in the draw. Nobody — organizer included — can see pairs other than their own.
   - After the draw, membership is locked (no invites, no removals). The organizer can **redo the draw** before `exchangeOn`; it replaces all pairs and re-emails everyone.
7. Countdown to `exchangeOn`.
8. Gift exchange takes place on `exchangeOn`; event becomes read-only.

Dates are **dates only** (`YYYY-MM-DD`) interpreted in the event's IANA timezone. The event finishes at the end of `exchangeOn`. There are **no scheduled emails** — every email is triggered by a user action.

### Managed participants (elderly / offline)

- The organizer can add a participant with no email and assign a **caretaker**: another participant of the same event.
- A managed participant is active on creation and never receives emails.
- The caretaker's UI has a profile switcher: they edit the managed participant's wishlist and see their draw result (with a print-friendly page to hand over). The draw-result email for a managed participant goes to the caretaker as a separate email.
- Caretaker and managed participant are always excluded from drawing each other (built-in, not removable).

## Event lifecycle

```
open ──(organizer: draw)──▶ drawn ──(end of exchangeOn)──▶ finished
            ▲                 │
            └──(redo draw)────┘
```

- `open`: organizer adds participants, sends invitations; participants edit wishlists or decline.
- `drawn`: membership and exclusions locked.
- `finished`: read-only. Computed on read (`today > exchange_on` in the event timezone) — no job needed.

## Authorization and Authentication

- No password accounts. Event creation is public; the organizer is the participant with role `organizer`.
- A **person** is identified by email. A personal magic token is the only credential; it is emailed in a personal URL.
- Only a SHA-256 hash of the token is stored. Raw tokens never appear in API responses or logs.
- A token identifies the person across all their event memberships. Role in each event (`organizer` / `member`) decides permissions.
- Links can be re-requested by email (`POST /api/access-links`, generic response, rate-limited). Organizers send invitations in bulk or to one participant.
- Exactly one organizer per event: auto-active, cannot be removed, no co-organizers or transfer in v1.
- No admin role in v1. Abuse cleanup is done directly on the database.
- Tokens are long-lived (expire after 1 year). Requesting a new link issues an additional token; old tokens keep working. The client stores the token in `localStorage` and sends it as a Bearer header. Links carry the token in the URL fragment (`/auth#token=…`) so it never reaches server/proxy logs.

## Database design (SQLite)

All ids are UUIDv7 text. Timestamps are ISO-8601 UTC text. Foreign keys on, `ON DELETE CASCADE` from `events`.

```sql
CREATE TABLE persons (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at    TEXT NOT NULL
);

CREATE TABLE access_tokens (
  id            TEXT PRIMARY KEY,
  person_id     TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,      -- sha256(raw token)
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,             -- created_at + 1 year
  last_used_at  TEXT,
  revoked_at    TEXT
);

CREATE TABLE events (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT,
  budget_amount    INTEGER,                -- minor units
  budget_currency  TEXT,                   -- ISO 4217, e.g. 'PLN'
  rules            TEXT,                   -- free-form organizer rules
  timezone         TEXT NOT NULL,          -- IANA, e.g. 'Europe/Warsaw'
  exchange_on      TEXT NOT NULL,          -- YYYY-MM-DD
  status           TEXT NOT NULL CHECK (status IN ('open','drawn')),  -- 'finished' derived from exchange_on
  drawn_at         TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- An invitation IS a participant row (invitationId = participantId).
CREATE TABLE participants (
  id            TEXT PRIMARY KEY,
  event_id      TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id     TEXT REFERENCES persons(id),      -- null for managed participants
  managed_by_participant_id TEXT REFERENCES participants(id) ON DELETE CASCADE,  -- caretaker
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('organizer','member')),
  status        TEXT NOT NULL CHECK (status IN ('active','declined')),  -- in by default
  added_at      TEXT NOT NULL,
  invite_sent_at TEXT,                            -- null = not yet invited
  first_opened_at TEXT,                           -- first authenticated view of this event
  responded_at  TEXT,
  UNIQUE (event_id, person_id),
  CHECK ((person_id IS NULL) = (managed_by_participant_id IS NOT NULL))
);

CREATE TABLE wishlists (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  child_name      TEXT,                    -- null = participant's own list
  notes           TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE wishlist_items (
  id           TEXT PRIMARY KEY,
  wishlist_id  TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  title        TEXT NOT NULL,
  url          TEXT,
  notes        TEXT,
  claimed_by_participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL,  -- children's lists only
  claimed_at   TEXT
);

-- Symmetric: (a,b) forbids a→b and b→a. Stored with participant_a_id < participant_b_id.
CREATE TABLE exclusions (
  event_id          TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_a_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  participant_b_id  TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, participant_a_id, participant_b_id),
  CHECK (participant_a_id < participant_b_id)
);

CREATE TABLE assignments (
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  giver_id        TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  receiver_id     TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, giver_id),
  UNIQUE (event_id, receiver_id),
  CHECK (giver_id <> receiver_id)
);

-- Transactional outbox: emails are queued in the same transaction as the change that causes them.
CREATE TABLE email_outbox (
  id           TEXT PRIMARY KEY,
  to_email     TEXT NOT NULL,
  template     TEXT NOT NULL,             -- 'organizer-link' | 'access-link' | 'invitation' | 'draw-result'
  payload      TEXT NOT NULL,             -- JSON
  send_after   TEXT NOT NULL,
  sent_at      TEXT,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT
);
```

Raw magic tokens are needed inside `email_outbox.payload` until sent; the worker clears the token from the payload after a successful send.

## Background worker

An in-process ticker (every ~10 s) in the API process drains `email_outbox` (retry with backoff, max 5 attempts). Bulk invitations and the draw enqueue many rows in one transaction; the worker sends them with a small delay to stay under Gmail limits.

Single instance only — consistent with SQLite.

## Backend endpoints

All paths under `/api`. Protected endpoints take `Authorization: Bearer <token>`. Responses are JSON; errors use the existing `AppError` shape. The template `user` component and the `secret-event` stub are removed. `protectedByApiKey` stays in `core/middlewares` but is not mounted on business routes.

Rate limits (in-memory, single instance): `POST /events` and `POST /access-links` 5/hour per IP and 3/hour per target email; max 50 participants per event.

### Access

| Method | Endpoint            | Auth   | Purpose                                                                     |
| ------ | ------------------- | ------ | --------------------------------------------------------------------------- |
| `POST` | `/api/access-links` | public | `{ email }` → email a fresh personal link if known. Always `202`. Rate-limited. |
| `GET`  | `/api/me`           | token  | Current person (`id`, `email`) — lets the client validate a stored token.   |

### Events

| Method   | Endpoint               | Auth        | Purpose                                                                                       |
| -------- | ---------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `POST`   | `/api/events`          | public      | Create event + organizer participant from `organizerEmail`, `organizerName`; email personal link. `201` with event. Rate-limited. |
| `GET`    | `/api/events`          | token       | Events the person participates in (any status), with their role and participant status.      |
| `GET`    | `/api/events/:eventId` | participant | Event details, rules, dates, participant list (names + statuses).                             |
| `PATCH`  | `/api/events/:eventId` | organizer   | Update details/dates; nothing editable once `finished`. |
| `DELETE` | `/api/events/:eventId` | organizer   | Delete event and all its data.                                                                |

### Invitations and participants

| Method   | Endpoint                                           | Auth                | Purpose                                                                 |
| -------- | -------------------------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| `POST`   | `/api/events/:eventId/participants`                | organizer           | Add one participant silently: `{ displayName, email }` or `{ displayName, managedByParticipantId }`. `201`. No email sent. |
| `POST`   | `/api/events/:eventId/invitations/send`            | organizer           | Bulk: send invitations only to non-managed participants with `invite_sent_at IS NULL`. Returns count. Never re-sends. |
| `POST`   | `/api/events/:eventId/participants/:participantId/invitation` | organizer | Send or resend the invitation to one participant (the only way to resend). |
| `POST`   | `/api/events/:eventId/participation/decline`       | participant         | Decline (leave the draw); only while `open`.                            |
| `POST`   | `/api/events/:eventId/participation/rejoin`        | participant         | Undo decline; only while `open`.                                        |

Acting for a managed participant: caretaker requests add `X-Acting-As: <participantId>`; the server checks `managed_by_participant_id` matches the caller's participant.
| `GET`    | `/api/events/:eventId/participants`                | participant         | List participants; organizer additionally sees emails, invite/opened/declined state and wishlist-filled flag. |
| `DELETE` | `/api/events/:eventId/participants/:participantId` | organizer           | Remove participant (not the organizer; not once `drawn`). Removing a caretaker requires reassigning or removing their managed participants first. |
| `GET`    | `/api/events/:eventId/exclusions`                  | organizer           | List exclusion pairs.                                                   |
| `POST`   | `/api/events/:eventId/exclusions`                  | organizer           | `{ participantAId, participantBId }`; not once `drawn`.                 |
| `DELETE` | `/api/events/:eventId/exclusions/:aId/:bId`        | organizer           | Remove a pair; not once `drawn`.                                        |

Adding participants and sending invitations are blocked once the event is `drawn`.

### Wishlists

| Method   | Endpoint                                     | Auth        | Purpose                                         |
| -------- | -------------------------------------------- | ----------- | ----------------------------------------------- |
| `GET`    | `/api/events/:eventId/wishlists`             | participant | Children's wishlists + my own (+ my recipient's once drawn). Claim info omitted on my children's lists. |
| `POST`   | `/api/events/:eventId/wishlists`             | participant | `{ childName?, notes, items[] }`.               |
| `PATCH`  | `/api/events/:eventId/wishlists/:wishlistId` | owner       | Replace fields/items; not once `finished`. Item ids are kept so claims survive edits. |
| `DELETE` | `/api/events/:eventId/wishlists/:wishlistId` | owner       | Not once `finished`.                            |
| `PUT`    | `/api/events/:eventId/wishlist-items/:itemId/claim` | participant (not the parent) | Claim a child's item; `409` if claimed by someone else. |
| `DELETE` | `/api/events/:eventId/wishlist-items/:itemId/claim` | claimer | Release own claim.                    |
| `GET`    | `/api/events/:eventId/my-claims`             | participant | My shopping list of claimed items.              |

### Draw

| Method | Endpoint                             | Auth        | Purpose                                                                                     |
| ------ | ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------- |
| `POST` | `/api/events/:eventId/draw`          | organizer   | Run the draw (`open` → `drawn`) or redo it (`drawn`, before `exchangeOn`). Uses all non-declined participants; `422` if < 3, if anyone non-managed is not yet invited, or if exclusions make it impossible. Enqueues a draw-result email per participant (managed ones → caretaker). Response contains no pairs. |
| `GET`  | `/api/events/:eventId/my-assignment` | participant | Whom I give a gift to (and their wishlist).                                                 |

Algorithm: randomised derangement with retries (backtracking for small n), checking exclusions; uses `crypto.randomInt`.

### Ops

| Method | Endpoint       | Auth   | Purpose                   |
| ------ | -------------- | ------ | ------------------------- |
| `GET`  | `/api/health`  | public | Existing healthcheck.     |

## Web client

Vite + Vue 3 SPA served by the API from the same origin (no CORS).

| Route                         | View                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `/`                           | Landing: "Create event" + "I lost my link" (email form).                             |
| `/new`                        | Create event form → "check your inbox" screen.                                       |
| `/auth#token=…`               | Magic-link landing: stores token, strips it from the URL, redirects to `/events`.   |
| `/events`                     | My events list.                                                                      |
| `/events/:id`                 | Event dashboard: details, countdown, participants, decline / rejoin.                 |
| `/events/:id/wishlists`       | My wishlist + my children's wishlists (add/edit).                                    |
| `/events/:id/kids`            | Other participants' children's wishlists with claim buttons.                         |
| `/events/:id/claims`          | My claims — shopping list.                                                           |
| `/events/:id/manage`          | Organizer: edit event, add participant (incl. managed), send invites (bulk / one), remove participant, exclusions, draw / redo draw, delete event. |
| `/events/:id/assignment/print` | Print-friendly draw result (for caretakers).                                       |
| `/events/:id/assignment`      | My recipient and their wishlist.                                                     |

Pinia stores: `auth` (token, me), `events`. A thin typed `api` client attaches the bearer token and redirects to `/` on `401`.

## Deployment

- One multi-stage Dockerfile at repo root: build client, build server, runtime image serves `/api` + client `dist` with SPA fallback.
- SQLite at `/data/secret-santa.db` on a persistent volume; WAL mode; migrations run on start.
- **Cron container**: second compose service using the **same image** with a different command (`supercronic` → `node dist/jobs/daily.js`), mounting the same `/data` volume. Once a day it:
  1. **Retention**: hard-deletes events 60 days after `exchange_on`, then persons with no participations (and their tokens), and sent `email_outbox` rows older than 7 days.
  2. **Backup**: `VACUUM INTO /data/backups/santa-YYYY-MM-DD.db`, keeps the last 14, and copies offsite with `rclone` when `BACKUP_RCLONE_REMOTE` is set.
- Env: `NODE_ENV`, `PORT`, `PUBLIC_URL` (for links in emails), `DATABASE_PATH`, `SMTP_URL`, `MAIL_FROM`, `BACKUP_RCLONE_REMOTE` (optional).
- No CI/CD in v1: the image is built and deployed by hand on the VPS (`compose.prod.yaml`, `Caddyfile`, `.env` live there). Migrations run on app start.
- TLS via reverse proxy (Caddy) in front of the container, on a subdomain of an owned domain (`PUBLIC_URL`).
- Dev: `docker compose` with server (watch), Vite dev server proxying `/api`, Mailpit.

## Emails

Templates: `organizer-link`, `access-link`, `invitation`, `draw-result` (one per participant; managed participants' copies go to their caretaker). Each is simple HTML plus a plain-text alternative, rendered from `server/src/locales/pl.json` (a server-side copy of the Polish copy; the client has its own vue-i18n catalog).

## Testing

- Server: Jest + supertest integration tests against in-memory SQLite with migrations applied; a fake mailer captures the outbox. The draw algorithm gets property-style tests (bijection, no self-pairs, exclusions and caretaker pairs respected, impossible cases detected).
- Client: Vitest for Pinia stores and the API client.
- E2E: Playwright happy path (create event → magic link via Mailpit → add participants → send invites → wishlists → claim → draw → my assignment).

## Out of scope (for now)

- CI/CD, password accounts, OAuth, scheduled emails, admin role, anonymous Santa↔recipient messages, in-app chat, shipping locales other than `pl`, a "thank you" email after the exchange, reminder emails, co-owned children's wishlists.
