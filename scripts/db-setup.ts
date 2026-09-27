// Creates the restricted role the app connects as, and grants it table access.
// Row-level security only binds a role that is not a superuser, not the table owner,
// and lacks BYPASSRLS, so the app must never connect as the owner.
//
//   npm run db:setup
//
// Run as the database owner (DATABASE_OWNER_URL), the same role that runs migrations,
// so its default privileges cover tables that future migrations create. The app
// role's name and password come from DATABASE_URL. Idempotent: safe to re-run.
import postgres from 'postgres';

try {
	process.loadEnvFile();
} catch {
	// No .env file; rely on the real environment.
}

const ownerUrl = process.env.DATABASE_OWNER_URL;
const appUrl = process.env.DATABASE_URL;
if (!ownerUrl || !appUrl) {
	throw new Error('DATABASE_OWNER_URL and DATABASE_URL must both be set; see .env.example');
}

const app = new URL(appUrl);
const role = decodeURIComponent(app.username);
const password = decodeURIComponent(app.password);
if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error(`unsupported app role name: ${role}`);
if (!password) throw new Error('DATABASE_URL must include a password for the app role');
if (role === decodeURIComponent(new URL(ownerUrl).username)) {
	throw new Error('DATABASE_URL must use a different role from DATABASE_OWNER_URL');
}

const sql = postgres(ownerUrl, { onnotice: () => {} });
try {
	const [{ exists }] = await sql`select exists (select 1 from pg_roles where rolname = ${role})`;
	if (!exists) await sql.unsafe(`create role ${role}`);
	await sql.unsafe(
		`alter role ${role} with login nosuperuser nobypassrls nocreatedb nocreaterole password '${password.replaceAll("'", "''")}'`
	);

	const [{ db }] = await sql`select current_database() as db`;
	await sql.unsafe(`grant connect on database "${db}" to ${role}`);
	await sql.unsafe(`grant usage on schema public to ${role}`);
	await sql.unsafe(
		`grant select, insert, update, delete on all tables in schema public to ${role}`
	);
	await sql.unsafe(
		`alter default privileges in schema public grant select, insert, update, delete on tables to ${role}`
	);
	console.log(`app role ${role} ready on ${db}`);
} finally {
	await sql.end();
}
