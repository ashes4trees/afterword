# Afterword — Technical Specification

> Working name; trivially renameable. An operations assistant for self-published
> authors covering everything that happens *after* the book is finished.

**Status:** draft · **Owner:** @ashes4trees · **Last updated:** 2026-09-27

---

## 1. What this is

A tool that organizes, compares, and tracks the publishing and marketing lifecycle
for indie authors across multiple books and multiple sales channels. It answers
*"what do I do next for this book, and what should I stop doing?"* — the layer that
existing tools (research, royalty dashboards, ad bidders) leave to spreadsheets and
free PDF checklists.

Built as a side project. Success is: useful to its author, useful to a few hundred
others, and covered by a Ko-fi link. Not a startup.

### 1.1 Hard constraints

These are product identity, not preferences. Violating one is a bug.

| # | Constraint | Enforcement |
|---|---|---|
| C1 | Never generates prose, ad copy, blurbs, or artwork | No generation endpoint or tool exists |
| C2 | Never ingests or stores manuscript text | No field accepts it; test asserts the tool surface |
| C3 | Never stores platform credentials (KDP, Kobo, etc.) | Import is file upload only |
| C4 | Never posts to social platforms on the author's behalf | Export-only integration (`.ics`, CSV) |
| C5 | Every AI-assisted output traces to a deterministic input | Verdicts from the rules engine; model narrates |

C5 is the one that makes AI genuinely optional, keeps the rules testable without
spending money per test run, and means the app degrades rather than breaks.

### 1.2 Non-goals

Credential-based KDP scraping · rebuilding a royalty dashboard · social publishing ·
a native mobile app · push notifications (v1) · currency conversion (store, never
convert) · billing infrastructure · a plugin SDK.

---

## 2. Architectural invariants

Cheap to honour now, expensive to retrofit. Each exists so the app can eventually
serve authors who are not its author.

1. **Rules first, model second.** A pure `engine/` module computes verdicts and
   models. The LLM explains them and handles ambiguity. Nothing in `engine/` imports
   a database client or an HTTP client.
2. **Knowledge as data.** Platform playbooks and decision rules live as versioned,
   dated content files the engine reads — never as prose inside prompt strings.
   Adding a channel is adding a file.
3. **Tenant key from migration 001.** Every row carries `author_id`. Not auth — just
   the column and the foreign key.
4. **Config, not constants.** Target ACOS, evaluation windows, currency, marketplaces,
   cadence rules, platform mix all live in author preferences. The owner's own account
   is simply the first config.
5. **Append-only decisions.** State derives from an event log. Supersede, never mutate.
6. **Store dimensions before you need them.** Money as integer minor units plus an
   explicit currency; every metric carries channel and marketplace.
7. **AI is a capability, not a code path.** One implementation, with a presentation
   layer that checks whether narration is available.

---

## 3. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | SvelteKit 2 (Svelte 5), TypeScript `strict` | One language end to end, single deployable, small bundles for phones |
| Database | PostgreSQL 18, same major version locally and in production | jsonb for preferences and rule inputs, real date handling, native `uuidv7()`, supported to Nov 2030 |
| Data access | Drizzle ORM | SQL-first, legible migrations, light for a solo maintainer |
| Validation | Zod | One schema serves form validation, API boundary, and agent tool schemas |
| Styling | Tailwind v4 | Zero-config, fast solo iteration |
| Tests | Vitest for `engine/` and parsers; Playwright later for two critical flows | The pure core is where bugs cost money |
| Model access | `@anthropic-ai/sdk`, pinned `claude-opus-5`, adaptive thinking, effort `medium` | Judgment calls only; see §7 |
| Email | Resend (free tier) | Reminders. Email beats push for "your Select term ends in 9 days" |
| Mobile | Responsive + PWA (SvelteKit service worker + manifest) | Mobile need is read / tick / remind, not data entry |
| Hosting | One small VPS (Hetzner or Fly), Caddy for TLS, Postgres on the same box, nightly `pg_dump` to object storage | ~$10–25/mo total at a few hundred users |
| Auth | Deferred. Single-account dev bypass first; a maintained library (better-auth or `@auth/sveltekit`) behind one hook when opening up | Don't build auth for one user |

**Prerequisite:** Node 22 LTS. The machine currently runs v17 (EOL).

---

## 4. Module layout

```
src/lib/
  server/
    db/          schema.ts · migrations/ · client.ts
    repo/        data access, one module per aggregate
    services/    domain operations; the only layer routes call
    engine/      PURE. rules evaluation, KU-vs-wide model, cadence math
    content/     playbook + rule pack loader and validator
    import/      one parser per channel report format
    agent/       tool definitions, credential resolution, narration
  shared/        zod schemas and types shared with the client
routes/          SvelteKit routes; thin, no business logic
content/
  playbooks/     <channel>/<pack>.yaml  — dated, sourced, versioned
  rules/         *.yaml — thresholds referencing author config keys
```

`engine/` has no dependency on `db/`, `agent/`, or the network. That single rule is
what makes the AI optional and the rules testable offline.

---

## 5. Data model

Money is always integer minor units plus a currency code. Metrics always carry
channel and marketplace. `author_id` on everything except `channels`.

### Identity and works

- **`authors`** — `id`, `email`, `display_name`, `ai_mode` (`off` | `byok` | `managed`),
  `preferences` jsonb (Zod-validated: `target_acos`, `min_ad_eval_days`,
  `min_ad_eval_spend_minor`, `currency`, `marketplaces[]`, `default_channels[]`,
  `cadence_ratio`, `reminders` — lead days, with optional per-kind overrides), `created_at`
- **`pen_names`** — `id`, `author_id`, `name`
- **`series`** — `id`, `author_id`, `pen_name_id?`, `title`, `planned_count`
- **`titles`** — `id`, `author_id`, `pen_name_id?`, `series_id?`, `series_position`,
  `working_title`, `genre`, `subgenre`, `tropes[]`, `heat_level`, `page_count`,
  `word_count`, `release_date` (planned or actual; the launch timeline counts from it),
  `stage` (`metadata` | `uploaded` | `preorder` | `launch` |
  `post_launch` | `backlist`)

  Product metadata only. Per **C2**, no field holds manuscript text.

  Pen names are optional labels for authors who publish under several names. The
  account's `display_name` is simply what the author logs in as, whether that's their
  real name or a pen name. Onboarding never asks about pen names.

### The cross product that solves "I lost track"

- **`channels`** — global reference: `slug` (`kdp`, `kdp_print`, `kobo`, `d2d`,
  `ingram`, `apple`, `google_play`, `direct`), `display_name`, `capabilities` jsonb
- **`channel_listings`** — `id`, `author_id`, `title_id`, `channel_slug`, `marketplace`,
  `status` (`not_started` | `metadata_draft` | `submitted` | `in_review` | `live` |
  `unpublished`), `external_id`, `price_minor`, `currency`, `enrolled_in_select`,
  `exclusivity_start`, `exclusivity_end`, `wholesale_discount_pct`, `returnable`,
  `updated_at`

  One title × many channels, each with independent state and obligations. Book 3 can
  be in preorder on KDP, live on Kobo, and unsubmitted to Ingram. Nearly all the
  "I've lost track" pain lives in this table.

  One row per title, channel, and marketplace. A null marketplace is the listing's
  default for that channel, and at most one default exists per title and channel.
  Deleting a title deletes its listings. `channels` is seeded by migration from
  `src/lib/shared/channels.ts`; the app role can read it but has no write policy.

### Decisions and evidence

- **`decisions`** — append-only. `id`, `author_id`, `subject_type`, `subject_id`,
  `kind` (`enrollment` | `pricing` | `distribution` | `promo` | `ads`), `choice`,
  `rationale`, `assumptions` jsonb, `commits_until` date, `source`
  (`author` | `engine` | `agent`), `decided_at`, `superseded_by`

  `commits_until` is what drives the reminder that a 90-day exclusivity term is about
  to auto-renew.

- **`observations`** — normalized metrics. `id`, `author_id`, `title_id?`,
  `channel_slug`, `marketplace`, `currency`, `metric` (`units` | `kenp_pages` |
  `royalty_minor` | `ad_spend_minor` | `ad_sales_minor` | `impressions` | `clicks`),
  `value`, `period_start`, `period_end`, `import_id`
- **`imports`** — `id`, `author_id`, `channel_slug`, `kind`, `filename`, `row_count`,
  `status`, `error`, `parsed_at`

### Advertising

- **`campaigns`** — `id`, `author_id`, `title_id`, `external_id?`, `name`,
  `campaign_type`, `targeting_kind`, `status`, `daily_budget_minor`, `started_at`,
  `ended_at`
- **`campaign_reviews`** — `id`, `author_id`, `campaign_id`, `evaluated_at`,
  `verdict` (`too_young` | `keep` | `raise` | `lower` | `pause` | `kill`), `rule_id`,
  `inputs` jsonb, `narration?`, `narration_model?`

  The traceability table for **C5**: the verdict and its inputs come from the engine
  and are complete on their own. `narration` is nullable enrichment.

### Cadence and tasks

- **`cadence_slots`** — `id`, `author_id`, `platform`, `weekday`, `time_local`,
  `post_type`, `active`
- **`cadence_log`** — `id`, `author_id`, `slot_id?`, `date`, `platform`, `post_type`,
  `done`, `noted_at`
- **`tasks`** — `id`, `author_id`, `title_id?`, `channel_slug?`, `playbook_step_ref`,
  `label`, `due_on`, `done_at`, `source`

### AI

- **`ai_credentials`** — `id`, `author_id`, `mode`, `encrypted_key`, `key_last4`,
  `created_at`. Rows exist only for persisted keys (see §7.1).
- **`sessions`** — auth sessions, once auth exists.

---

## 6. Content packs

Both are files in the repo, validated by Zod at boot. Moving them to the database is a
later step, only when non-maintainers need to edit them.

### 6.1 Playbook packs — `content/playbooks/<channel>/<pack>.yaml`

```yaml
channel: ingram
pack: print-setup
version: 3
as_of: 2026-09-14
sources:
  - https://www.ingramspark.com/...
steps:
  - id: wholesale-discount
    label: Set wholesale discount
    detail: >
      Bookstores generally expect 53–55%. Below 40% makes the title
      effectively unstockable; higher cuts your margin per copy.
    fields: [wholesale_discount_pct]
    gotchas:
      - Changing this after listing propagates slowly to retailers.
    preconditions: [isbn_assigned]
```

Every pack carries `as_of` and `sources`. Stale advice about an Ingram discount or a
Select term costs an author real money, and "it's free" is not a defence. Surface the
date in the UI on every step.

Packs can also be **title-scoped**, with no channel. The launch timeline
(`content/playbooks/launch/`) is one: ARC recruitment, cover reveal, newsletter push,
review follow-ups. Its steps are dated relative to the book's release date, and the
milestones among them feed reminders:

```yaml
  - id: cover-reveal
    label: Cover reveal
    due: { anchor: release_date, offset_days: -60 }
    milestone: true
```

It tracks the purpose and timing of each step, never the content of a post (**C1**, **C4**).

### 6.2 Rule packs — `content/rules/*.yaml`

```yaml
id: ad.kill.underperforming
applies_to: campaign
requires: [ad_spend_minor, ad_sales_minor, days_live]
thresholds:
  min_days: { config: min_ad_eval_days, default: 30 }
  min_spend_minor: { config: min_ad_eval_spend_minor, default: 5000 }
  acos_ceiling: { config: target_acos, default: 0.70 }
verdict: kill
explain: >
  Live {days_live} days, {spend} spent, {sales} attributed,
  ACOS {acos} against your {acos_ceiling} target.
```

Thresholds reference author config with a default, so the same rule serves an author
running $5/day and one running $80/day. `explain` is a deterministic template — it is
the *fallback* narration when AI is off, not a prompt.

---

## 7. The AI layer

Thin by design. The model has no state and does no arithmetic; it calls tools that do.

### 7.1 Credential resolution

One function, resolved in order:

1. **Managed** — platform key, for accounts on the paid tier. Persisted encrypted
   (envelope encryption, master key from env, never logged, scrubbed from error
   traces). Scheduled digests work.
2. **BYOK** — the author's own key, held in the server session only, never persisted.
   Interactive chat works; scheduled digests do not, because there is no key at rest.
3. **None** — narration unavailable. The app works; it is quieter.

That split gives the paid tier an honest differentiator and confines long-lived
credential custody to a small cohort where the security work is proportionate.

### 7.2 Tools

Read-mostly. Writes require explicit author confirmation in the UI.

`list_titles` · `get_listing_matrix` · `get_playbook_step` · `run_ku_wide_model` ·
`list_campaign_reviews` · `get_decision_log` · `get_cadence_status` ·
`propose_decision` (returns a draft for confirmation; never commits)

No tool accepts or returns manuscript text, and none generates copy. A test asserts
the exported tool surface against an allowlist, so **C1** and **C2** fail loudly rather
than drifting.

### 7.3 Request shape

Pinned `claude-opus-5`, `thinking: { type: "adaptive" }`, `output_config.effort:
"medium"`, streaming. Order the prompt **system → playbook slice → volatile author
state** so the stable prefix caches; verify with `cache_read_input_tokens` rather than
assuming. Scheduled digests go through the Batch API at half price.

Expected cost on the managed tier: ~$3/active author/month with routing. Not a concern
at BYOK, where it is the author's own spend.

---

## 8. Milestones

### M0 — Foundation
Repo, Node 22, SvelteKit scaffold, Postgres, Drizzle with a tenant-keyed migration 001,
Zod-validated author preferences, single-account dev bypass, deploy to one box.

### M1 — Organized truth (no model required)
Titles, series, pen names. The channel listing matrix. Playbook pack loader plus two
real packs (KDP, Ingram). Task generation from playbook steps. A release-relative launch
timeline pack. Reminder lead times (one engine for every dated item) with a Coming up
list. Full data export.
**Exit criterion:** the owner runs a real release through it end to end.

### M2 — Engine
Rule pack loader. KU-vs-wide-vs-direct model. Report import for KDP and Kobo Writing Life. Campaign review verdicts with deterministic `explain` narration. Decision log
with `commits_until` dates. Email delivery for reminders, as a daily digest.
**Exit criterion:** the app recommends killing a campaign, correctly, with no model call.

### M3 — Narration
Credential resolution, BYOK session keys, tool layer, chat over own data, model
narration layered onto existing verdicts, weekly digest via Batch.
**Exit criterion:** turning AI off loses explanation and conversation, nothing else.

### M4 — Cadence and mobile
Cadence slots, streak logging, `.ics` and CSV export, PWA manifest and service worker,
phone layouts for read/tick/remind.

### Later, deliberately
Amazon Ads API read integration (apply early, ship without) · ScribeCount and
Publishwide import · managed-key tier and Ko-fi link · public repo and contributed
playbooks.

---

## 9. Open questions

1. Does the KU-vs-wide model need per-marketplace KENP rates, or is a single blended
   rate honest enough for v1?
2. ~~Which second channel for import in M2 — Kobo Writing Life or Draft2Digital?~~
   **Resolved 2026-09-27: Kobo Writing Life.** It is the most common first step going
   wide, so it is the parser most authors will need first. Draft2Digital aggregates more
   channels per file and is the natural third.
3. Cadence slots as recurrence rules or explicit generated dates? Rules are tidier;
   dates are far easier to edit on a phone.
4. Playbooks in the repo indefinitely, or database-backed at M4 so authors can submit
   corrections without a pull request?
