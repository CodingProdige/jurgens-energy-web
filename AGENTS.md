<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Engineering Principles

Before making code changes, read and follow `docs/engineering-principles.md`.

Environment configuration is documented in `docs/environment.md`. Keep only one root `.env` file; do not add additional `.env.example`, `.env.local`, `.env.production`, or similar root env files unless explicitly requested.

Brand rules are documented in `docs/brand.md`. Use the Piessang palette and prefer shadcn/ui components before creating custom UI.

The short version:

- Keep the project a modular monolith.
- Keep pages thin; put business logic in `src/modules/*`.
- Default to Server Components; use Client Components only for real interactivity.
- Validate inputs with Zod at boundaries.
- Authorize on the server for every protected read and mutation.
- Treat PostgreSQL as source of truth.
- Use caching intentionally: public data can be cached/revalidated, user-specific/admin data must stay dynamic.
- Do not add abstractions until repetition or complexity proves they are useful.
