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

POSTGRES_DB=jurgens_energy
POSTGRES_USER=jurgens_energy
POSTGRES_PASSWORD=replace-with-your-local-database-password
DATABASE_URL=postgres://jurgens_energy:replace-with-your-local-database-password@localhost:5433/jurgens_energy

REDIS_URL=redis://localhost:6380
MEDIA_ROOT=./storage/jurgens-energy/media
INVOICE_ROOT=./storage/jurgens-energy/invoices
MEDIA_STORAGE_PATH=./storage/jurgens-energy/media
INVOICE_STORAGE_PATH=./storage/jurgens-energy/invoices
EXPORT_STORAGE_PATH=./storage/jurgens-energy/exports
BACKUP_STORAGE_PATH=./storage/jurgens-energy/backups

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-now
ADMIN_NAME=Jurgens Energy Admin

SENDGRID_API_KEY=replace-with-sendgrid-api-key
SENDGRID_FROM_EMAIL=no-reply@jurgensenergy.com
SENDGRID_FROM_NAME=Jurgens Energy
SENDGRID_WEBHOOK_PUBLIC_KEY=replace-with-sendgrid-signed-event-webhook-key

OPENAI_API_KEY=replace-with-openai-api-key
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=medium

WEB_PUSH_PUBLIC_KEY=replace-with-vapid-public-key
WEB_PUSH_PRIVATE_KEY=replace-with-vapid-private-key
WEB_PUSH_SUBJECT=mailto:no-reply@jurgensenergy.com

WHATSAPP_AUTOMATION_SECRET=replace-with-a-long-random-secret
DIALOGUE_API_KEY=replace-with-360dialog-api-key
DIALOGUE_MESSAGE_URL=https://waba-v2.360dialog.io
WHATSAPP_INVOICE_TEMPLATE_NAME=customer_invoice_issued
WHATSAPP_INVOICE_TEMPLATE_LANGUAGE=en
```

## Self-Hosted Values

For self-hosting, update the same `.env` file with production-style values:

```env
APP_URL=https://jurgensenergy.com
AUTH_URL=https://jurgensenergy.com
AUTH_SECRET=replace-with-a-long-random-production-secret
AUTH_GOOGLE_ID=replace-with-google-client-id
AUTH_GOOGLE_SECRET=replace-with-google-client-secret

DOMAIN=jurgensenergy.com
ADMIN_HOSTNAME=admin.jurgensenergy.com
SELLER_HOSTNAME=seller.jurgensenergy.com
CADDY_EMAIL=admin@example.com

POSTGRES_DB=jurgens_energy
POSTGRES_USER=jurgens_energy
POSTGRES_PASSWORD=replace-with-a-strong-database-password
DATABASE_URL=postgres://jurgens_energy:replace-with-a-strong-database-password@localhost:5433/jurgens_energy

REDIS_URL=redis://localhost:6380
MEDIA_ROOT=/data/media
INVOICE_ROOT=/data/invoices
MEDIA_STORAGE_PATH=/Users/dillonjurgens/JurgensEnergy/storage/media
INVOICE_STORAGE_PATH=/Users/dillonjurgens/JurgensEnergy/storage/invoices
EXPORT_STORAGE_PATH=/Users/dillonjurgens/JurgensEnergy/storage/exports
BACKUP_STORAGE_PATH=/Users/dillonjurgens/JurgensEnergy/storage/backups

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-admin-password
ADMIN_NAME=Jurgens Energy Admin

SENDGRID_API_KEY=replace-with-sendgrid-api-key
SENDGRID_FROM_EMAIL=no-reply@jurgensenergy.com
SENDGRID_FROM_NAME=Jurgens Energy
SENDGRID_WEBHOOK_PUBLIC_KEY=replace-with-sendgrid-signed-event-webhook-key

OPENAI_API_KEY=replace-with-openai-api-key
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=medium

WEB_PUSH_PUBLIC_KEY=replace-with-vapid-public-key
WEB_PUSH_PRIVATE_KEY=replace-with-vapid-private-key
WEB_PUSH_SUBJECT=mailto:no-reply@jurgensenergy.com

WHATSAPP_AUTOMATION_SECRET=replace-with-a-long-random-secret
DIALOGUE_API_KEY=replace-with-360dialog-api-key
DIALOGUE_MESSAGE_URL=https://waba-v2.360dialog.io
WHATSAPP_INVOICE_TEMPLATE_NAME=customer_invoice_issued
WHATSAPP_INVOICE_TEMPLATE_LANGUAGE=en

CLOUDFLARE_TUNNEL_TOKEN=replace-with-cloudflare-tunnel-token
```

OpenAI values in `.env` are server fallbacks. Once the app is running, admins
can manage the encrypted API key, default model, and reasoning effort from
`/settings/platform?section=chatgpt-integration`.

For host-run commands like migrations, `DATABASE_URL` should point at `localhost:5433`. Docker Compose gives the `web` container its internal database URL automatically.

The Docker Compose defaults intentionally avoid common ports used by the copied project: PostgreSQL publishes on `5433`, Redis on `6380`, Caddy HTTP on `3010`, and Caddy HTTPS on `3443`. Override `POSTGRES_PORT`, `REDIS_PORT`, `CADDY_HTTP_PORT`, or `CADDY_HTTPS_PORT` in the single root `.env` only if the server needs different bindings.

## Local Webhook Tunnels

For local provider webhooks such as 360dialog WhatsApp testing, start a temporary Cloudflare Quick Tunnel:

```sh
npm run tunnel:cloudflare
```

The script prefers a local `cloudflared` install and falls back to Docker when available. Use the printed `trycloudflare.com` URL with the webhook route:

```text
https://your-tunnel.trycloudflare.com/api/webhooks/whatsapp
```

Set `APP_URL` to the same tunnel URL while testing WhatsApp checkout links, then restart the dev server:

```env
APP_URL=https://your-tunnel.trycloudflare.com
```

`WHATSAPP_AUTOMATION_SECRET` protects the scheduled follow-up runner at
`/api/whatsapp/follow-ups`. Call it with `POST` and either
`Authorization: Bearer <secret>` or `x-whatsapp-automation-secret: <secret>`.

Invoice WhatsApp delivery uses an approved 360dialog template rather than a
free-form message, so it also works outside WhatsApp's 24-hour service window.
The template named by `WHATSAPP_INVOICE_TEMPLATE_NAME` must contain a document
header and five body placeholders in this exact order: customer name, order
number, invoice number, invoice total, and secure invoice download URL. The
default template name is `customer_invoice_issued` and the default language is
`en`; both values must match the approved template in WhatsApp Manager.
A suitable body is: `Hi {{1}}, thank you for order {{2}}. Your paid tax invoice
{{3}} for {{4}} is attached. Secure download: {{5}}`. `APP_URL` must be publicly
reachable so WhatsApp can retrieve the token-protected PDF used by the document
header.

Credit-note WhatsApp delivery uses a second approved document template named
`customer_credit_note_issued`. Its document header receives the generated
credit-note PDF, and its seven body placeholders must appear in this exact
order:

1. Customer name
2. Order number
3. Original invoice number
4. Credit-note number
5. Credited total
6. Credit reason
7. Secure credit-note download URL

A suitable body is: `Hi {{1}}, credit note {{4}} has been issued for order
{{2}} against invoice {{3}}. Total credited: {{5}}. Reason: {{6}}. Secure
download: {{7}}`.

The credit-note template name is fixed by the application. It uses the same
`WHATSAPP_INVOICE_TEMPLATE_LANGUAGE` value as invoice delivery, so that value
must match the approved language for both templates. `DIALOGUE_API_KEY` and
`DIALOGUE_MESSAGE_URL` configure 360dialog for both document types. `APP_URL`
must be publicly reachable so 360dialog can fetch each token-protected PDF.
Credit-note email uses the seeded active notification template
`customer_credit_note_issued`; SendGrid configuration is shared with invoice
email.

PayFast refund credentials are not environment variables. Configure the live
eight-digit merchant ID and live passphrase under **Admin → Settings → Platform
→ PayFast payments**; secrets are encrypted in PostgreSQL. PayFast's Refunds API
is not used in sandbox mode. Submitted, verification-required, and externally
completed bank-payout refunds are reconciled by GET-only checks in the document
worker, which starts with the Next.js server.

`SENDGRID_FROM_EMAIL` must be a sender identity verified in SendGrid. If either SendGrid value is missing in local development, password reset requests keep showing the dev reset link instead of sending email.

`SENDGRID_WEBHOOK_PUBLIC_KEY` is the Verification key shown by SendGrid when Signed Event Webhook is enabled. Use the endpoint `https://jurgensenergy.com/api/webhooks/sendgrid/events` in SendGrid.

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
https://jurgensenergy.com/api/auth/callback/google
https://admin.jurgensenergy.com/api/auth/callback/google
https://seller.jurgensenergy.com/api/auth/callback/google
```

Use the OAuth client ID as `AUTH_GOOGLE_ID` and the client secret as `AUTH_GOOGLE_SECRET`.

## Storage Paths

`MEDIA_ROOT` and `INVOICE_ROOT` are private paths inside the running
app/container where uploaded media and generated invoices and credit notes are
written. For Docker self-hosting, keep them as:

```env
MEDIA_ROOT=/data/media
INVOICE_ROOT=/data/invoices
```

`MEDIA_STORAGE_PATH`, `INVOICE_STORAGE_PATH`, `EXPORT_STORAGE_PATH`, and
`BACKUP_STORAGE_PATH` are host-machine paths mounted into Docker.
`INVOICE_STORAGE_PATH` is mounted at `INVOICE_ROOT`; invoices and credit notes
must be served only through authenticated or token-protected application routes
and never through Caddy's public media mount. Local development can use the
default `./storage/...` folders. Production/self-hosting should point these at a
durable folder outside the repo so app deploys do not touch generated
documents.
