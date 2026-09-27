import { defineConfig } from 'drizzle-kit';

try {
	process.loadEnvFile();
} catch {
	// No .env file; rely on the real environment.
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './src/lib/server/db/migrations',
	dialect: 'postgresql',
	// Migrations run as the owner; the app's own role can't create tables.
	dbCredentials: { url: process.env.DATABASE_OWNER_URL ?? '' },
	strict: true,
	verbose: true
});
