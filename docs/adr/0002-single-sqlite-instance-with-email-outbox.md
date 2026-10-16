# Single SQLite instance with a transactional email outbox

The app runs as one process on one VPS with SQLite (WAL) on a mounted volume. Emails are inserted into an `email_outbox` table in the same transaction as the change that causes them, and an in-process sender drains it with retries and throttling (Gmail SMTP limits). This keeps "participant added + invitation queued" atomic without a message broker, at the cost of never scaling horizontally — acceptable for family-sized events. A daily job in a second container (same image) handles retention and backups against the same volume.
