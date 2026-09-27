import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '$lib/server/db/schema';
import { DEFAULT_PREFERENCES } from '$lib/shared/preferences';
import { getPreferences, updatePreferences } from './authors';

try {
	process.loadEnvFile();
} catch {
	// No .env file; rely on the real environment.
}
const url = process.env.DATABASE_URL;

// Runs against a real database and cleans up after itself. Skipped when
// DATABASE_URL is unset; CI provides one from #39.
describe.skipIf(!url)('authors repo: preferences', () => {
	let client: postgres.Sql;
	let db: ReturnType<typeof drizzle<typeof schema>>;
	let authorId: string;

	const stored = async () => {
		const [row] = await db
			.select({ p: schema.authors.preferences })
			.from(schema.authors)
			.where(eq(schema.authors.id, authorId));
		return row!.p;
	};

	beforeAll(async () => {
		client = postgres(url!, { onnotice: () => {} });
		db = drizzle(client, { schema });
		const [author] = await db
			.insert(schema.authors)
			.values({ email: `test-${crypto.randomUUID()}@example.test`, displayName: 'Test' })
			.returning();
		authorId = author!.id;
	});

	afterAll(async () => {
		if (authorId) await db.delete(schema.authors).where(eq(schema.authors.id, authorId));
		await client?.end();
	});

	it('returns defaults for a new author', async () => {
		expect(await getPreferences(db, authorId)).toEqual(DEFAULT_PREFERENCES);
		expect(await stored()).toEqual({});
	});

	it('stores only the keys that were set', async () => {
		const result = await updatePreferences(db, authorId, { target_acos: 1.1, currency: 'GBP' });
		expect(result).toEqual({ ...DEFAULT_PREFERENCES, target_acos: 1.1, currency: 'GBP' });
		expect(await stored()).toEqual({ target_acos: 1.1, currency: 'GBP' });
	});

	it('merges later patches and resets keys set to null', async () => {
		await updatePreferences(db, authorId, { marketplaces: ['US', 'CA'], target_acos: null });
		expect(await stored()).toEqual({ currency: 'GBP', marketplaces: ['US', 'CA'] });
		expect((await getPreferences(db, authorId)).target_acos).toBe(DEFAULT_PREFERENCES.target_acos);
	});

	it('rejects invalid writes without touching stored data', async () => {
		const before = await stored();
		await expect(updatePreferences(db, authorId, { currency: 'pounds' })).rejects.toThrow();
		await expect(updatePreferences(db, authorId, { nope: 1 })).rejects.toThrow();
		expect(await stored()).toEqual(before);
	});

	it('falls back per key when stored data has gone invalid', async () => {
		await db
			.update(schema.authors)
			.set({ preferences: { target_acos: 'high', currency: 'EUR' } })
			.where(eq(schema.authors.id, authorId));
		const prefs = await getPreferences(db, authorId);
		expect(prefs.target_acos).toBe(DEFAULT_PREFERENCES.target_acos);
		expect(prefs.currency).toBe('EUR');
	});

	it('throws for an unknown author', async () => {
		await expect(getPreferences(db, crypto.randomUUID())).rejects.toThrow(/not found/);
	});
});
