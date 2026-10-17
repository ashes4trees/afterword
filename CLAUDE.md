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
- SvelteKit's cross-site form check only runs in production builds, not in `npm run dev`. adapter-node needs `ORIGIN` set for it.
- The repo is public. Never put the owner's real book titles, pen names, series, email, or local paths in code, fixtures, commits, issues, or PRs. Use made-up names.
- The local database holds the owner's own test data. Manual checks against it may only touch rows the check itself created, targeted by exact id. Never act on "the first row", and never delete by a broad filter.
- To test writes over HTTP without touching the owner's data, run a second dev server as a throwaway author: `DEV_AUTHOR_EMAIL=probe-<n>@example.test npx vite dev --port 5198`. Then delete that author, which cascades to everything it created.
- In shell chains, never put a check (`grep -c`, `test`) ahead of real work with `&&`. A check that "fails" silently skips everything after it (that's how #87's docs went missing).
- When testing by hand with curl, run the script under `bash`. The default shell is zsh, which doesn't split an unquoted `$VAR` holding several flags.

## Workflow

- Work is tracked as GitHub issues in `ashes4trees/afterword`, grouped by milestone (M0 Foundation, M1 Organized truth, M2 Engine, M3 Narration, M4 Cadence and mobile). Work in milestone order.
  - `gh issue list --milestone "M0 Foundation"`
  - `gh issue view <n>`
- Each issue has an **Acceptance** list. Treat it as the definition of done.
- Labels: `type:*`, `area:*`, `size:S|M|L`, `constraint`, `blocked`. [scripts/seed-github.sh](scripts/seed-github.sh) created them. Don't re-run the issue phase, because it doesn't deduplicate.
- Branching: one short-lived branch and PR per issue (`<type>/<issue>-<slug>`). Merge (squash) once CI passes. CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs typecheck, lint, migrations against a Postgres 18 service container, tests with coverage, and the build.
- `main` is protected on GitHub (since 2026-10-17): the `check` CI job must pass and the branch must be up to date before merging, admins included. Force pushes and deletion are blocked. Secret scanning with push protection and Dependabot security updates are on; Dependabot PRs go through the same CI.
- Merge only on a passing CI exit code: `gh pr checks --watch` then `gh pr merge` only if it exited 0. Never pipe the watch into `tail` or `grep`, which hides a failure (that's how #74 merged on red). Run `npm run lint` and read its exit code before pushing.
- Reference the issue in commits and PRs (`Closes #n`).
- UI-only fixes and changes go on the running checklist in #48, never in their own tickets. #48 is **parked**: add items to it, but don't work on it until the owner says they're ready to make design decisions.
- `npm run db:migrate` can fail silently: no "applied successfully" line and no error. When that happens, run the SQL in a rolled-back transaction to see the real error: `(echo begin; sed 's/--> statement-breakpoint//g' <file>; echo rollback) | psql -v ON_ERROR_STOP=1 afterword`. Index expressions must be immutable, so don't cast enums to text in an index.
- Renaming a column: drizzle-kit asks interactively whether it's a rename, which blocks here. Split it into two migrations, one adding (with any data copy appended to the generated SQL) and one dropping, as in 0004 and 0005.
- When an open question in spec §9 gets resolved, strike it through there and record the date, as was done for Q2.

## Content

- Playbook packs: see spec §6.1 and [src/lib/server/content/schema.ts](src/lib/server/content/schema.ts). Each pack needs `as_of` (not in the future) and at least one source. Folder and file name must match `channel` (or `title`) and `pack`. Steps can carry `due` (relative to `release_date`), `milestone`, `formats`, `fields`, `gotchas`, and `preconditions` (other step ids or `PLAYBOOK_FACTS`). Bump `version` when a pack's advice changes.

## Brand voice

Applies to playbook advice and all UI copy (hints, empty states, errors).

- Talk like a knowledgeable friend: second person, suggestions rather than definitions. "Consider offering a reader magnet…", not "A reader magnet is…".
- Give the advice, never its pedigree. No "guides suggest", "sources say", or "older guides say" in anything an author reads. Sources live in the pack's `sources` and in YAML comments.
- The author decides. Advice is optional, and skipping is fine; never scold.
- Warnings are plain and name the consequence: "Miss it and KDP cancels the preorder."
- Tools can be suggested with a step's `links` (at most 3, https only), shown as "Popular options". Check each URL resolves before shipping.
- Short and concrete. Give numbers as rules of thumb ("about five weeks out"), not ranges with caveats.

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

- 2026-10-17: Links into Settings can carry `?return=<path>`, and Save redirects back there. `safeReturnPath()` in `src/lib/shared/returnTo.ts` accepts only in-app paths.
- 2026-10-17: Reminders (#46). The pure engine is in [src/lib/server/engine/reminders.ts](src/lib/server/engine/reminders.ts): the tightest open lead-time window wins, so there are no stale reminders, and overdue items show in Coming up but are never "due" for delivery. Reminder kinds are registered in `src/lib/shared/reminders.ts` (only `key_date` so far), and sources map rows to `DatedItem` in `services/reminders.ts`. Home's Coming up syncs every book's tasks first. Settings → Reminders edits `reminders.lead_days` and per-kind overrides.
- 2026-10-17: The repo went public. History was rewritten with `git filter-repo --replace-text` to remove the owner's real pen name and titles from an old test fixture, so commit SHAs from PR #42 onward changed. Old SHAs in earlier PR pages and in this log point at pre-rewrite commits. Merged commits from that range lost GitHub's "Verified" badge.
- 2026-10-17: Brand voice adopted (see Brand voice above). The launch timeline was rewritten to version 2 in that voice. The timeline footer shows only "Advice last reviewed <as_of>"; sources stay in the pack file.
- 2026-10-17: Launch timeline (#45) is `content/playbooks/title/launch-timeline.yaml`, a **draft** researched from public guides and KDP's help pages. The owner is doing independent research, and the two will be merged before it counts. Each book has Details and Launch timeline tabs; the timeline page syncs tasks on load, so pack changes show up. Steps can be done, skipped, or given a pinned date ("Back to the schedule" unpins). `BookTabs` compares `page.route.id`, because `resolve()` can return relative paths during server rendering.
- 2026-10-17: Task generation (#16) is pure, in [src/lib/server/engine/tasks.ts](src/lib/server/engine/tasks.ts): `plannedTasks` turns packs into tasks, `syncTasks` diffs them against stored tasks, and `blockedBy` works out preconditions when tasks are read, never storing them. `syncTitleTasks()` in `services/tasks.ts` runs inside the same transaction whenever a book or listing changes. Open tasks follow the release date unless `due_pinned`. Done and skipped tasks are history.
- 2026-10-17: Playbooks (#13) are YAML in `content/playbooks/<channel>/` or `content/playbooks/title/` (per-book packs such as the launch timeline). They're bundled at build time with `import.meta.glob` and validated when `src/lib/server/content/playbooks.ts` loads. `hooks.server.ts` imports it so a bad pack stops the server, and a test fails CI the same way. The schema is in `content/schema.ts`. Playbooks are always deterministic, hand-written data. AI may explain them later (M3), but never writes or changes them.
- 2026-10-17: Listings are per format (#72): book × store × format × marketplace. Formats are ebook, paperback, hardcover, and audiobook (`BOOK_FORMATS` in `src/lib/shared/channels.ts`). Store capabilities list the formats each store sells, and `sellsFormat()` gates editing. KDP Print merged into Amazon KDP (migration 0008, which also gave existing books ebook + paperback). Books record their formats, and matrix rows are those formats plus any format that still has listings. Full editions are #71, deliberately later.
- 2026-10-17: Added Barnes & Noble Press, Audible (ACX), Spotify (Findaway Voices), and Kickstarter as shared stores (migration 0007). New stores are added by the maintainer to `CHANNELS` plus a seed migration. Author-defined custom stores are deferred until needed. Payhip and Shopify stay under "Direct sales".
- 2026-10-17: Listing matrix (#11) at `/listings`. Status shapes, colors, and labels live in `STATUS_META` in [src/lib/shared/listings.ts](src/lib/shared/listings.ts), along with column choice. Every store shows unless the author hides it in the Stores menu, saved as the `hidden_channels` preference. Hiding is explicit and per author, never inferred from which stores have listings, because inferring it blocked listing a book on a new store. "Only show stores in use" (`?stores=used`) is an opt-in view in the same menu. It isn't saved, and it follows the listings as they change. Cells open a quick-edit dialog with JavaScript, or link to `/listings/[titleId]/[channel]/[format]` without it. That page is where #12's editor grows. The matrix edits only the default (no marketplace) listing; marketplace listings show as "+N markets". Shared form actions are in `src/lib/server/listingActions.ts`.
- 2026-10-17: List pages filter with the shared `FilterBar` component (#64), using pure matching in [src/lib/shared/bookFilter.ts](src/lib/shared/bookFilter.ts). It filters loaded rows in the browser, keeps all state in the URL, and preserves other params via `withQuery()`. #11 reuses it. App-wide search is #63, deliberately after M2.
- 2026-10-17: Forms that edit data call `guardUnsavedChanges()` ([src/lib/components/unsavedChanges.ts](src/lib/components/unsavedChanges.ts)). It compares the form to a snapshot taken on mount, asks before links and Back, and lets the browser prompt on unload. It skips `goto`, which in this app only follows a form submission. The listing editor (#12) should use it too.
- 2026-10-17: The books list groups by series (standalones last) and sorts by series order, release date, or date added. The view lives in the URL (`?sort=release&group=none`). The logic is pure, in [src/lib/shared/bookList.ts](src/lib/shared/bookList.ts). "Add book to this series" links to `/books/new?series=…`, which prefills the next whole position.
- Headless Chrome screenshots: wrap the call in `perl -e 'alarm 25; exec @ARGV'` so it can't hang. Windows narrower than about 500px are silently widened, so phone layouts need a real browser.
- 2026-10-17: Tropes stay a per-book array. The form uses a chip input with suggestions from the author's other books (`listTropes` in the works repo), reusing the existing spelling so case variants don't split. Text typed but not yet added as a chip is submitted as `tropesDraft` and merged on the server. Series positions are whole numbers or halves only.
- 2026-09-27: Listings (#10) are one row per title, channel, and marketplace. A null marketplace is the channel default, unique with `NULLS NOT DISTINCT`. `returnable` stays a boolean as in the spec, even though IngramSpark offers "deliver" or "destroy" for returns; revisit when #12 builds the Ingram settings. Channel capabilities (`formats`, `exclusivity`, `wholesaleDiscount`, `returns`, `aggregator`) live in `src/lib/shared/channels.ts`.
- 2026-09-27: Heat level is romance-only, so it's replaced by optional content intensity ratings (sex, violence, language, each 0–5, labelled in `CONTENT_RATINGS` in `src/lib/shared/titles.ts`) for every genre (#53). Existing heat levels were copied into the sex rating. Genre-aware fields from a content pack are deferred until positioning needs a controlled genre list.
- 2026-09-27: Books UI (#9). Pen names and series are entered by name, with suggestions from existing ones, and found or created on save. There's no separate screen to manage them yet. Tropes are comma-separated. Services take the database handle as their first argument so they can be tested against a real database; routes pass `db` from `db/client.ts`.
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
- Manual test checklists live in [docs/manual-tests.md](docs/manual-tests.md). Add a section whenever a screen is ready to test by hand.
- M0 is done except #7 (VPS). M1 in progress. #1 (scaffold) #2 (Postgres and Drizzle), #3 (preferences), #4 (dev auth bypass), #6 (CI), #39 (RLS), #5 (layout), #8 (works schema), #9 (books), #10 (channels and listings), #53 (content intensity), #64 (filter bar), #11 (listing matrix), #72 (per-format listings), #13 (playbook loader), #16 (task generation), #45 (launch timeline, draft content), and #46 (reminders) are done. #7 needs the owner's hosting account. Next, by the owner's choice: #84 (promo ideas library), then #12 (listing editor). After that, #12.
