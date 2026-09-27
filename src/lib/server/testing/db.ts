// Test-only helpers for *.integration.test.ts. App code must not import this.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '$lib/server/db/schema';

try {
	process.loadEnvFile();
} catch {
	// No .env file; rely on the real environment.
}

export const databaseUrl = process.env.DATABASE_URL;

// Locally, database tests skip when DATABASE_URL is unset. In CI, a missing database
// is a broken pipeline, not a reason to skip.
if (process.env.CI && !databaseUrl) {
	throw new Error('DATABASE_URL must be set in CI so integration tests run');
}

export function connect() {
	const client = postgres(databaseUrl!, { onnotice: () => {} });
	return { client, db: drizzle(client, { schema }) };
}

export type TestDb = ReturnType<typeof connect>['db'];
