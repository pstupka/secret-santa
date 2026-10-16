# Secret Santa

Organizing family Secret Santa gift exchanges: one person gathers a group, everyone shares wishlists, and a draw secretly pairs each giver with a recipient.

## People

**Person**:
A human identified by an email address, independent of any event.
_Avoid_: User, account

**Participant**:
A person's (or a managed participant's) membership in one event.
_Avoid_: Member, guest, invitee, attendee

**Organizer**:
The one participant who created the event and manages it. Also takes part in the draw.
_Avoid_: Host, admin, owner

**Managed participant**:
A participant without an email address (typically an elderly relative) whose actions are carried out by their caretaker.
_Avoid_: Offline user, proxy user, dependent

**Caretaker**:
The participant who acts on behalf of a managed participant.
_Avoid_: Guardian, proxy, manager

**Declined**:
A participant who has opted out of the draw. Participants are in by default.
_Avoid_: Rejected, left, removed

## Access

**Personal link**:
A URL carrying a person's magic token; the only way to sign in.
_Avoid_: Secret link, login link, magic URL

**Magic token**:
The secret credential inside a personal link that identifies a person.
_Avoid_: Password, session, API key

**Invitation**:
The email that tells a participant about an event and gives them their personal link. Sending it is a separate, deliberate step after adding the participant.
_Avoid_: Initial mail, RSVP

## Event

**Event**:
One Secret Santa gift exchange with its participants, rules, budget and exchange date.
_Avoid_: Group, game, party

**Exchange date**:
The day gifts are handed over; after it the event is finished and read-only.
_Avoid_: Final date, gift day

**Draw**:
The organizer-triggered random assignment of every non-declined participant to exactly one other participant as their recipient. Can be redone as a whole, never edited.
_Avoid_: Assignment run, shuffle, matching

**Assignment**:
One giver → recipient pair produced by the draw. Only the giver (or their caretaker) may see it.
_Avoid_: Match, pairing

**Santa**:
The giver in an assignment, from the recipient's point of view.
_Avoid_: Giver (when talking to the recipient)

**Exclusion**:
A pair of participants who must not draw each other, in either direction.
_Avoid_: Blacklist, restriction, constraint

## Wishlists

**Wishlist**:
A list of gift ideas for a participant, or for one of their children.

**Child wishlist**:
A wishlist for a participant's child. Visible to all participants; children are not part of the draw.
_Avoid_: Kid list, family wishlist

**Claim**:
A participant's mark on a child wishlist item meaning "I'll buy this". Hidden from the child's parent.
_Avoid_: Reservation, booking
