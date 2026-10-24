import { eq, sql } from 'drizzle-orm';
import { authors } from '$lib/server/db/schema';
import type { Executor } from '$lib/server/db/types';
import {
	PreferencesPatchSchema,
	resolvePreferences,
	type PreferenceKey,
	type Preferences
} from '$lib/shared/preferences';

export type SessionAuthor = { id: string; email: string; displayName: string };

/** Idempotent: email matching is case-insensitive, and an existing author is never modified. */
export async function findOrCreateAuthorByEmail(
	db: Executor,
	email: string,
	displayName: string
): Promise<SessionAuthor> {
	await db.insert(authors).values({ email, displayName }).onConflictDoNothing();
	const [row] = await db
		.select({ id: authors.id, email: authors.email, displayName: authors.displayName })
		.from(authors)
		.where(sql`lower(${authors.email}) = lower(${email})`);
	if (!row) throw new Error(`author ${email} could not be created`);
	return row;
}

function resolved(authorId: string, stored: unknown): Preferences {
	const { preferences, invalid } = resolvePreferences(stored);
	if (invalid.length > 0) {
		console.warn(
			`author ${authorId}: stored preferences [${invalid.join(', ')}] are invalid; using defaults`
		);
	}
	return preferences;
}

export async function getPreferences(db: Executor, authorId: string): Promise<Preferences> {
	const [row] = await db
		.select({ preferences: authors.preferences })
		.from(authors)
		.where(eq(authors.id, authorId));
	if (!row) throw new Error(`author ${authorId} not found`);
	return resolved(authorId, row.preferences);
}

/**
 * Only the preferences the author has set themselves, validated. Rule thresholds use
 * these, so a setting the author never chose falls back to the rule's own default (#18).
 */
export async function getStoredPreferences(
	db: Executor,
	authorId: string
): Promise<Partial<Preferences>> {
	const [row] = await db
		.select({ preferences: authors.preferences })
		.from(authors)
		.where(eq(authors.id, authorId));
	if (!row) throw new Error(`author ${authorId} not found`);
	const raw = row.preferences as Record<string, unknown>;
	const { preferences, invalid } = resolvePreferences(raw);
	return Object.fromEntries(
		Object.entries(preferences).filter(([k]) => k in raw && !invalid.includes(k as PreferenceKey))
	) as Partial<Preferences>;
}

/** Whether the author has set a preference themselves, rather than using the default. */
export async function hasStoredPreference(db: Executor, authorId: string, key: PreferenceKey) {
	const [row] = await db
		.select({ set: sql<boolean>`${authors.preferences} ? ${key}` })
		.from(authors)
		.where(eq(authors.id, authorId));
	return row?.set ?? false;
}

/**
 * Applies a partial update atomically in SQL. Only keys the author sets are stored,
 * and `null` removes a key so it follows the default again. Throws a ZodError on
 * unknown keys or invalid values.
 */
export async function updatePreferences(
	db: Executor,
	authorId: string,
	patch: unknown
): Promise<Preferences> {
	const set: Record<string, unknown> = {};
	const reset: string[] = [];
	for (const [key, value] of Object.entries(PreferencesPatchSchema.parse(patch))) {
		if (value === null) reset.push(key);
		else if (value !== undefined) set[key] = value;
	}

	let next = sql`${authors.preferences} || ${JSON.stringify(set)}::jsonb`;
	for (const key of reset) next = sql`(${next}) - ${key}::text`;

	const [row] = await db
		.update(authors)
		.set({ preferences: next })
		.where(eq(authors.id, authorId))
		.returning({ preferences: authors.preferences });
	if (!row) throw new Error(`author ${authorId} not found`);
	return resolved(authorId, row.preferences);
}

/**
 * Deletes the author and, by cascade, everything they own (#40). `authors` has no
 * row-level security, so this must only ever be called with the signed-in author's id.
 */
export async function deleteAuthor(db: Executor, authorId: string) {
	const rows = await db
		.delete(authors)
		.where(eq(authors.id, authorId))
		.returning({ id: authors.id });
	return rows.length > 0;
}
