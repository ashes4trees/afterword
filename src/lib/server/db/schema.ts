import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	foreignKey,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgPolicy,
	pgTable,
	smallint,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
	varchar
} from 'drizzle-orm/pg-core';

// Conventions for every table in this file: docs/data-conventions.md.
// schema.test.ts enforces the tenant key and row-level security policy.

export const aiMode = pgEnum('ai_mode', ['off', 'byok', 'managed']);

export const authors = pgTable(
	'authors',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		email: text('email').notNull(),
		displayName: text('display_name').notNull(),
		aiMode: aiMode('ai_mode').notNull().default('off'),
		// Shape is owned by the Zod schema in #3. Stored sparse: defaults resolve at read time.
		preferences: jsonb('preferences').notNull().default({}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('authors_email_lower_idx').on(sql`lower(${t.email})`)]
);

/** Tenant key. Every table except `authors` and `channels` must include this column. */
export const authorId = () =>
	uuid('author_id')
		.notNull()
		.references(() => authors.id, { onDelete: 'cascade' });

/**
 * Row-level security predicate: a row is visible only to the author set by
 * withAuthor() (db/tenant.ts). With no author set, nothing is visible. The nullif
 * matters: after a transaction-local set_config ends, the setting reads as '' rather
 * than NULL, and ''::uuid would error.
 */
export const TENANT_PREDICATE_SQL =
	"author_id = nullif(current_setting('app.author_id', true), '')::uuid";

/**
 * Tenant isolation. Every table that uses authorId() must also include this in its
 * extra config: `(t) => [tenantPolicy()]`. Declaring a policy makes drizzle-kit enable RLS.
 */
export const tenantPolicy = () =>
	pgPolicy('tenant_isolation', {
		as: 'permissive',
		for: 'all',
		using: sql.raw(TENANT_PREDICATE_SQL),
		withCheck: sql.raw(TENANT_PREDICATE_SQL)
	});

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
};

// ---------------------------------------------------------------- works (#8)
//
// References between tenant tables include author_id (a composite foreign key), because
// foreign key checks ignore row-level security: without it, a book could point at
// another author's pen name. Each referenced table exposes unique (author_id, id).
//
// Pen names are optional labels. The account's display name is what an author logs in
// as, and onboarding never asks about pen names.
//
// Text columns are bounded varchar on purpose (C2): no field here is big enough to
// paste prose into.

export const penNames = pgTable(
	'pen_names',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		authorId: authorId(),
		name: varchar('name', { length: 120 }).notNull(),
		...timestamps
	},
	(t) => [
		tenantPolicy(),
		unique('pen_names_author_id_id_key').on(t.authorId, t.id),
		uniqueIndex('pen_names_author_name_idx').on(t.authorId, sql`lower(${t.name})`)
	]
);

export const series = pgTable(
	'series',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		authorId: authorId(),
		/** Optional, like every pen name reference. */
		penNameId: uuid('pen_name_id'),
		title: varchar('title', { length: 200 }).notNull(),
		plannedCount: smallint('planned_count'),
		...timestamps
	},
	(t) => [
		tenantPolicy(),
		foreignKey({
			name: 'series_pen_name_fk',
			columns: [t.authorId, t.penNameId],
			foreignColumns: [penNames.authorId, penNames.id]
		}),
		unique('series_author_id_id_key').on(t.authorId, t.id),
		uniqueIndex('series_author_title_idx').on(t.authorId, sql`lower(${t.title})`),
		check('series_planned_count_positive', sql`${t.plannedCount} > 0`)
	]
);

/** Mirrors BOOK_FORMATS in $lib/shared/channels (#72). */
export const bookFormat = pgEnum('book_format', ['ebook', 'paperback', 'hardcover', 'audiobook']);

export const titleStage = pgEnum('title_stage', [
	'metadata',
	'uploaded',
	'preorder',
	'launch',
	'post_launch',
	'backlist'
]);

export const titles = pgTable(
	'titles',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		authorId: authorId(),
		/** Optional: pen names are labels for authors who use them, never required. */
		penNameId: uuid('pen_name_id'),
		seriesId: uuid('series_id'),
		/** Decimal so novellas can sit between books, e.g. 2.5. */
		seriesPosition: numeric('series_position', { precision: 5, scale: 2, mode: 'number' }),
		workingTitle: varchar('working_title', { length: 200 }).notNull(),
		genre: varchar('genre', { length: 60 }),
		subgenre: varchar('subgenre', { length: 60 }),
		tropes: varchar('tropes', { length: 60 })
			.array()
			.notNull()
			.default(sql`'{}'`),
		/** Content intensity, each 0 (none) to 5 (explicit), or null when not rated (#53). */
		contentSex: smallint('content_sex'),
		contentViolence: smallint('content_violence'),
		contentLanguage: smallint('content_language'),
		pageCount: integer('page_count'),
		wordCount: integer('word_count'),
		/** Formats this book is published in; each gets its own row in the listing matrix (#72). */
		formats: bookFormat('formats')
			.array()
			.notNull()
			.default(sql`'{ebook}'`),
		/** Planned or actual publication date; the launch timeline counts from it (#45). */
		releaseDate: date('release_date'),
		stage: titleStage('stage').notNull().default('metadata'),
		...timestamps
	},
	(t) => [
		tenantPolicy(),
		unique('titles_author_id_id_key').on(t.authorId, t.id),
		foreignKey({
			name: 'titles_pen_name_fk',
			columns: [t.authorId, t.penNameId],
			foreignColumns: [penNames.authorId, penNames.id]
		}),
		// Kept separate from the pen name reference: a composite key is skipped when any
		// column is null, so bundling the optional pen name in would stop checking the
		// series. Keeping a book's pen name consistent with its series' is the service
		// layer's job (#9).
		foreignKey({
			name: 'titles_series_fk',
			columns: [t.authorId, t.seriesId],
			foreignColumns: [series.authorId, series.id]
		}),
		check(
			'titles_series_position_needs_series',
			sql`${t.seriesPosition} is null or ${t.seriesId} is not null`
		),
		check('titles_series_position_positive', sql`${t.seriesPosition} > 0`),
		// Whole numbers or halves only: book 2, novella 2.5.
		check(
			'titles_series_position_halves',
			sql`${t.seriesPosition} * 2 = trunc(${t.seriesPosition} * 2)`
		),
		check('titles_content_sex_range', sql`${t.contentSex} between 0 and 5`),
		check('titles_content_violence_range', sql`${t.contentViolence} between 0 and 5`),
		check('titles_content_language_range', sql`${t.contentLanguage} between 0 and 5`),
		check('titles_page_count_positive', sql`${t.pageCount} > 0`),
		check('titles_word_count_positive', sql`${t.wordCount} > 0`),
		check('titles_tropes_max', sql`cardinality(${t.tropes}) <= 20`),
		check('titles_formats_present', sql`cardinality(${t.formats}) >= 1`)
	]
);

// ---------------------------------------------------------------- channels (#10)

/**
 * Global reference data: the stores and distributors. The one table without author_id.
 * Rows come from migrations. Row-level security lets any role read them, and gives
 * no write policy, so the app can never change them. The owner bypasses RLS to seed.
 * Keep in step with CHANNEL_SLUGS in $lib/shared/channels.
 */
export const channels = pgTable(
	'channels',
	{
		slug: varchar('slug', { length: 40 }).primaryKey(),
		displayName: varchar('display_name', { length: 80 }).notNull(),
		/** Shape: ChannelCapabilities in $lib/shared/channels. */
		capabilities: jsonb('capabilities').notNull().default({})
	},
	() => [pgPolicy('channels_read', { as: 'permissive', for: 'select', using: sql`true` })]
);

export const listingStatus = pgEnum('listing_status', [
	'not_started',
	'metadata_draft',
	'submitted',
	'in_review',
	'live',
	'unpublished'
]);

/**
 * One book in one format on one channel, optionally in one marketplace. Each has its own status and
 * obligations: book 3 can be in preorder on KDP, live on Kobo, and unsubmitted to Ingram.
 * A null marketplace is the listing's default; uniqueness treats it as a value, so a
 * book can't get two default listings on the same channel.
 */
export const channelListings = pgTable(
	'channel_listings',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		authorId: authorId(),
		titleId: uuid('title_id').notNull(),
		channelSlug: varchar('channel_slug', { length: 40 })
			.notNull()
			.references(() => channels.slug),
		format: bookFormat('format').notNull(),
		/** ISO 3166-1 alpha-2, matching the marketplaces preference. */
		marketplace: varchar('marketplace', { length: 2 }),
		status: listingStatus('status').notNull().default('not_started'),
		/** ASIN, ISBN, or the channel's own id. */
		externalId: varchar('external_id', { length: 64 }),
		priceMinor: integer('price_minor'),
		currency: varchar('currency', { length: 3 }),
		enrolledInSelect: boolean('enrolled_in_select').notNull().default(false),
		exclusivityStart: date('exclusivity_start'),
		exclusivityEnd: date('exclusivity_end'),
		wholesaleDiscountPct: smallint('wholesale_discount_pct'),
		returnable: boolean('returnable'),
		...timestamps
	},
	(t) => [
		tenantPolicy(),
		// Deleting a book removes its listings.
		foreignKey({
			name: 'channel_listings_title_fk',
			columns: [t.authorId, t.titleId],
			foreignColumns: [titles.authorId, titles.id]
		}).onDelete('cascade'),
		unique('channel_listings_title_channel_format_marketplace_key')
			.on(t.titleId, t.channelSlug, t.format, t.marketplace)
			.nullsNotDistinct(),
		check('channel_listings_marketplace_code', sql`${t.marketplace} ~ '^[A-Z]{2}$'`),
		check('channel_listings_currency_code', sql`${t.currency} ~ '^[A-Z]{3}$'`),
		check(
			'channel_listings_price_has_currency',
			sql`(${t.priceMinor} is null) = (${t.currency} is null)`
		),
		check('channel_listings_price_nonnegative', sql`${t.priceMinor} >= 0`),
		check('channel_listings_exclusivity_order', sql`${t.exclusivityEnd} >= ${t.exclusivityStart}`),
		check(
			'channel_listings_wholesale_discount_range',
			sql`${t.wholesaleDiscountPct} between 0 and 100`
		)
	]
);

// ---------------------------------------------------------------- tasks (#16)

/** playbook: generated from a timeline. idea: picked from an ideas pack (#84). author: their own. */
export const taskSource = pgEnum('task_source', ['playbook', 'author', 'idea']);

/**
 * A checklist item for a book. Playbook tasks come from task generation and are unique
 * per book, pack, step, channel, and format; author tasks are free-form. Done and skipped
 * tasks are history and are never regenerated.
 */
export const tasks = pgTable(
	'tasks',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		authorId: authorId(),
		titleId: uuid('title_id').notNull(),
		source: taskSource('source').notNull(),
		/** "title/launch-timeline", "kdp/kdp-setup"; null for author tasks. */
		pack: varchar('pack', { length: 80 }),
		packVersion: integer('pack_version'),
		stepId: varchar('step_id', { length: 60 }),
		channelSlug: varchar('channel_slug', { length: 40 }).references(() => channels.slug),
		format: bookFormat('format'),
		label: varchar('label', { length: 120 }).notNull(),
		dueOn: date('due_on'),
		/** The author set due_on by hand, so it no longer follows the release date. */
		duePinned: boolean('due_pinned').notNull().default(false),
		doneAt: timestamp('done_at', { withTimezone: true }),
		skippedAt: timestamp('skipped_at', { withTimezone: true }),
		/** Skipped because it was a key date already past when the book was added. */
		passedOnAdd: boolean('passed_on_add').notNull().default(false),
		...timestamps
	},
	(t) => [
		tenantPolicy(),
		foreignKey({
			name: 'tasks_title_fk',
			columns: [t.authorId, t.titleId],
			foreignColumns: [titles.authorId, titles.id]
		}).onDelete('cascade'),
		// One task per step: per book for title packs, per listing (channel and format) for
		// channel packs. Two partial indexes rather than one over coalesce(), because a cast
		// of an enum to text isn't immutable and can't appear in an index.
		uniqueIndex('tasks_title_step_idx')
			.on(t.titleId, t.pack, t.stepId)
			.where(sql`${t.source} = 'playbook' and ${t.channelSlug} is null`),
		uniqueIndex('tasks_listing_step_idx')
			.on(t.titleId, t.pack, t.stepId, t.channelSlug, t.format)
			.where(sql`${t.source} = 'playbook' and ${t.channelSlug} is not null`),
		check('tasks_listing_has_format', sql`(${t.channelSlug} is null) = (${t.format} is null)`),
		check(
			'tasks_playbook_has_step',
			sql`${t.source} = 'author' or (${t.pack} is not null and ${t.stepId} is not null and ${t.packVersion} is not null)`
		),
		check('tasks_done_or_skipped', sql`${t.doneAt} is null or ${t.skippedAt} is null`)
	]
);

/** Ideas an author marked "Not for this book" (#84), so the library stays relevant. */
export const ideaDismissals = pgTable(
	'idea_dismissals',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		authorId: authorId(),
		titleId: uuid('title_id').notNull(),
		pack: varchar('pack', { length: 80 }).notNull(),
		stepId: varchar('step_id', { length: 60 }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		tenantPolicy(),
		foreignKey({
			name: 'idea_dismissals_title_fk',
			columns: [t.authorId, t.titleId],
			foreignColumns: [titles.authorId, titles.id]
		}).onDelete('cascade'),
		unique('idea_dismissals_title_step_key').on(t.titleId, t.pack, t.stepId)
	]
);

export const ideaPhase = pgEnum('idea_phase', ['writing', 'prelaunch', 'launch', 'after']);

/**
 * The author's own promo ideas (#91), private to them and reusable on any book. Added to
 * a timeline like a shared idea: tasks with source 'idea', pack 'mine', and this row's id
 * as the step. Short, bounded text only (C2): a label and a note, never post content.
 */
export const authorIdeas = pgTable(
	'author_ideas',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		authorId: authorId(),
		label: varchar('label', { length: 120 }).notNull(),
		note: varchar('note', { length: 280 }),
		phase: ideaPhase('phase').notNull(),
		/** When it works best, in days relative to release. Both set, or neither. */
		windowFromDays: smallint('window_from_days'),
		windowToDays: smallint('window_to_days'),
		repeatable: boolean('repeatable').notNull().default(false),
		/**
		 * When the author offered it to other authors, or null. The maintainer reviews shared
		 * ideas (`npm run ideas:shared`) before any reaches the shared ideas pack.
		 */
		sharedAt: timestamp('shared_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [
		tenantPolicy(),
		unique('author_ideas_author_id_id_key').on(t.authorId, t.id),
		check(
			'author_ideas_window_complete',
			sql`(${t.windowFromDays} is null) = (${t.windowToDays} is null)`
		),
		check(
			'author_ideas_window_order',
			sql`${t.windowFromDays} is null or (${t.windowFromDays} <= ${t.windowToDays} and ${t.windowFromDays} >= -730 and ${t.windowToDays} <= 730)`
		)
	]
);

// ---------------------------------------------------------------- decisions (#12, #26)

export const decisionKind = pgEnum('decision_kind', [
	'enrollment',
	'pricing',
	'distribution',
	'promo',
	'ads'
]);
export const decisionSource = pgEnum('decision_source', ['author', 'engine', 'agent']);

/**
 * Append-only (spec §2, invariant 5): a decision is never edited. A new decision about the
 * same subject is a new row, and the old row's superseded_by points at it. That pointer is
 * the only change a trigger allows (migration 0011). commits_until drives reminders such as
 * a KDP Select term about to renew.
 */
export const decisions = pgTable(
	'decisions',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		authorId: authorId(),
		subjectType: varchar('subject_type', { length: 40 }).notNull(),
		subjectId: uuid('subject_id').notNull(),
		kind: decisionKind('kind').notNull(),
		/** Short, plain statement of what was decided, such as "Enrolled in KDP Select". */
		choice: varchar('choice', { length: 200 }).notNull(),
		rationale: varchar('rationale', { length: 500 }),
		assumptions: jsonb('assumptions').notNull().default({}),
		commitsUntil: date('commits_until'),
		source: decisionSource('source').notNull(),
		decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
		supersededBy: uuid('superseded_by')
	},
	(t) => [
		tenantPolicy(),
		unique('decisions_author_id_id_key').on(t.authorId, t.id),
		foreignKey({
			name: 'decisions_superseded_by_fk',
			columns: [t.authorId, t.supersededBy],
			foreignColumns: [t.authorId, t.id]
		})
	]
);
