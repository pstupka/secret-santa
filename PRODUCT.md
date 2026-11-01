# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Polish-speaking families and groups of friends organising a gift exchange, usually for Wigilia or Mikołajki. It is a public service, not a tool for one family.

Two users carry equal weight, and the design must not lose either:

- **The organizer**: one person who gathers the whole family. They create the event, add everyone, send invitations, set exclusions and run the draw. Often on a phone, fitting it between other things.
- **Participants, including older relatives**: they arrive from an email via their personal link, often on a phone and sometimes with low confidence with technology. A relative without email takes part as a managed participant, and their caretaker acts for them.

## Product Purpose

Run a family Secret Santa from start to finish: gather the group, share wishlists (including children's), draw the pairs in secret, and count down to the exchange date. Success means every participant knows whom they buy for and what that person wants, nobody learns any other pair, and nobody had to create an account.

## Positioning

- **No accounts, just a link.** A personal link sent by email is the only credential (ADR 0001). There is nothing to register or remember, and a lost link is re-sent by email.
- **Built for families.** Managed participants with a caretaker, and children's wishlists that sit outside the draw, with claims ("I'll buy this") that everyone, the child's parent included, sees and can make.
- **Real secrecy.** Nobody sees pairs other than their own, the organizer included. A draw is only ever redone whole, never edited (ADR 0005).
- **Free, no ads, private.** Self-hosted, with no tracking. An event's data is deleted 60 days after its exchange date.

## Operating Context

- Flow: the organizer creates an event and gets their personal link by email. They add participants silently, since adding sends nothing. Then they send invitations in bulk or one by one. Participants are in by default and may decline (ADR 0004). Wishlists follow, then the organizer runs the draw and everyone gets a "your recipient" email. A countdown runs until the exchange date, after which the event is read-only.
- Email is the front door. Invitations, draw results and lost-link emails carry the personal link, and are sent through an outbox with no scheduled emails (ADRs 0002, 0003).
- Print: the assignment has a printable version, for relatives who prefer paper.
- The exchange often happens at a shared family table, so an assignment may be opened in company.

## Capabilities and Constraints

- Terminology is fixed in `GLOSSARY.md` (participant, organizer, managed participant, caretaker, declined, personal link, invitation, draw, assignment, exclusion, wishlist, child wishlist, claim). UI copy uses the Polish equivalents in `client/src/locales/pl.json`.
- Draw rules: at least 3 non-declined participants, and every non-managed participant must be invited. Exclusion pairs apply in both directions. After the draw, membership and exclusions are locked. The draw can be redone as a whole, re-emailing everyone, until the exchange date. A caretaker and their managed participant never draw each other.
- Wishlist visibility: before the draw, only the owner and their caretaker can see a wishlist; after it, their Santa can too. Children's wishlists are visible to all participants.
- Locale: Polish only (`pl`), for both UI and email copy.
- Stack: Vue 3 + Vite + Tailwind v4 client, and an Express + SQLite server, shipped as one Docker image behind Caddy.

## Brand Commitments

- Polish product name: **Twój Tajny Mikołaj**.
- Voice: warm, plain, family Polish ("Wigilia u Kowalskich", "Babcia Zosia", "szary papier"), precise about the domain.

## Evidence on Hand

- Real product copy in `client/src/locales/pl.json` and the email templates.
- There are no testimonials, user counts, press or partner logos. Future work must not fabricate any.

## Product Principles

1. **The secret is the product.** Every surface that shows an assignment protects it, including from people looking over a shoulder.
2. **A link, not an account.** Never add a step that feels like signing up or remembering a password.
3. **The family is the unit.** Grandparents without email and children outside the draw are first-class cases, not edge cases.
4. **Guide the organizer.** One person carries the whole event, so always make their next step obvious.
5. **Ask for nothing beyond the exchange.** Collect only what the exchange needs, and let it expire.

## Accessibility & Inclusion

- Older participants on phones: readable sizes, large touch targets, plain language, and a printable assignment.
- Keyboard and screen-reader support for the whole flow: real labels, announced status changes, visible focus.
