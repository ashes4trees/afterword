// Lists ideas authors chose to share (#112), for the maintainer to review. Read only.
//
//   npm run ideas:shared                    every shared idea, newest first
//   npm run ideas:shared -- --since 2026-11-01
//
// Prints only the idea itself: never the author, their email, or their books. Worth
// adding? Rewrite it in the brand voice and add it to content/playbooks/title/promo-ideas.yaml
// (see "Idea suggestions" in CLAUDE.md). Runs as the database owner, past row-level security.
import postgres from 'postgres';

try {
	process.loadEnvFile();
} catch {
	// No .env file; rely on the real environment.
}

const ownerUrl = process.env.DATABASE_OWNER_URL;
if (!ownerUrl) throw new Error('DATABASE_OWNER_URL must be set; see .env.example');

const at = process.argv.indexOf('--since');
const since = at === -1 ? '1970-01-01' : process.argv[at + 1];
if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since))
	throw new Error('--since takes a YYYY-MM-DD date');

const sql = postgres(ownerUrl, { onnotice: () => {} });
try {
	const rows = await sql<
		{
			label: string;
			note: string | null;
			phase: string;
			window_from_days: number | null;
			window_to_days: number | null;
			repeatable: boolean;
			shared_on: string;
		}[]
	>`
		select label, note, phase, window_from_days, window_to_days, repeatable,
			to_char(shared_at, 'YYYY-MM-DD') as shared_on
		from author_ideas
		where shared_at >= ${since}::date
		order by shared_at desc`;
	if (rows.length === 0) console.log(`No ideas shared since ${since}.`);
	for (const r of rows) {
		const window =
			r.window_from_days === null ? 'anytime' : `${r.window_from_days} to ${r.window_to_days} days`;
		console.log(
			`${r.shared_on}  ${r.label}\n    ${r.phase}, ${window}${r.repeatable ? ', repeatable' : ''}` +
				(r.note ? `\n    ${r.note}` : '')
		);
	}
} finally {
	await sql.end();
}
