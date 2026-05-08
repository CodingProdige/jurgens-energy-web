# Piessang Marketplace

Self-hosted multi-vendor marketplace foundation built as a modular monolith.

Project engineering rules live in `docs/engineering-principles.md`. Agents and humans should read those before making architectural changes.

Environment rules live in `docs/environment.md`. This project keeps one root `.env` file.

Brand rules live in `docs/brand.md`. Store source-controlled brand assets in `public/brand/`.

Deployment rules live in `docs/deployment.md`. The production server deploys
from GitHub Actions through a self-hosted runner.

## Stack

- Next.js App Router
- PostgreSQL
- Drizzle ORM and Drizzle Kit
- Auth.js
- Redis
- Docker Compose
- Caddy reverse proxy and local media serving
- Local disk storage under `./storage`

## Local Setup

1. Create or edit the single root `.env` file using `docs/environment.md` as the reference.

2. Set strong values for:

```bash
AUTH_SECRET
POSTGRES_PASSWORD
ADMIN_PASSWORD
```

3. Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

4. Run migrations:

```bash
npm run db:migrate
```

5. Seed the first admin user:

```bash
npm run db:seed:admin
```

6. Start the app locally:

```bash
npm run dev
```

Open `http://localhost:3000`, then sign in at `/sign-in` with the seeded admin credentials. The protected admin page is at `/admin`.

The marketplace app is organized under `app/(marketplace)` and is reachable locally at:

```text
http://localhost:3000
```

The admin dashboard is organized separately under `app/(admin)` and is reachable locally at:

```text
http://localhost:3000/admin
http://admin.localhost:3000
```

The seller dashboard is organized separately under `app/(seller)` and is reachable locally at:

```text
http://localhost:3000/seller
http://seller.localhost:3000
```

## Daily Commands

Start the normal local development stack:

```bash
npm run local:start
```

This starts Postgres and Redis in Docker, runs migrations, seeds the admin user, and starts the Next.js dev server at `http://localhost:3000`.

Local development Docker data uses the Compose project `piessang_dev`.

Stop the local development stack:

```bash
npm run local:stop
```

Open the database UI:

```bash
npm run db:view
```

Show Docker service status:

```bash
npm run infra:status
```

Follow database/cache logs:

```bash
npm run infra:logs
```

Run the full production-like Docker stack:

```bash
npm run selfhost:start
```

Use `local:start` while building features. Use `selfhost:start` when you want to test the self-hosted Caddy plus Next.js container path.

## Self-Hosting

Use this path when you are testing the setup that will eventually be publicly accessible.

1. Edit the single root `.env` file using `docs/environment.md` as the reference.

2. Set:

```text
APP_URL
AUTH_URL
AUTH_SECRET
DOMAIN
POSTGRES_PASSWORD
DATABASE_URL
ADMIN_EMAIL
ADMIN_PASSWORD
```

For host-run commands like migrations, `DATABASE_URL` should point at `localhost:5432`. The Docker `web` service automatically receives the internal container database URL.

3. Bootstrap the database:

```bash
npm run selfhost:bootstrap
```

4. Start the self-hosted stack:

```bash
npm run selfhost:start
```

Open:

```text
http://localhost
```

5. Stop the self-hosted stack:

```bash
npm run selfhost:stop
```

### Public Access With Cloudflare Tunnel

Cloudflare Tunnel can run as part of Docker Compose. Create a tunnel in the Cloudflare Zero Trust dashboard, point its public hostname at:

```text
http://caddy:80
```

Then set this in `.env`:

```env
CLOUDFLARE_TUNNEL_TOKEN=your-token
```

Start the public stack:

```bash
npm run selfhost:start:public
```

Follow logs:

```bash
npm run selfhost:logs
```

See `infra/cloudflare/README.md` for the Cloudflare-specific notes.

The intended public hostname split is:

```text
https://piessang.com        -> marketplace
https://admin.piessang.com  -> admin dashboard
https://seller.piessang.com -> seller dashboard
```

Both hostnames still route to the same Docker stack and the same Next.js project.

Self-hosted Docker data uses the Compose project `piessang_selfhost`, which keeps it separate from local development containers and volumes on the same machine.

## Docker Compose

To run the self-hosted stack:

```bash
npm run selfhost:start
```

Services:

- `web`: Next.js standalone production server
- `postgres`: PostgreSQL primary database
- `redis`: cache, rate-limit, and future queue layer
- `caddy`: reverse proxy plus `/media/*` static file serving

Caddy serves files from `./storage/media` at `/media/*` with long-lived cache headers so Cloudflare can cache static media.

## Database

Schema lives in domain files under `src/db/schema/`, with `src/db/schema/index.ts` as the shared export surface.

Initial migration:

```text
src/db/migrations/0000_marketplace_foundation.sql
```

Useful commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

## Modules

Business logic belongs in `src/modules/*`, not in page components. Starter modules include:

```text
users
auth
sellers
seller_staff
products
product_variants
categories
media
cart
checkout
orders
order_items
payments
shipping
commissions
payouts
reviews
audit_logs
admin
```

## Security Notes

- Source-of-truth data belongs in PostgreSQL.
- Uploaded files belong on local disk outside the app folder.
- Store only media metadata and relative paths in the database.
- Server Actions and Route Handlers must perform server-side auth and permission checks.
- Never trust client-provided roles.
- Admin access is enforced server-side through `requireRole(["admin"])`.

## Future Additions

Planned services fit naturally into the current Compose model:

- Grafana, Prometheus, Loki, Promtail
- CrowdSec or Fail2ban
- Meilisearch
- MinIO, only if local object-compatible storage becomes useful
