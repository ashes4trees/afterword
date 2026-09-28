# Afterword

Operations assistant for self-published authors: publishing across channels,
positioning, ads, cadence. Solo side project by @ashes4trees. The source of truth
for design is [docs/tech-spec.md](docs/tech-spec.md). Read the relevant section
before starting a ticket; don't duplicate it here.

## Hard constraints (violating one is a bug)

- **C1** Never generate prose, ad copy, blurbs, or artwork.
- **C2** Never ingest or store manuscript text. No free-text field big enough to paste a chapter into.
- **C3** Never store platform credentials. Import is file upload only.
- **C4** Never post to social platforms. Export only (`.ics`, CSV).
- **C5** Every AI output traces to a deterministic engine verdict. The model narrates and never decides.

Issues labeled `constraint` enforce one of these and must ship with a test that fails loudly if the constraint drifts.

## Invariants to keep in mind while coding

- `src/lib/server/engine/` is pure: no imports from `db/`, `agent/`, or any HTTP client. This is guarded by a lint or boundary test.
- Every table except `channels` has `author_id` with a foreign key.
- Repo functions take an `Executor` (a database handle or a transaction, from `db/types.ts`) as their first argument and never import `db/client.ts`, so #39 can pass in a request-scoped transaction.
- Tests that need a database are named `*.integration.test.ts`. They use `connect()` and `databaseUrl` from [src/lib/server/testing/db.ts](src/lib/server/testing/db.ts) and clean up their own rows. Locally they skip when `DATABASE_URL` is unset; in CI a missing URL is an error.
- Declare a tenant table with `authorId()` and `(t) => [tenantPolicy()]` from `schema.ts`. `schema.test.ts` fails if either is missing. Query tenant tables only inside `withAuthor()` ([src/lib/server/db/tenant.ts](src/lib/server/db/tenant.ts)).
- Money is stored as integer minor units plus a currency code, and is never converted. Metrics carry channel and marketplace.
- Thresholds live in author preferences or rule packs, never as constants in code. Preference defaults are resolved at read time.
- Decisions are append-only: supersede them, don't mutate them.
- Routes are thin and call `services/` only.
- The author comes from `event.locals.author`, never from a global. The only auth seam is `authenticate()` in [src/lib/server/auth.ts](src/lib/server/auth.ts). Use `requireAuthor(locals)` in loads and actions.
- CI must never need an Anthropic API key.

## Workflow

- Work is tracked as GitHub issues in `ashes4trees/afterword`, grouped by milestone (M0 Foundation, M1 Organized truth, M2 Engine, M3 Narration, M4 Cadence and mobile). Work in milestone order.
  - `gh issue list --milestone "M0 Foundation"`
  - `gh issue view <n>`
- Each issue has an **Acceptance** list. Treat it as the definition of done.
- Labels: `type:*`, `area:*`, `size:S|M|L`, `constraint`, `blocked`. [scripts/seed-github.sh](scripts/seed-github.sh) created them. Don't re-run the issue phase, because it doesn't deduplicate.
- Branching: one short-lived branch and PR per issue (`<type>/<issue>-<slug>`). Merge (squash) once CI passes. CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs typecheck, lint, migrations against a Postgres 18 service container, tests with coverage, and the build.
- Reference the issue in commits and PRs (`Closes #n`).
- UI-only fixes and changes go on the running checklist in #48, never in their own tickets. #48 is **parked**: add items to it, but don't work on it until the owner says they're ready to make design decisions.
- When an open question in spec §9 gets resolved, strike it through there and record the date, as was done for Q2.

## Commands

- `npm run dev`: dev server
- `npm run check`: svelte-check (TypeScript strict)
- `npm run lint`: Prettier check, then ESLint. The engine purity rule lives in [eslint.config.js](eslint.config.js).
- `npm run format`: Prettier write. Markdown is excluded on purpose (see `.prettierignore`).
- `npm run build`: production build via adapter-node
- `npm test`: Vitest, run once. `npm run test:coverage` reports coverage for `engine/` and `import/` only.
- `npm run db:setup`: creates the restricted `afterword_app` role and its grants. Run it once per database, before migrating. It's idempotent.
- `npm run db:generate -- --name <change>`, then `npm run db:migrate`: schema changes. Drizzle migrations live in `src/lib/server/db/migrations`. Rules are in [docs/data-conventions.md](docs/data-conventions.md).

## Local environment

- Node 22 via nvm (`v22.23.3`); npm (pnpm isn't installed).
- PostgreSQL 18.6 via Postgres.app on port 5432, database `afterword`. Your Mac user is the owner and a superuser (`DATABASE_OWNER_URL`); the app connects as `afterword_app` (`DATABASE_URL`). Client binaries are in `/Applications/Postgres.app/Contents/Versions/18/bin`. The old 14 server is stopped.
- Docker isn't installed.

## Decisions log

Record decisions that aren't in the spec here, newest first, with a date.

- 2026-09-27: Pen names are optional labels on books and series (#8). The account's display name is whatever the author logs in as, and onboarding never asks about pen names. Keeping a book's pen name consistent with its series' is validated in the service layer (#9), not the database.
- 2026-09-27: The works schema (#8) uses bounded `varchar` for every text field (a C2 backstop), decimal series positions such as 2.5, `heat_level` as 0–5 or null, and at most 20 tropes. A pen name or series with books can't be deleted until the books are moved.
- 2026-09-27: Launch marketing is a release-relative, title-scoped playbook (#45). Reminders are one engine for every dated item, with author-chosen lead times (default 7 and 3 days before) and per-kind overrides (#46), both in M1 because a real release needs them. #27 is now email delivery for those reminders. Books gained `release_date` (#8).
- 2026-09-27: UI shell (#5). Tokens live in [src/lib/styles/tokens.css](src/lib/styles/tokens.css) as a Tailwind v4 `@theme` (`bg-surface`, `text-fg-muted`, `px-gutter`, `font-display`, `text-title`). Dark mode follows the OS only; there's no manual toggle yet. The UI says "Books" where the schema says `titles`. Navigation lives in [src/lib/nav.ts](src/lib/nav.ts), and links go through `resolve()` because the Svelte lint rule requires it. Every section page is a `PageHeader` plus an `EmptyState` that explains what the section is for.
- 2026-09-27: Row-level security (#39): the app role and its grants come from `scripts/db-setup.ts`, not a migration, because roles belong to the whole server. `authors` is exempt from RLS. The policy predicate uses `nullif(..., '')` because a transaction-local setting reads as `''` after the transaction ends.
- 2026-09-27: The dev bypass (#4) finds or creates the author named by `DEV_AUTHOR_EMAIL` on each request. It isn't disabled in production, so #7 must put Caddy basic auth in front of the app until real auth exists. Unused arguments prefixed with `_` are allowed by lint.
- 2026-09-27: Onboarding never asks which channels an author uses, because many will use the app to decide that. Channels for a new title are suggested instead: an explicit `default_channels`, then the latest title under the same pen name, then the latest title overall, then nothing. The author always confirms (#41).
- 2026-09-27: Preferences (#3) are stored sparse and resolved per key at read time, in [src/lib/shared/preferences.ts](src/lib/shared/preferences.ts). Marketplaces are ISO 3166-1 country codes, not Amazon domains. `default_channels` defaults to empty. `target_acos` may go above 1, for authors who accept losses for KU read-through. **Provisional:** `cadence_ratio` is read as the promotional share of posts (default 0.2). The spec never defines it, so revisit at M4.
- 2026-09-27: Tenant isolation will also be enforced with Postgres row-level security (#39), built before the first tenant tables (#8) so the repo layer is designed around it. Account deletion is tracked in #40.
- 2026-09-27: Primary keys are `uuid` with a default of `uuidv7()`. `author_id` cascades on delete, so account deletion is a single `delete from authors`. Emails are unique case-insensitively. Vitest was added in #2 for the tenant-key test; #6 still owns the test configuration and CI.
- 2026-09-27: PostgreSQL 18 instead of 16, for the longer support window (to Nov 2030) and native `uuidv7()`. The production server must run the same major version so `pg_dump` backups restore cleanly.
- 2026-09-27: adapter-node for the single-VPS deploy (#7). Markdown is excluded from Prettier so hand-written docs keep their formatting.
- 2026-09-27: Second import channel for M2 is Kobo Writing Life (spec §9 Q2).

## Status

- M0 in progress. #1 (scaffold) #2 (Postgres and Drizzle), #3 (preferences), #4 (dev auth bypass), #6 (CI), #39 (RLS), #5 (layout), and #8 (works schema) are done. M0 has only #7 (VPS) left, and it needs the owner's hosting account. Next: #9, then #10.
