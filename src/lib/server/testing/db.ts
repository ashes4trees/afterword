// Test-only helpers for *.integration.test.ts. App code must not import this.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '$lib/server/db/schema';

try {
	process.loadEnvFile();
} catch {
	// No .env file; rely on the real environment.
}

/** The restricted app role: what the app connects as, so row-level security applies. */
export const databaseUrl = process.env.DATABASE_URL;
/** The owner role: for test fixtures that need DDL or to see past row-level security. */
export const databaseOwnerUrl = process.env.DATABASE_OWNER_URL;

// Locally, database tests skip when the URLs are unset. In CI, a missing database is a
// broken pipeline, not a reason to skip.
if (process.env.CI && !(databaseUrl && databaseOwnerUrl)) {
	throw new Error('DATABASE_URL and DATABASE_OWNER_URL must be set in CI');
}

export const hasDatabase = Boolean(databaseUrl && databaseOwnerUrl);

function open(url: string, options: postgres.Options<Record<string, never>> = {}) {
	const client = postgres(url, { onnotice: () => {}, ...options });
	return { client, db: drizzle(client, { schema }) };
}

export const connect = (options?: postgres.Options<Record<string, never>>) =>
	open(databaseUrl!, options);
export const connectOwner = () => open(databaseOwnerUrl!);

export type TestDb = ReturnType<typeof connect>['db'];
