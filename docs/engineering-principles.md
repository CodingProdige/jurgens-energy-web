# Engineering Principles

These rules guide how this marketplace should be built and maintained. They exist to keep the project simple, secure, cache-friendly, and easy to self-host.

## Core Principles

### KISS

Keep the simplest design that can survive the next few requirements.

- One Next.js app.
- One PostgreSQL database.
- One Redis service.
- One Caddy reverse proxy.
- Modular monolith, not microservices.
- Boring, explicit code over clever framework tricks.
- No new abstraction until it removes real complexity.

### DRY, Carefully

Avoid duplication, but do not abstract too early.

Rule of thumb:

```text
Repeat once.
Repeat twice if the shape is still unclear.
Abstract on the third repetition when the pattern is obvious.
```

Avoid both copy/paste sprawl and premature “god helpers”.

## Code Organization

Routes and pages live in `app/*`.

Business logic lives in `src/modules/*`.

Database code lives in `src/db/*`.

Cache clients and cache helpers live in `src/cache/*`.

Pages should be thin. They can compose UI, call module services, and handle route-level rendering. They should not contain core marketplace rules.

Use shadcn/ui components first for common interface primitives. If a shadcn component fits, prefer it over custom markup. Create custom components when the UI is domain-specific, when a shadcn primitive does not fit, or when a shared dashboard abstraction keeps admin and seller surfaces coupled.

Admin and seller dashboards should share the same visual system. Keep their layouts, navigation treatment, cards, theme selector, and interaction patterns coupled unless there is a specific product reason to diverge.

Follow `docs/brand.md` for Piessang colors and brand asset locations. Prefer brand semantic tokens over ad hoc colors.

Preferred flow:

```text
app/(admin)/admin/sellers/page.tsx
-> src/modules/admin/sellers/service.ts
-> src/db/schema/*
```

## App Router Rules

Read the local Next.js docs before using unfamiliar APIs:

```text
node_modules/next/dist/docs/
```

This project uses Next.js 16, where some APIs and names may differ from older Next.js versions.

## SEO And Metadata

Every page should define intentional metadata before it ships. Public marketplace pages need useful titles and descriptions for search and sharing. Protected admin, seller, auth, and account pages need useful tab titles, but should set `robots: { index: false, follow: false }`.

Use the root title template from `app/layout.tsx` and page-level metadata:

```ts
export const metadata = {
  title: "Products",
  description: "Browse products on Piessang.",
};
```

Do not leave new pages inheriting only the root title unless that is the deliberate title for that route.

## Server Components vs Client Components

Default to Server Components.

Use Server Components for:

- public SEO pages
- product, category, and seller pages
- admin pages that mostly display data
- database reads
- permission checks

Use Client Components only for:

- local interactive state
- live form behavior
- modals, dropdowns, tabs, and menus
- charts and rich dashboards
- browser-only APIs
- drag/drop, editors, and similar UI

Rule:

```text
If it does not need useState, useEffect, event handlers, or browser APIs, keep it server-side.
```

## Mutations

Use Server Actions for normal form mutations.

Use Route Handlers for:

- webhooks
- upload endpoints
- external callbacks
- non-form API endpoints
- third-party integrations

Every mutation must:

- authenticate on the server
- authorize on the server
- validate input with Zod
- use transactions for multi-step writes
- write audit logs for admin/seller-sensitive actions
- revalidate affected cached data where applicable

## Permissions

Never trust client roles.

Client UI may hide controls, but server code decides access.

Protected reads and writes should call explicit helpers such as:

```ts
requireRole(["admin"])
requireAuthenticatedUser()
requireSellerAccess(sellerId)
```

## Validation

Use Zod at system boundaries:

- form input
- Server Action input
- Route Handler request bodies
- query params
- upload metadata
- webhook payloads

Internal module functions can accept typed values after validation has happened at the boundary.

## Caching Strategy

PostgreSQL is the source of truth.

Redis is not source of truth. Use Redis for:

- rate limiting
- short-lived computed data
- expensive repeated aggregates
- future job queues

Caddy serves local uploaded media from disk at:

```text
/media/*
```

Media should use long-lived cache headers so Cloudflare can cache it globally. File paths or names should change when file contents change.

Database rows must store portable relative media paths only, never absolute host paths or environment-specific URLs.

Good:

```text
products/2026/05/01k2abc123def456.webp
brand/logo-primary.webp
```

Bad:

```text
/Users/name/project/storage/media/products/image.webp
http://localhost:3000/media/products/image.webp
```

Do not use user-provided filenames as stored media keys. Generate collision-resistant filenames on upload, grouped by domain and date, and keep the original filename as metadata only when the product needs it. Prefer stable, content-safe extensions derived from validated MIME type.

### Next.js Caching Rules

Public, non-user-specific data:

```text
cacheable
tagged where useful
revalidated when related data changes
```

Examples:

- homepage sections
- category pages
- seller public pages
- product pages

User-specific or sensitive data:

```text
dynamic
no public cache
```

Examples:

- cart
- checkout
- account pages
- admin dashboard
- seller dashboard

Mutation rule:

```text
Every mutation that changes public data must revalidate affected paths or tags.
```

## Database Rules

Schema is modular:

```text
src/db/schema/
  users.ts
  sellers.ts
  products.ts
  orders.ts
  index.ts
```

Rules:

- Review migrations before running them on important data.
- Do not run destructive migrations without a backup.
- Do not casually run seed scripts against production.
- Add indexes when query patterns prove they are needed.
- Use transactions for multi-table workflows.

## Local vs Self-Hosted Data

Local development and self-hosted stacks must remain separate.

Current Compose project names:

```text
local dev: piessang_dev
self-host: piessang_selfhost
```

Do not point local development commands at production data.

Before launch, production must have:

- strong secrets
- backups
- restore testing
- migration checklist
- restricted database and Redis exposure

## Security

Security is layered:

- Cloudflare for DNS, WAF, DDoS, bot filtering, and tunnel access.
- Caddy for reverse proxying, media serving, headers, and request controls.
- Next.js for server-side auth, authorization, validation, and audit logging.
- Redis for rate limiting.
- CrowdSec or Fail2ban later for server-level IP blocking.

PostgreSQL and Redis must not be publicly exposed in production.

## Naming

Prefer explicit names:

```text
createSeller
approveSeller
listAdminSellers
getProductPageData
requireSellerAccess
```

Avoid vague names:

```text
manager
processor
utils
helpers
```

A `utils.ts` file is acceptable only for truly generic functions. Domain behavior belongs in its module.

## Testing and Verification

Minimum checks before finishing changes:

```bash
npm run lint
npm run build
```

As complexity grows, add:

- module tests for permissions, pricing, and commissions
- integration tests for order creation and checkout
- Playwright tests for critical user flows
- backup/restore checks before launch

## Feature Checklist

Before adding or changing a feature, ask:

```text
Can this stay in one module?
Can this stay server-side?
Does this need client JavaScript?
Does this mutation validate input?
Does this mutation authorize on the server?
Does this need cache, no-store, or revalidation?
Does this affect audit logs?
Does this need a migration?
Does this need a test?
```
