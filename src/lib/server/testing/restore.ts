// Test-only (#17): rebuilds an account from its export, to prove the export holds
// enough to reconstruct it. App code must not import this.
import { is, sql } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '$lib/server/db/schema';
import type { AccountExport } from '$lib/server/services/export';
import type { TestDb } from './db';

const configs = Object.values(schema as Record<string, unknown>)
	.filter((v): v is PgTable => is(v, PgTable))
	.map((t) => getTableConfig(t));

/** Tables in an order where every foreign key points at an earlier one. */
function insertOrder(names: string[]): string[] {
	const deps = new Map(
		names.map((name) => {
			const config = configs.find((c) => c.name === name)!;
			const refs = config.foreignKeys
				.map((f) => getTableConfig(f.reference().foreignTable).name)
				.filter((n) => n !== name && names.includes(n));
			return [name, new Set(refs)];
		})
	);
	const order: string[] = [];
	while (order.length < names.length) {
		const next = names.find(
			(n) => !order.includes(n) && [...deps.get(n)!].every((d) => order.includes(d))
		);
		if (!next) throw new Error('foreign keys form a cycle');
		order.push(next);
	}
	return order;
}

/** Columns that point back into their own table, such as decisions.superseded_by. */
function selfReferences(name: string): string[] {
	const config = configs.find((c) => c.name === name)!;
	return config.foreignKeys
		.map((f) => f.reference())
		.filter((r) => getTableConfig(r.foreignTable).name === name)
		.flatMap((r) => r.columns.map((c) => c.name))
		.filter((c) => c !== 'author_id');
}

/** Inserts the export's account and rows as the owner role, past row-level security. */
export async function restoreAccount(owner: TestDb, data: AccountExport) {
	await owner.transaction(async (tx) => {
		const a = data.author;
		await tx.execute(
			sql`insert into authors (id, email, display_name, ai_mode, preferences, created_at)
				values (${a.id}, ${a.email}, ${a.display_name}, ${a.ai_mode}, ${JSON.stringify(a.preferences)}::jsonb, ${a.created_at})`
		);
		for (const name of insertOrder(Object.keys(data.tables))) {
			const later = selfReferences(name);
			const table = sql.identifier(name);
			for (const row of data.tables[name]!) {
				const first = { ...row, ...Object.fromEntries(later.map((c) => [c, null])) };
				await tx.execute(
					sql`insert into ${table} select * from jsonb_populate_record(null::${table}, ${JSON.stringify(first)}::jsonb)`
				);
			}
			for (const column of later) {
				for (const row of data.tables[name]!.filter((r) => r[column] !== null)) {
					await tx.execute(
						sql`update ${table} set ${sql.identifier(column)} = ${row[column] as string} where id = ${row.id as string}`
					);
				}
			}
		}
	});
}
