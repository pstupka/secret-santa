# secret-santa
Secret Santa web service

## Deployment

One Docker image runs the API and serves the built client (with an SPA
fallback for client routes); Caddy in front of it terminates TLS. Deployment is
manual: no CI, the image is built on the VPS from a checkout of this repo.

| File                | Purpose                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `Dockerfile`        | Multi-stage build: client, server, production-only runtime image. |
| `compose.prod.yaml` | `app` (the image, `/data` volume), `cron` and `caddy` (80/443).   |
| `crontab`           | Schedule for the `cron` service (daily job at 03:00 UTC).          |
| `Caddyfile`         | Reverse proxy to `app:8080` with automatic HTTPS for `PUBLIC_URL`. |
| `.env.example`      | Settings to copy into `.env` on the VPS (never committed).        |

### Settings (`.env`)

| Variable     | Example                                     | Notes                                                    |
| ------------ | ------------------------------------------- | -------------------------------------------------------- |
| `PUBLIC_URL` | `https://santa.example.com`                 | No trailing slash. Links in emails and Caddy's site address. |
| `SMTP_URL`   | `smtps://user:password@smtp.example.com:465` | `smtp://` (STARTTLS) or `smtps://`; URL-encode credentials. |
| `MAIL_FROM`  | `Secret Santa <santa@example.com>`          | Sender of every email.                                   |
| `BACKUP_RCLONE_REMOTE` | `b2:santa-backups`                | Optional. rclone destination for offsite backup copies.  |

`NODE_ENV=production` and `DATABASE_PATH=/data/secret-santa.db` are set by
`compose.prod.yaml`. The SQLite database (WAL mode) lives on the `santa-data`
volume; migrations run when the app starts.

### Daily job: retention and backups

The `cron` service runs the same image with `supercronic`, which starts
`node dist/jobs/daily.js` every day at 03:00 UTC (`crontab`). Against the same
`/data` volume it:

1. **Retention**: hard-deletes events once more than 60 days have passed since
   their exchange date (counted in the event's timezone: an exchange on 24 Dec
   is deleted from 23 Feb), then persons left without any participation (with
   their magic tokens), then sent emails older than 7 days.
2. **Backup**: writes `/data/backups/santa-YYYY-MM-DD.db` (`VACUUM INTO`, UTC
   date), keeps the latest 14, and when `BACKUP_RCLONE_REMOTE` is set runs
   `rclone copy` of the new snapshot to it. Old copies on the remote are not
   pruned; use the storage's lifecycle rules for that.

The remote is configured with rclone's environment variables in `.env`
(`RCLONE_CONFIG_<NAME>_*`, see `.env.example` and `rclone help environment`),
e.g. `RCLONE_CONFIG_B2_TYPE=b2`, `RCLONE_CONFIG_B2_ACCOUNT`,
`RCLONE_CONFIG_B2_KEY` and `BACKUP_RCLONE_REMOTE=b2:santa-backups`. Check it
once by running the job by hand:

```sh
docker compose -f compose.prod.yaml exec cron node dist/jobs/daily.js
```

To restore, stop the app, copy a snapshot over `/data/secret-santa.db` (and
remove any `secret-santa.db-wal`/`-shm` next to it), then start the app again.

### First deploy

1. Point a DNS A/AAAA record for the subdomain (e.g. `santa.example.com`) at
   the VPS and open ports 80 and 443.
2. Install Docker with the Compose plugin, then clone the repo on the VPS.
3. `cp .env.example .env` and fill it in.
4. `docker compose -f compose.prod.yaml up -d --build`
5. Check: `docker compose -f compose.prod.yaml ps` shows `app` as `healthy` and
   `cron` as running, and
   `https://santa.example.com/api/health` answers `{"status":"OK",...}`.

### Update

```sh
git pull
docker compose -f compose.prod.yaml up -d --build
docker image prune -f
```

The app restarts on the new image and applies any new migrations on start.

### Useful commands

```sh
docker compose -f compose.prod.yaml logs -f app       # app logs
docker compose -f compose.prod.yaml logs cron         # daily job runs
docker compose -f compose.prod.yaml restart app       # restart the app only
docker build -t secret-santa .                        # build the image alone
```

## Development

See `server/README.md`: `yarn docker:server:dev` runs the API with Mailpit,
`yarn client:dev` runs the Vite dev server (proxying `/api` to the API).
