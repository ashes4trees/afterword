import { eq, sql } from 'drizzle-orm';
import { authors } from '$lib/server/db/schema';
import type { Executor } from '$lib/server/db/types';
import {
	PreferencesPatchSchema,
	resolvePreferences,
	type Preferences
} from '$lib/shared/preferences';

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
