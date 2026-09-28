# Data conventions

Rules every table and migration follows. They come from spec §2 (invariants 3, 5,
and 6) and §5. If you break one, you'll have to retrofit it later across live data.

## Tenant key

Every table except `authors` and `channels` has an `author_id` column. It is non-null
and has a foreign key to `authors.id` with `on delete cascade`. Use the `authorId()`
helper in `src/lib/server/db/schema.ts` rather than declaring the column by hand.

`src/lib/server/db/schema.test.ts` fails if a table is missing the column or its
foreign key. To exempt another global reference table, add it to `EXEMPT` in that
test. Treat that as a design decision and record it in CLAUDE.md.

Cascade means deleting an author removes all of their data, which is how account
deletion will work.

## References between tenant tables

Postgres checks foreign keys without row-level security, so a plain `pen_name_id`
reference could point at another author's pen name. References between tenant tables
therefore include `author_id` on both sides: `(author_id, pen_name_id)` references
`pen_names(author_id, id)`, and every referenced table has `unique (author_id, id)`.
The schema test fails any reference that skips `author_id`.

A composite key is skipped entirely when any of its columns is null. So never fold an
optional column into a reference that must always be checked. Give each optional
reference its own foreign key.

## Row-level security

Every tenant table also carries the `tenant_isolation` policy. Add it with
`(t) => [tenantPolicy()]` in the table's extra config. The same schema test fails if
it's missing.

- The app connects as a restricted role (`DATABASE_URL`) that isn't a superuser,
  doesn't own the tables, and can't bypass RLS. Migrations and `npm run db:setup` run
  as the owner (`DATABASE_OWNER_URL`). Never point the app at the owner.
- Run tenant queries only inside `withAuthor(db, authorId, (tx) => ...)` from
  `src/lib/server/db/tenant.ts`, and pass `tx` to repo functions. Outside it, tenant
  tables return nothing, and writes fail.
- Keep writing `where author_id = ...` in queries anyway. RLS is the backstop, not
  the filter.
- `authors` is exempt. Sign-in has to find an author before any author is known.
- `src/lib/server/db/tenant.integration.test.ts` proves the pattern against a real
  database.

## Reference tables

Global reference data, such as `channels`, has no `author_id`. It's seeded by
migration from a constant in `src/lib/shared/` and gets a select-only RLS policy, so the
app role can read it but never write it, whatever that role is called. An integration
test checks that the seeded rows match the constant. Changing the constant means adding
a new migration.

## Money

- Store money as integer **minor units** (cents, pence) in a column named `*_minor`.
  Never use floats, and never use `numeric` for amounts.
- Every money column sits next to an explicit `currency` column holding an ISO 4217 code. A schema test enforces both the integer type and the neighbouring `currency` column.
- Never convert between currencies. Store the currency you received and display it as is.

## Metrics

Every metric row carries `channel_slug` and `marketplace`, even while an author
only uses one of each. Adding those dimensions later means guessing at historical rows.

## Identifiers and time

- Primary keys are `uuid` with a default of `uuidv7()`, which is native in PostgreSQL 18.
  These IDs sort by creation time.
- Timestamps are `timestamp with time zone`. Calendar dates, such as report periods and
  `commits_until`, are `date`.

## Decisions are append-only

Never update or delete rows in `decisions`. Write a new row and point the old row's
`superseded_by` at it. Current state is derived from the log.

## Migrations

- Edit `schema.ts`, then run `npm run db:generate -- --name <what_changed>`. Review the
  generated SQL and commit it.
- Apply with `npm run db:migrate`.
- Never edit a migration that has already been applied anywhere. Write a new one.
