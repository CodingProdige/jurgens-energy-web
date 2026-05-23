# Environment

This project keeps a single root environment file:

```text
.env
```

Do not add additional `.env.example`, `.env.local`, `.env.production`, or `.env.selfhost` files unless the project explicitly changes this rule.

## Local Development Values

Use these values as the local development baseline:

```env
APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
AUTH_SECRET=replace-with-a-long-random-secret
AUTH_GOOGLE_ID=replace-with-google-client-id
AUTH_GOOGLE_SECRET=replace-with-google-client-secret
ADMIN_HOSTNAME=admin.localhost
SELLER_HOSTNAME=seller.localhost

POSTGRES_DB=marketplace
POSTGRES_USER=marketplace
POSTGRES_PASSWORD=replace-with-your-local-database-password
DATABASE_URL=postgres://marketplace:replace-with-your-local-database-password@localhost:5432/marketplace

REDIS_URL=redis://localhost:6379
MEDIA_ROOT=./storage/media
MEDIA_STORAGE_PATH=./storage/media
INVOICE_STORAGE_PATH=./storage/invoices
EXPORT_STORAGE_PATH=./storage/exports
BACKUP_STORAGE_PATH=./storage/backups

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-now
ADMIN_NAME=Marketplace Admin

SENDGRID_API_KEY=replace-with-sendgrid-api-key
SENDGRID_FROM_EMAIL=no-reply@piessang.com
SENDGRID_FROM_NAME=Piessang
SENDGRID_WEBHOOK_PUBLIC_KEY=replace-with-sendgrid-signed-event-webhook-key

WEB_PUSH_PUBLIC_KEY=replace-with-vapid-public-key
WEB_PUSH_PRIVATE_KEY=replace-with-vapid-private-key
WEB_PUSH_SUBJECT=mailto:no-reply@piessang.com
```

## Self-Hosted Values

For self-hosting, update the same `.env` file with production-style values:

```env
APP_URL=https://piessang.com
AUTH_URL=https://piessang.com
AUTH_SECRET=replace-with-a-long-random-production-secret
AUTH_GOOGLE_ID=replace-with-google-client-id
AUTH_GOOGLE_SECRET=replace-with-google-client-secret

DOMAIN=piessang.com
ADMIN_HOSTNAME=admin.piessang.com
SELLER_HOSTNAME=seller.piessang.com
CADDY_EMAIL=admin@example.com

POSTGRES_DB=marketplace
POSTGRES_USER=marketplace
POSTGRES_PASSWORD=replace-with-a-strong-database-password
DATABASE_URL=postgres://marketplace:replace-with-a-strong-database-password@localhost:5432/marketplace

REDIS_URL=redis://localhost:6379
MEDIA_ROOT=/data/media
MEDIA_STORAGE_PATH=/Users/dillonjurgens/Piessang/storage/media
INVOICE_STORAGE_PATH=/Users/dillonjurgens/Piessang/storage/invoices
EXPORT_STORAGE_PATH=/Users/dillonjurgens/Piessang/storage/exports
BACKUP_STORAGE_PATH=/Users/dillonjurgens/Piessang/storage/backups

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-admin-password
ADMIN_NAME=Marketplace Admin

SENDGRID_API_KEY=replace-with-sendgrid-api-key
SENDGRID_FROM_EMAIL=no-reply@piessang.com
SENDGRID_FROM_NAME=Piessang
SENDGRID_WEBHOOK_PUBLIC_KEY=replace-with-sendgrid-signed-event-webhook-key

WEB_PUSH_PUBLIC_KEY=replace-with-vapid-public-key
WEB_PUSH_PRIVATE_KEY=replace-with-vapid-private-key
WEB_PUSH_SUBJECT=mailto:no-reply@piessang.com

CLOUDFLARE_TUNNEL_TOKEN=replace-with-cloudflare-tunnel-token
```

For host-run commands like migrations, `DATABASE_URL` should point at `localhost:5432`. Docker Compose gives the `web` container its internal database URL automatically.

`SENDGRID_FROM_EMAIL` must be a sender identity verified in SendGrid. If either SendGrid value is missing in local development, password reset requests keep showing the dev reset link instead of sending email.

`SENDGRID_WEBHOOK_PUBLIC_KEY` is the Verification key shown by SendGrid when Signed Event Webhook is enabled. Use the endpoint `https://piessang.com/api/webhooks/sendgrid/events` in SendGrid.

`WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_PRIVATE_KEY` are the VAPID keys used for browser push notifications. Generate them with:

```sh
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

`WEB_PUSH_SUBJECT` should be a contact identity you control, usually a `mailto:` address on your domain.

## Google SSO

Create one Google OAuth web client and add redirect URIs for every public auth surface that can start Google sign-in:

```text
http://localhost:3000/api/auth/callback/google
http://admin.localhost:3000/api/auth/callback/google
http://seller.localhost:3000/api/auth/callback/google
https://piessang.com/api/auth/callback/google
https://admin.piessang.com/api/auth/callback/google
https://seller.piessang.com/api/auth/callback/google
```

Use the OAuth client ID as `AUTH_GOOGLE_ID` and the client secret as `AUTH_GOOGLE_SECRET`.

## Storage Paths

`MEDIA_ROOT` is the path inside the running app/container where uploaded media is written. For Docker self-hosting, keep it as:

```env
MEDIA_ROOT=/data/media
```

`MEDIA_STORAGE_PATH`, `INVOICE_STORAGE_PATH`, `EXPORT_STORAGE_PATH`, and `BACKUP_STORAGE_PATH` are host-machine paths mounted into Docker. Local development can use the default `./storage/...` folders. Production/self-hosting should point these at a durable folder outside the repo so app deploys do not touch uploaded files.
