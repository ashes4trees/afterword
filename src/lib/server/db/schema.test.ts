import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from './schema';
import { TENANT_PREDICATE_SQL } from './schema';

// Tables that are allowed to have no tenant key: the tenant root itself, and the
// global channel reference table (spec §5). `authors` is also exempt from row-level
// security: sign-in has to look an author up before any author is known.
const EXEMPT = new Set(['authors', 'channels']);

const tables = Object.values(schema as Record<string, unknown>)
	.filter((v): v is PgTable => is(v, PgTable))
	.map((t) => getTableConfig(t));

describe('tenant key convention', () => {
	it('finds the schema tables', () => {
		expect(tables.map((t) => t.name)).toContain('authors');
	});

	const tenantTables = tables.filter((t) => !EXEMPT.has(t.name));

	it.skipIf(tenantTables.length === 0).each(tenantTables.map((t) => [t.name, t] as const))(
		'%s has a non-null author_id referencing authors.id',
		(_name, table) => {
			const column = table.columns.find((c) => c.name === 'author_id');
			expect(column, 'missing author_id column: use authorId() from schema.ts').toBeDefined();
			expect(column!.notNull).toBe(true);

			const fk = table.foreignKeys
				.map((f) => f.reference())
				.find((r) => r.columns.some((c) => c.name === 'author_id'));
			expect(fk, 'author_id has no foreign key').toBeDefined();
			expect(getTableConfig(fk!.foreignTable).name).toBe('authors');
			expect(fk!.foreignColumns.map((c) => c.name)).toEqual(['id']);
		}
	);

	it.skipIf(tenantTables.length === 0).each(tenantTables.map((t) => [t.name, t] as const))(
		'%s has the tenant_isolation row-level security policy',
		(_name, table) => {
			const policy = table.policies.find((p) => p.name === 'tenant_isolation');
			expect(policy, 'missing policy: add (t) => [tenantPolicy()] to the table').toBeDefined();
			expect(policy!.for).toBe('all');
			expect(policy!.as).toBe('permissive');
			for (const clause of [policy!.using, policy!.withCheck]) {
				expect(clause?.queryChunks.map((c) => (c as { value?: unknown }).value).flat()).toEqual([
					TENANT_PREDICATE_SQL
				]);
			}
		}
	);
});
