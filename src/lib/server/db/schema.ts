import { sql } from 'drizzle-orm';
import {
	jsonb,
	pgEnum,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
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
