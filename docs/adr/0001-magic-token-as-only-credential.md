# Long-lived magic token is the only credential

There are no accounts, passwords or sessions. A person signs in with a personal link carrying a random magic token (stored only as a SHA-256 hash), which the client keeps in `localStorage` and sends as a Bearer header. Tokens live for a year and requesting a new link adds a token rather than revoking old ones, because the users are families (incl. elderly relatives) who reuse the same email for weeks, and single-use links break when mail scanners pre-fetch URLs. The token travels in the URL fragment (`/auth#token=…`) so it never reaches server or proxy logs.

## Considered Options

- Single-use 15-minute link exchanged for an httpOnly session cookie: more secure, rejected for usability and pre-fetch breakage.
