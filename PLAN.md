### Secret Santa

## Tech stack
- Backend: Express.js, SQLite,
- Frontend: Vite, Vue 3, TypeScript, Tailwind CSS, Vue Router, Pinia

## General Flow
1. Create a new Secret Santa event.
2. Invite participants to join the event.
3. Participants accept the invitation and join the event.
4. Participants provide their wish lists for the presents.
5. Organizer picks a date for initial mail from Santa
6. On the chosen date, recipents of the presents are chosen and the initial mail from Santa is sent to all participants.
7. Countdown to the gift exchange date.
8. Gift exchange takes place on the chosen date.
9. Event concludes and the Santa sends final messages to all participants on the next day.

### Create a new Secret Santa event
- Host creates an event by providing the event name, description, and the date for the initial mail from Santa.
- Host optionally sets a maximum number of participants for the event.
- Host confirms the creation of the event and receives a unique event link 
- Host can preset the rules for the gift exchange, such as budget limits or gift categories.
- Host can edit or delete the event before it starts.
- Host can manage participant invitations, e.g. sending, resending, or revoking invitations.
- Host can view the list of participants and their RSVP status.
- Host can preset the participant to be accepted by default, e.g., for elderly participants.


### Authorization and Authentication
- Admin user has full access to all events and can manage all aspects of the platform, including creating, editing, and deleting events, managing participants, and overseeing the gift exchange process.
- Regular users can create and manage their own events, invite participants, and participate in gift exchanges, but have limited access to events created by other users.
- Auth for regular users is done using email and secret link only. In other words, users receive a secret link via email to authenticate themselves without the need for a password.
- Secret link can be resent. Only requirement is an email address.


### Users
- User can see the list of events they are participating in.
- User can view the details of an event they are participating in, including the list of participants, event rules, and important dates.