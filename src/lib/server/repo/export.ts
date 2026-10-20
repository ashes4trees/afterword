import { eq, is, sql } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '$lib/server/db/schema';
import type { Executor } from '$lib/server/db/types';

// Full data export (#17). Every table with an author_id is exported, found from the
// schema rather than listed by hand, so a new tenant table can't be left out.

export type ExportRow = Record<string, unknown>;

/** Tenant tables and their columns in schema order, sorted by name. */
export const TENANT_TABLES = Object.values(schema as Record<string, unknown>)
	.filter((v): v is PgTable => is(v, PgTable))
	.map((t) => getTableConfig(t))
	.filter((t) => t.columns.some((c) => c.name === 'author_id'))
	.map((t) => ({ name: t.name, columns: t.columns.map((c) => c.name) }))
	.sort((a, b) => a.name.localeCompare(b.name));

/**
 * One table's rows for the author, each as Postgres renders it in JSON: dates and
 * timestamps as ISO strings, arrays as arrays. Oldest first (ids are uuidv7).
 */
export async function tableRows(tx: Executor, authorId: string, table: string) {
	const rows = await tx.execute<{ row: ExportRow }>(
		sql`select to_jsonb(t) as row from ${sql.identifier(table)} t where t.author_id = ${authorId} order by t.id`
	);
	return rows.map((r) => r.row);
}

/** The author's account row, without anything secret. */
export async function authorRow(tx: Executor, authorId: string) {
	const [row] = await tx
		.select({
			id: schema.authors.id,
			email: schema.authors.email,
			display_name: schema.authors.displayName,
			ai_mode: schema.authors.aiMode,
			preferences: schema.authors.preferences,
			created_at: schema.authors.createdAt
		})
		.from(schema.authors)
		.where(eq(schema.authors.id, authorId));
	return row ? { ...row, created_at: row.created_at.toISOString() } : null;
}
