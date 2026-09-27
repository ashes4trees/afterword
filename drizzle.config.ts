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
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
	strict: true,
	verbose: true
});
