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
		'%s references other tenant tables only through author_id',
		(_name, table) => {
			// Foreign key checks ignore row-level security, so a reference that skips
			// author_id could point at another author's row.
			for (const fk of table.foreignKeys.map((f) => f.reference())) {
				const target = getTableConfig(fk.foreignTable).name;
				if (EXEMPT.has(target)) continue;
				const pairs = fk.columns.map((c, i) => [c.name, fk.foreignColumns[i]!.name]);
				expect(pairs, `reference to ${target} must include author_id`).toContainEqual([
					'author_id',
					'author_id'
				]);
			}
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

describe('C2: no field can hold manuscript text', () => {
	// Works tables describe the product, never the prose. Every text column is short
	// and bounded; nothing unbounded (text, jsonb) is allowed on them.
	const WORKS = ['pen_names', 'series', 'titles'];
	const MAX_TEXT = 200;

	it.each(WORKS.map((name) => [name, tables.find((t) => t.name === name)!] as const))(
		'%s has only short, bounded text columns',
		(_name, table) => {
			for (const column of table.columns) {
				const type = column.getSQLType();
				expect(type, `${column.name} is unbounded`).not.toMatch(/^(text|jsonb?)(\[\])?$/);
				const length = /^varchar\((\d+)\)/.exec(type)?.[1];
				if (length)
					expect(Number(length), `${column.name} is too long`).toBeLessThanOrEqual(MAX_TEXT);
			}
		}
	);
});

describe('channels reference table', () => {
	const channels = tables.find((t) => t.name === 'channels')!;

	it('can be read but has no write policy, so the app cannot change it', () => {
		expect(channels.policies.map((p) => [p.name, p.for])).toEqual([['channels_read', 'select']]);
	});
});

describe('money convention', () => {
	// Money is integer minor units next to an explicit currency (spec §2, invariant 6).
	const moneyColumns = tables.flatMap((t) =>
		t.columns
			.filter((c) => c.name.endsWith('_minor'))
			.map((c) => [`${t.name}.${c.name}`, t, c] as const)
	);

	it('finds the money columns', () => {
		expect(moneyColumns.length).toBeGreaterThan(0);
	});

	it.each(moneyColumns)('%s is an integer next to a currency column', (_name, table, column) => {
		expect(column.getSQLType()).toMatch(/^(integer|bigint)$/);
		expect(table.columns.map((c) => c.name)).toContain('currency');
	});
});
