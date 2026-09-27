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
- Declare a tenant table's key with `authorId()` from `schema.ts`. `schema.test.ts` fails if a table is missing it.
- Money is stored as integer minor units plus a currency code, and is never converted. Metrics carry channel and marketplace.
- Thresholds live in author preferences or rule packs, never as constants in code. Preference defaults are resolved at read time.
- Decisions are append-only: supersede them, don't mutate them.
- Routes are thin and call `services/` only.
- The author comes from `event.locals`, never from a global. The auth seam lives in one file.
- CI must never need an Anthropic API key.

## Workflow

- Work is tracked as GitHub issues in `ashes4trees/afterword`, grouped by milestone (M0 Foundation, M1 Organized truth, M2 Engine, M3 Narration, M4 Cadence and mobile). Work in milestone order.
  - `gh issue list --milestone "M0 Foundation"`
  - `gh issue view <n>`
- Each issue has an **Acceptance** list. Treat it as the definition of done.
- Labels: `type:*`, `area:*`, `size:S|M|L`, `constraint`, `blocked`. [scripts/seed-github.sh](scripts/seed-github.sh) created them. Don't re-run the issue phase, because it doesn't deduplicate.
- Branching: commit directly to `main` until CI exists (#6). After that, use one short-lived branch and PR per issue, so CI gates main.
- Reference the issue in commits and PRs (`Closes #n`).
- When an open question in spec §9 gets resolved, strike it through there and record the date, as was done for Q2.

## Commands

- `npm run dev`: dev server
- `npm run check`: svelte-check (TypeScript strict)
- `npm run lint`: Prettier check, then ESLint. The engine purity rule lives in [eslint.config.js](eslint.config.js).
- `npm run format`: Prettier write. Markdown is excluded on purpose (see `.prettierignore`).
- `npm run build`: production build via adapter-node
- `npm test`: Vitest, run once
- `npm run db:generate -- --name <change>`, then `npm run db:migrate`: schema changes. Drizzle migrations live in `src/lib/server/db/migrations`. Rules are in [docs/data-conventions.md](docs/data-conventions.md).

## Local environment

- Node 22 via nvm (`v22.23.3`); npm (pnpm isn't installed).
- PostgreSQL 18.6 via Postgres.app on port 5432, database `afterword`. Client binaries are in `/Applications/Postgres.app/Contents/Versions/18/bin`. The old 14 server is stopped.
- Docker isn't installed.

## Decisions log

Record decisions that aren't in the spec here, newest first, with a date.

- 2026-09-27: Tenant isolation will also be enforced with Postgres row-level security (#39), built before the first tenant tables (#8) so the repo layer is designed around it. Account deletion is tracked in #40.
- 2026-09-27: Primary keys are `uuid` with a default of `uuidv7()`. `author_id` cascades on delete, so account deletion is a single `delete from authors`. Emails are unique case-insensitively. Vitest was added in #2 for the tenant-key test; #6 still owns the test configuration and CI.
- 2026-09-27: PostgreSQL 18 instead of 16, for the longer support window (to Nov 2030) and native `uuidv7()`. The production server must run the same major version so `pg_dump` backups restore cleanly.
- 2026-09-27: adapter-node for the single-VPS deploy (#7). Markdown is excluded from Prettier so hand-written docs keep their formatting.
- 2026-09-27: Second import channel for M2 is Kobo Writing Life (spec §9 Q2).

## Status

- M0 in progress. #1 (scaffold) and #2 (Postgres and Drizzle, migration 0000 applied locally) are done.
