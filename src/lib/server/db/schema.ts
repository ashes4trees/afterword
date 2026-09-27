import { sql } from 'drizzle-orm';
import { jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// Conventions for every table in this file: docs/data-conventions.md.
// schema.test.ts enforces the tenant key.

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
