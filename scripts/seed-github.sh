#!/usr/bin/env bash
# Seeds the GitHub repo with labels, milestones, and the M0-M4 issue set.
# Idempotent enough to re-run: label/milestone collisions are tolerated, but
# issues are NOT deduplicated -- run the issue phase once.
#
#   ./scripts/seed-github.sh          # everything
#   ./scripts/seed-github.sh labels   # labels only
#   ./scripts/seed-github.sh issues   # issues only

set -uo pipefail

REPO_NAME="afterword"
PHASE="${1:-all}"

gh auth status >/dev/null 2>&1 || { echo "Not authenticated. Run: gh auth login"; exit 1; }

OWNER="$(gh api user --jq .login)"
REPO="$OWNER/$REPO_NAME"

# ---------------------------------------------------------------- repo

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Creating private repo $REPO"
  gh repo create "$REPO" --private --source=. --remote=origin --push
else
  echo "Repo $REPO already exists"
fi

# ---------------------------------------------------------------- labels

label() {
  gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null 2>&1 \
    && echo "  label $1"
}

if [[ "$PHASE" == "all" || "$PHASE" == "labels" ]]; then
  echo "Labels:"
  label "type:feat"     "1d76db" "New capability"
  label "type:chore"    "7f8c8d" "Setup, tooling, maintenance"
  label "type:bug"      "d73a4a" "Something is wrong"
  label "type:docs"     "0075ca" "Documentation or content authoring"
  label "type:spike"    "bfd4f2" "Time-boxed investigation"

  label "area:engine"   "5319e7" "Pure rules and models, no IO"
  label "area:data"     "0e8a16" "Schema, migrations, persistence"
  label "area:content"  "fbca04" "Playbook and rule packs"
  label "area:import"   "d4c5f9" "Report parsing"
  label "area:agent"    "b60205" "Model layer, credentials, tools"
  label "area:ui"        "f9a03f" "Routes, views, layouts"
  label "area:infra"    "6a737d" "Build, CI, hosting"

  label "size:S"        "ededed" "Under half a day"
  label "size:M"        "d3d3d3" "About a day"
  label "size:L"        "a9a9a9" "Multiple days"

  label "constraint"    "e11d48" "Enforces a hard product constraint (C1-C5)"
  label "blocked"       "000000" "Waiting on something external"
fi

# ---------------------------------------------------------------- milestones

milestone() {
  if gh api "repos/$REPO/milestones" --jq '.[].title' 2>/dev/null | grep -qxF "$1"; then
    echo "  milestone $1 (exists)"
  else
    gh api "repos/$REPO/milestones" -f title="$1" -f description="$2" >/dev/null \
      && echo "  milestone $1"
  fi
}

if [[ "$PHASE" == "all" || "$PHASE" == "labels" ]]; then
  echo "Milestones:"
  milestone "M0 Foundation" \
    "Scaffold, tenant-keyed schema, CI, one deployable box."
  milestone "M1 Organized truth" \
    "The free core, no model required. Exit: the owner runs a real release through it end to end."
  milestone "M2 Engine" \
    "Rules, imports, models, decisions. Exit: the app correctly recommends killing a campaign with no model call."
  milestone "M3 Narration" \
    "Credentials, tools, chat, digests. Exit: turning AI off loses explanation and conversation, nothing else."
  milestone "M4 Cadence and mobile" \
    "Posting cadence, streaks, calendar export, PWA, phone layouts."
fi

# ---------------------------------------------------------------- issues

mk() {
  gh issue create --repo "$REPO" --title "$1" --milestone "$2" --label "$3" --body "$4" >/dev/null \
    && echo "  + $1"
}

if [[ "$PHASE" != "all" && "$PHASE" != "issues" ]]; then exit 0; fi

echo "Issues:"

# ===================== M0 Foundation =====================

mk "Scaffold SvelteKit 2 app with TypeScript strict and Tailwind v4" \
  "M0 Foundation" "type:chore,area:infra,size:M" \
"Stand up the application shell on Node 22.

**Acceptance**
- SvelteKit 2 with Svelte 5, TypeScript in strict mode, no implicit any
- Tailwind v4 configured
- Directory skeleton from spec section 4 created, including empty server/engine
- An ESLint rule or import-boundary test that fails if server/engine imports from server/db or from any HTTP client

That last item is the guard on invariant 1. Add it now while the tree is empty; it is much harder to retrofit once the engine has grown.

Spec: sections 3, 4"

mk "Set up PostgreSQL 18 and Drizzle with migration 001" \
  "M0 Foundation" "type:chore,area:data,size:M" \
"Database, ORM, and the tenancy convention that everything else inherits.

**Acceptance**
- Local Postgres 18 and a documented connection setup in .env.example
- Drizzle configured with a checked-in migration directory
- Migration 001 creates the authors table
- A written convention in docs: every table except channels carries author_id with a foreign key, money is stored as integer minor units plus a currency column, and metrics carry channel and marketplace
- A test or lint that flags a new table missing author_id

Spec: sections 2 (invariants 3 and 6), 5"

mk "Define author preferences schema with Zod" \
  "M0 Foundation" "type:feat,area:data,size:S" \
"Author-tunable configuration, so no threshold ever lives in code as a constant.

**Acceptance**
- Zod schema covering target_acos, min_ad_eval_days, min_ad_eval_spend_minor, currency, marketplaces, default_channels, cadence_ratio
- Stored as jsonb on authors, validated on read and write
- Sensible defaults, applied when a key is absent rather than at insert time

Defaults must resolve at read time so that changing a default later applies to existing accounts.

Spec: sections 2 (invariant 4), 5"

mk "Add single-account dev bypass for auth" \
  "M0 Foundation" "type:chore,area:infra,size:S" \
"Deliberately not real auth yet.

**Acceptance**
- A single hardcoded author resolved from an env var into the request context
- All downstream code reads the author from locals, never from a global or a constant
- One documented seam where a real session provider will slot in

The point is that adding auth later touches one file. Do not scatter author lookups.

Spec: section 3"

mk "Build base layout, navigation, and theme tokens" \
  "M0 Foundation" "type:feat,area:ui,size:M" \
"The shell every later view sits inside.

**Acceptance**
- CSS custom property token set for color, spacing, and type, defined for light and dark
- App shell with navigation that works at 400px width
- Empty states that explain what a section is for rather than showing a blank panel

Spec: section 3"

mk "Set up Vitest and GitHub Actions CI" \
  "M0 Foundation" "type:chore,area:infra,size:S" \
"Fast feedback on the parts where bugs cost an author money.

**Acceptance**
- Vitest configured, with server/engine and server/import as the primary targets
- A GitHub Actions workflow running typecheck, lint, and tests on push and PR
- No workflow step requires an Anthropic API key, so CI never spends money

Spec: sections 2 (invariant 1), 3"

mk "Provision VPS with Caddy, Postgres, and nightly backups" \
  "M0 Foundation" "type:chore,area:infra,size:M" \
"One small box, kept boring.

**Acceptance**
- Small VPS running the app behind Caddy with automatic TLS
- Postgres 18 on the same host, matching the local major version so backups restore cleanly
- Nightly pg_dump to off-box object storage, with a documented restore that has actually been tested once
- Deploy documented as a short script or a single command
- Caddy basic auth in front of the whole app. Until real auth exists, the single-account bypass from #4 means anyone who reaches the app is the owner

Avoid per-request serverless pricing and managed database tiers that jump from free to fifty dollars. Target is 10 to 25 dollars a month all in.

Spec: section 3"

mk "Enforce tenant isolation with Postgres row-level security" \
  "M0 Foundation" "type:feat,area:data,size:M" \
"Defense in depth for invariant 3. Today, isolation depends on every query filtering by author_id. With row-level security, Postgres refuses to return another author's rows even when a query forgets the filter.

Do this before #8, so the repo layer is built around it from the start. Retrofitting it onto existing queries is the expensive part.

**Acceptance**
- Two database roles: an owner role that runs migrations, and a restricted app role the app connects as. The app role is not a table owner and cannot bypass RLS. Both are documented in .env.example
- A repo-layer helper that runs a request's queries in a transaction after \`set_config('app.author_id', <id>, true)\`, taking the author from locals (#4). Nothing outside the helper opens tenant queries
- Policies declared in schema.ts with Drizzle's RLS support, restricting rows to \`author_id = current_setting('app.author_id')::uuid\`
- The tenant-key test from #2 extended so that a tenant table without RLS enabled and a policy fails
- An integration test against a real database proving two things: a query with no author_id filter returns only the current author's rows, and the app role with no author set sees nothing
- CI (#6) runs that integration test against a Postgres 18 service container
- docs/data-conventions.md updated

Spec: sections 2 (invariant 3), 5"

# ===================== M1 Organized truth =====================

mk "Migration: pen names, series, and titles" \
  "M1 Organized truth" "type:feat,area:data,size:M" \
"The work entities, with a stage machine per title.

**Acceptance**
- Tables for pen_names, series, titles per spec section 5
- stage enum: metadata, uploaded, preorder, launch, post_launch, backlist
- Multi pen name and multi series supported from the first migration, not bolted on
- \`release_date\` on titles (date, nullable): the planned or actual publication date. The launch timeline (#45) counts from it

Spec: section 5

Depends on #39: tenant tables are created with row-level security from the start."

mk "Titles CRUD with product metadata only" \
  "M1 Organized truth" "type:feat,area:ui,size:M,constraint" \
"Enforces C2: never ingest or store manuscript text.

**Acceptance**
- Create, edit, and list titles capturing genre, subgenre, tropes, heat level, page count, word count, series position
- No field anywhere accepts prose: no blurb body, no excerpt, no synopsis, no notes field large enough to invite pasting a chapter
- A test asserting the titles schema contains no free-text column beyond working_title and short enumerated values
- Copy in the UI that says plainly: we ask about your book, not for your book

Ask about the product, not the prose. This is what makes positioning help possible without a manuscript ever entering the system.

Spec: sections 1.1, 5"

mk "Migration: channels reference table and channel listings" \
  "M1 Organized truth" "type:feat,area:data,size:M" \
"The cross product where most of the real pain lives.

**Acceptance**
- channels reference table seeded with kdp, kdp_print, kobo, d2d, ingram, apple, google_play, direct
- channel_listings with independent status per title and channel, plus external_id, price_minor, currency, marketplace, enrolled_in_select, exclusivity_start, exclusivity_end, wholesale_discount_pct, returnable
- channels is the one table without author_id

Spec: section 5"

mk "Build the channel listing matrix view" \
  "M1 Organized truth" "type:feat,area:ui,size:L" \
"The centerpiece of the free core: one grid answering what is where.

**Acceptance**
- Titles down, channels across, each cell showing listing status in both color and shape so state reads at a glance without relying on color alone
- Outstanding obligations surfaced per cell
- Filters by pen name, series, and stage
- Horizontal scroll contained to the grid; the page body never scrolls sideways
- Readable at 400px, even if that means a stacked per-title view on narrow screens

This single view is most of the answer to I have lost track. Give it the most design attention of anything in M1.

Spec: section 5"

mk "Listing detail editor with enrollment and print settings" \
  "M1 Organized truth" "type:feat,area:ui,size:M" \
"Where the money-relevant per-channel settings get recorded.

**Acceptance**
- Edit status, price and currency, marketplace, external id
- KDP Select enrollment with exclusivity start and end dates
- Ingram wholesale discount percent and returnability
- Inline warnings sourced from the playbook pack, not hardcoded in the component
- Setting an exclusivity end date writes a decision row with commits_until

Spec: sections 5, 6.1"

mk "Playbook pack schema, loader, and boot validation" \
  "M1 Organized truth" "type:feat,area:content,size:M" \
"Knowledge as data. Adding a channel becomes adding a file.

**Acceptance**
- Zod schema for the pack format in spec section 6.1, including channel, pack, version, as_of, sources, and steps with fields, gotchas, and preconditions
- Loader validates every pack at boot and fails loudly on a malformed or undated pack
- as_of and sources are required, not optional
- as_of surfaces in the UI wherever a step is shown
- Packs can be title-scoped, with no channel, for the launch timeline (#45)
- A step can have an optional \`due\`, made of an anchor field (release_date for now) and \`offset_days\`, plus a \`milestone\` flag for steps worth a reminder (#46)

A pack without a date and a source is worse than no pack. Stale advice about an Ingram discount or a Select term costs an author real money.

Spec: sections 2 (invariant 2), 6.1"

mk "Author the KDP ebook playbook pack" \
  "M1 Organized truth" "type:docs,area:content,size:M" \
"First real content pack.

**Acceptance**
- Field by field walkthrough of KDP ebook setup: the seven keyword fields, category selection, pricing and territory, Select enrollment decision point, preorder timing limits
- Every step carries a source URL and the pack carries as_of
- Gotchas recorded where a wrong choice is slow or costly to reverse

Verify each claim against the live KDP help pages at authoring time. Do not write this from memory.

Spec: section 6.1"

mk "Author the IngramSpark print playbook pack" \
  "M1 Organized truth" "type:docs,area:content,size:M" \
"The pack where being wrong is most expensive.

**Acceptance**
- Walkthrough covering ISBN requirements, wholesale discount, returnability, proof approval, and distribution territory
- Explicit guidance on the discount range bookstores expect and what going below it means
- Sources and as_of as above

Spec: section 6.1"

mk "Generate tasks from playbook steps" \
  "M1 Organized truth" "type:feat,area:engine,size:M" \
"Turn packs into a per-title, per-channel checklist.

**Acceptance**
- Given a title, its channel listings, and the relevant packs, produce tasks with playbook_step_ref, label, and due_on
- Preconditions respected: a step whose precondition is unmet is not yet actionable
- Pure function in server/engine, no database access, unit tested
- Re-running does not duplicate tasks or resurrect completed ones
- For steps with a \`due\` anchor, due_on is the anchor date plus the offset. When the anchor changes, open tasks move with it, unless the author set the date by hand

Spec: sections 2 (invariant 1), 5, 6.1"

mk "Full data export as JSON and CSV" \
  "M1 Organized truth" "type:feat,area:data,size:S" \
"Release blocker. Nobody should be trapped in a side project.

**Acceptance**
- One action exports everything belonging to the author: titles, listings, decisions, observations, tasks, cadence
- JSON for completeness, CSV per table for spreadsheet use
- Linked from somewhere obvious, not buried in settings
- Round trip verified: the export contains enough to reconstruct the account

This ships in M1, not later. A free tool that holds someone's launch plan owes them the door.

Spec: section 8"

mk "Suggest channels for a new title from the author's history" \
  "M1 Organized truth" "type:feat,area:ui,size:S" \
"When an author adds a title, pre-select the channels it will get listings for, based on what they have done before. The author always confirms. Nothing is created silently.

Onboarding deliberately does not ask which channels an author uses. Many will use this app to make that decision, so asking up front would presume the answer.

**Acceptance**
- Adding a title shows a channel checklist, and confirming it creates one not_started listing per checked channel
- Pre-selection, first match wins:
  1. The author's default_channels preference, if they have set it explicitly
  2. The channels of their most recent title under the same pen name that has listings
  3. The channels of their most recent title with listings, under any pen name
  4. Nothing checked
- The UI says where the suggestion came from, for example \"Same as Book 4\" or \"Your default channels\"
- The suggestion logic is a pure function with unit tests covering each precedence step
- No onboarding step asks for channels

Depends on #9 and #10.

Spec: section 5"

mk "Launch timeline: release-relative playbook pack" \
  "M1 Organized truth" "type:feat,area:content,size:M" \
"Pre-release and launch marketing on a timeline counted from the release date: when to recruit ARC readers, reveal the cover, push newsletter signups, open preorders, and ask for reviews. It tracks the purpose and timing of each step, never the content of any post (C1, C4).

**Acceptance**
- A title-scoped launch pack in content/playbooks/launch/, not tied to a store, in the pack format from #13, with as_of and sources
- Steps dated relative to the book's release date, for example: recruit ARC readers at -90 days, cover reveal at -60, preorder live at -45, newsletter signup push at -30, ARC copies out at -21, launch day at 0, review follow-ups at +7 and +30. Research and source the real steps and offsets rather than copying this list
- Steps worth a reminder are marked as milestones (see the reminders ticket)
- Each book has a timeline view listing every step with its date, whether it's done, and how far away it is. Readable at 400px
- The author can skip a step for one book, or set its date by hand. A hand-set date stays put when the release date moves; every other step shifts with it
- A book with no release date shows its steps undated, with a prompt to set one

Depends on #8, #13, and #16.

Spec: sections 5, 6.1"

mk "Reminder lead times and a Coming up list" \
  "M1 Organized truth" "type:feat,area:engine,size:M" \
"One reminder system for everything in the app that has a date, with lead times the author chooses, such as \"remind me a week before and again three days before.\"

**Acceptance**
- A \`reminders\` preference in the #3 schema: \`lead_days\` (default [7, 3]) plus optional per-kind overrides, for example more notice for exclusivity terms than for launch milestones. Defaults resolve at read time like every other preference
- A pure engine function: given dated items from any source, the preference, and today's date, it returns the reminders due today. No database or network access. Unit tested, including a lead time that has already passed when an item is created
- A source is a small interface (kind, subject, date, label), so new sources plug in without changing the engine. The first source is milestone steps from the launch timeline (#45). Decision commitment dates (#26) and cadence (M4) plug in later
- Home shows a \"Coming up\" list built from the same function
- Settings lets the author edit lead times, with each kind described in plain words
- No email here: #27 delivers these reminders

Spec: sections 2 (invariants 1 and 4), 5"

mk "Account deletion with export offered first" \
  "M1 Organized truth" "type:feat,area:data,size:S" \
"An author who leaves can delete everything. The database side already exists: every author_id cascades on delete from authors (#2).

**Acceptance**
- A settings action that deletes the author after typed confirmation, such as retyping their email
- Offers the full data export (#17) before confirming
- A test that, after deletion, no row in any tenant table references that author
- Copy that says plainly that deleted data stays in nightly backups until they rotate out, and states the retention period from #7
- Once #29 lands, the test also asserts that the author's persisted AI key is gone

Spec: sections 2 (invariant 3), 5"

# ===================== M2 Engine =====================

mk "Rule pack schema, loader, and threshold resolution" \
  "M2 Engine" "type:feat,area:content,size:M" \
"Rules as data, with thresholds that bend to each author's configuration.

**Acceptance**
- Zod schema for the rule format in spec section 6.2
- Threshold resolution reads author preferences and falls back to the rule default
- explain templates render deterministically from rule inputs
- Loader validates at boot

The same rule must serve an author spending 5 dollars a day and one spending 80.

Spec: sections 2 (invariants 2 and 4), 6.2"

mk "Migration: campaigns and campaign reviews" \
  "M2 Engine" "type:feat,area:data,size:S" \
"Storage for ad state and for the verdicts the engine produces.

**Acceptance**
- campaigns and campaign_reviews per spec section 5
- campaign_reviews stores verdict, rule_id, and the inputs jsonb that produced it
- narration and narration_model are nullable

The nullability is the point: a review is complete without narration.

Spec: sections 1.1 (C5), 5"

mk "Migration: observations and imports" \
  "M2 Engine" "type:feat,area:data,size:S" \
"Normalized metric storage, channel agnostic.

**Acceptance**
- observations and imports per spec section 5
- metric enum covers units, kenp_pages, royalty_minor, ad_spend_minor, ad_sales_minor, impressions, clicks
- every row carries channel, marketplace, currency, and a period range
- observations link back to the import that produced them

Store currency and marketplace even while only one is in use. Never convert.

Spec: sections 2 (invariant 6), 5"

mk "Import: KDP royalty and KENP report parser" \
  "M2 Engine" "type:feat,area:import,size:L" \
"There is no KDP API. File upload is the only sanctioned path.

**Acceptance**
- Parse the KDP downloadable royalty report and the KENP read report into observations
- Handle multiple marketplaces in one file
- Idempotent: re-uploading an overlapping period does not double count
- Clear, specific errors when a file is the wrong report or an unexpected shape
- Fixture-based unit tests using anonymized real exports

Do not store the raw upload longer than parsing needs. Store the parsed observations.

Spec: sections 1.1 (C3), 5"

mk "Import: Kobo Writing Life sales report parser" \
  "M2 Engine" "type:feat,area:import,size:M" \
"Second channel, resolving spec open question 2.

**Acceptance**
- Parse the Kobo Writing Life sales export into observations
- Same idempotency and error handling contract as the KDP parser
- Fixture-based tests
- Any difference in contract between the two parsers gets reconciled into one shared interface

Two parsers is the point. One would leave the interface accidentally KDP shaped.

Spec: sections 5, 9 (question 2)"

mk "Engine: campaign review evaluation with deterministic explanations" \
  "M2 Engine" "type:feat,area:engine,size:L,constraint" \
"Enforces C5: the verdict is deterministic, the model only narrates.

**Acceptance**
- Pure function taking campaign state, observations, and author preferences, returning verdict, rule_id, inputs, and a rendered explain string
- Verdicts: too_young, keep, raise, lower, pause, kill
- too_young is a real verdict, not silence; an author needs to know a campaign is not yet judgeable
- No database, no network, no model call anywhere in this path
- Unit tests covering each verdict and the boundaries between them

The explain string must stand on its own as useful advice with AI switched off.

Spec: sections 1.1 (C5), 2 (invariant 1), 6.2"

mk "Engine: KU vs wide vs direct model" \
  "M2 Engine" "type:feat,area:engine,size:L" \
"The highest anxiety decision in indie publishing, answered with the author's own numbers.

**Acceptance**
- Pure function modeling expected outcomes under Select, wide, and direct, given the author's KENP read history, wide storefront history, price points, and ad performance
- Every assumption returned alongside the result, not buried
- Explicitly surfaces the exclusivity commitment and its end date as a cost
- Unit tested against hand-worked examples

Resolve open question 1 while building: blended KENP rate or per marketplace. Blended is acceptable for v1 if the assumption is stated.

Spec: sections 5, 9 (question 1)"

mk "KU vs wide comparison UI with stated assumptions" \
  "M2 Engine" "type:feat,area:ui,size:M" \
"Present the model without pretending to more certainty than it has.

**Acceptance**
- Side by side comparison of Select, wide, and direct for a chosen title
- Assumptions listed visibly, each editable so the author can test their own belief
- Choosing an option writes a decision row with rationale, assumptions, and commits_until
- No recommendation is shown without the arithmetic behind it being reachable in one click

Spec: sections 5, 7.2"

mk "Migration and UI: append-only decision log" \
  "M2 Engine" "type:feat,area:data,size:M" \
"The memory layer, and the thing no competitor can clone by shipping a feature.

**Acceptance**
- decisions table per spec section 5, append only
- Superseding writes a new row and sets superseded_by; nothing is ever updated in place
- Timeline view per title and across the account
- Each entry shows choice, rationale, assumptions, source, and any commitment date

Spec: sections 2 (invariant 5), 5"

mk "Email delivery for reminders" \
  "M2 Engine" "type:feat,area:infra,size:M" \
"Email beats push for \"your Select term ends in nine days.\"

**Acceptance**
- A scheduled job sends the reminders that the engine from #46 says are due, including decision commits_until dates from #26
- Resend on its free tier
- One digest per author per run, never one email per item
- A sent log, so the same reminder is never sent twice even if the job reruns
- Unsubscribe is respected, and lead times come from the author's reminder preference (#46)
- No model call involved

Spec: sections 3, 5"

# ===================== M3 Narration =====================

mk "AI credential resolution: managed, session BYOK, none" \
  "M3 Narration" "type:feat,area:agent,size:M" \
"One function, three outcomes, resolved in order.

**Acceptance**
- Managed platform key for paid accounts, author key held in server session for BYOK, or none
- Session BYOK is never persisted, so scheduled digests are correctly unavailable in that mode
- With none, narration endpoints degrade rather than error; the app stays fully usable
- Key validated against the pinned model at save time, not on first use

The persistence split is what gives the paid tier an honest differentiator instead of artificial gating.

Spec: section 7.1"

mk "Envelope-encrypted key storage for managed mode" \
  "M3 Narration" "type:feat,area:agent,size:M" \
"The one genuinely uncomfortable obligation in the whole app.

**Acceptance**
- Envelope encryption with the master key from the environment, never committed
- Only key_last4 is ever readable or logged
- Keys scrubbed from error traces and never included in any log line or telemetry
- A test asserting a key value cannot appear in a serialized error

Spec: section 7.1"

mk "Agent tool layer with enforced allowlist test" \
  "M3 Narration" "type:feat,area:agent,size:L,constraint" \
"Enforces C1 and C2 structurally rather than by intention.

**Acceptance**
- Tools per spec section 7.2: list_titles, get_listing_matrix, get_playbook_step, run_ku_wide_model, list_campaign_reviews, get_decision_log, get_cadence_status, propose_decision
- Tool schemas derive from the shared Zod schemas rather than being hand written twice
- propose_decision returns a draft for confirmation and never commits
- A test asserting the exported tool surface matches an allowlist exactly, so a new tool cannot be added silently
- No tool accepts or returns prose, and none generates copy

The allowlist test is the enforcement mechanism for the product's identity. Do not skip it.

Spec: sections 1.1, 7.2"

mk "Streaming chat over the author's own data" \
  "M3 Narration" "type:feat,area:agent,size:L" \
"The conversational surface, holding no state of its own.

**Acceptance**
- Streaming responses, pinned claude-opus-5, adaptive thinking, effort medium
- Prompt ordered system, then playbook slice, then volatile author state, so the stable prefix caches
- cache_read_input_tokens logged and verified non-zero across repeated turns
- The model performs no arithmetic and holds no state; every number comes from a tool
- Graceful, explanatory failure when no credential is available

Spec: sections 7.2, 7.3"

mk "Layer model narration onto existing campaign verdicts" \
  "M3 Narration" "type:feat,area:agent,size:M,constraint" \
"Enforces C5 at the presentation layer.

**Acceptance**
- Narration writes to campaign_reviews.narration alongside the existing verdict and inputs
- Verdicts are never produced or altered by the model
- With AI off, the deterministic explain template renders in the same slot
- A test asserting a review renders completely with narration null

Switching AI off should lose prose and lose the conversation. It should not lose a single verdict.

Spec: sections 1.1 (C5), 5, 7"

mk "Weekly digest via the Batch API" \
  "M3 Narration" "type:feat,area:agent,size:M" \
"Nobody is waiting on this, so it should cost half.

**Acceptance**
- Scheduled weekly pass over campaigns and listings for managed-mode accounts
- Batch API rather than synchronous requests
- Digest assembled from engine verdicts, with narration added where a credential exists
- Skipped for session BYOK accounts, since no key is at rest, and this is explained in the UI rather than failing silently

Spec: sections 7.1, 7.3"

# ===================== M4 Cadence and mobile =====================

mk "Migration: cadence slots and log" \
  "M4 Cadence and mobile" "type:feat,area:data,size:S" \
"Storage for the posting rhythm and whether it actually happened.

**Acceptance**
- cadence_slots and cadence_log per spec section 5
- post_type is author-definable, not a fixed enum, so it fits any brand
- Resolve open question 3 here: recurrence rules or generated dates

Phone editing is a real constraint on that choice.

Spec: sections 5, 9 (question 3)"

mk "Cadence planner UI with streak tracking" \
  "M4 Cadence and mobile" "type:feat,area:ui,size:L" \
"Consistency tracking, never content generation.

**Acceptance**
- Author sets slots per platform with their own post type ratio
- Week and month views showing what is due
- One tap to log a slot as done, and a visible streak
- The app never suggests what to write, only when and what kind
- Missing a slot is recorded neutrally, not scolded

Spec: sections 1.1 (C1, C4), 5"

mk "Export cadence as .ics and CSV" \
  "M4 Cadence and mobile" "type:feat,area:ui,size:S,constraint" \
"Enforces C4: the author posts, not the app.

**Acceptance**
- .ics feed for calendar subscription
- CSV shaped for import into an existing scheduler
- No write integration with any social platform, and no stored social credentials

Spec: section 1.1 (C4)"

mk "PWA manifest and service worker" \
  "M4 Cadence and mobile" "type:feat,area:infra,size:M" \
"Installable, and usable on a phone with a bad connection.

**Acceptance**
- Web app manifest with icons, installable on iOS and Android
- SvelteKit service worker caching the shell and the read surfaces
- Checklist ticks queued and synced when a connection returns
- No push notifications in this milestone; reminders stay on email

Spec: section 3"

mk "Phone layouts for read, tick, and remind" \
  "M4 Cadence and mobile" "type:feat,area:ui,size:M" \
"Mobile does the thin surface well rather than everything badly.

**Acceptance**
- Checklists, cadence logging, and the weekly digest are fully usable at 400px
- The listing matrix degrades to a per-title stacked view rather than a sideways scroll
- Report upload and bulk metadata entry are plainly desk tasks, and say so rather than offering a cramped form
- Tap targets at least 44px, no horizontal page scroll anywhere

Spec: section 3"

echo
echo "Done. Next: gh issue list --repo $REPO --limit 50"
