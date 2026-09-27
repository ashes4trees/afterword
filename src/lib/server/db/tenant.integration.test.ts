import { inArray, sql } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { authors, TENANT_PREDICATE_SQL } from './schema';
import { withAuthor } from './tenant';

// Proves the row-level security pattern end to end, as the restricted app role. No
// tenant tables exist yet (#8 adds the first), so this builds a throwaway one using the
// exact predicate that tenantPolicy() puts on real tables.
describe.skipIf(!hasDatabase)('row-level security', () => {
	const table = `rls_probe_${crypto.randomUUID().replaceAll('-', '')}`;
	const probe = sql.identifier(table);

	let owner: { client: postgres.Sql; db: TestDb };
	// One connection, so the leak test really does reuse the connection withAuthor used.
	let app: { client: postgres.Sql; db: TestDb };
	let a: string;
	let b: string;

	const labels = (rows: Record<string, unknown>[]) => rows.map((r) => r.label).sort();
	// Drizzle wraps driver errors; the Postgres error is the cause.
	const rlsViolation = {
		cause: { code: '42501', message: expect.stringMatching(/row-level security/) }
	};

	beforeAll(async () => {
		owner = connectOwner();
		app = connect({ max: 1 });

		const created = await owner.db
			.insert(authors)
			.values([
				{ email: `rls-a-${table}@example.test`, displayName: 'A' },
				{ email: `rls-b-${table}@example.test`, displayName: 'B' }
			])
			.returning({ id: authors.id });
		[a, b] = created.map((r) => r.id) as [string, string];

		const [{ role }] = (await app.db.execute(sql`select current_user as role`)) as unknown as [
			{ role: string }
		];
		await owner.db.execute(sql`
			create table ${probe} (
				id uuid primary key default uuidv7(),
				author_id uuid not null references authors(id) on delete cascade,
				label text not null
			)`);
		await owner.db.execute(sql`alter table ${probe} enable row level security`);
		await owner.db.execute(
			sql`create policy tenant_isolation on ${probe} as permissive for all
				using (${sql.raw(TENANT_PREDICATE_SQL)}) with check (${sql.raw(TENANT_PREDICATE_SQL)})`
		);
		await owner.db.execute(
			sql`grant select, insert, update, delete on ${probe} to ${sql.identifier(role)}`
		);
		// The owner bypasses RLS, so it can seed rows for both authors.
		await owner.db.execute(
			sql`insert into ${probe} (author_id, label) values (${a}, 'a1'), (${a}, 'a2'), (${b}, 'b1')`
		);
	});

	afterAll(async () => {
		await owner?.db.execute(sql`drop table if exists ${probe}`);
		if (a && b) await owner.db.delete(authors).where(inArray(authors.id, [a, b]));
		await app?.client.end();
		await owner?.client.end();
	});

	it('the app role cannot bypass row-level security', async () => {
		const [row] = (await app.db.execute(
			sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`
		)) as unknown as [{ rolsuper: boolean; rolbypassrls: boolean }];
		expect(row).toEqual({ rolsuper: false, rolbypassrls: false });
	});

	it('an unfiltered query returns only the current author’s rows', async () => {
		const rows = await withAuthor(app.db, a, (tx) => tx.execute(sql`select label from ${probe}`));
		expect(labels(rows as unknown as Record<string, unknown>[])).toEqual(['a1', 'a2']);
	});

	it('with no author set, nothing is visible', async () => {
		const rows = await app.db.execute(sql`select label from ${probe}`);
		expect(rows).toHaveLength(0);
	});

	it('the author setting does not leak past its transaction', async () => {
		await withAuthor(app.db, a, (tx) => tx.execute(sql`select 1`));
		const rows = await app.db.execute(sql`select label from ${probe}`);
		expect(rows).toHaveLength(0);
	});

	it('cannot write rows for another author', async () => {
		await expect(
			withAuthor(app.db, a, (tx) =>
				tx.execute(sql`insert into ${probe} (author_id, label) values (${b}, 'forged')`)
			)
		).rejects.toMatchObject(rlsViolation);
	});

	it('cannot update or delete another author’s rows', async () => {
		await withAuthor(app.db, a, async (tx) => {
			await tx.execute(sql`update ${probe} set label = 'hijacked' where author_id = ${b}`);
			await tx.execute(sql`delete from ${probe} where author_id = ${b}`);
		});
		const rows = await withAuthor(app.db, b, (tx) => tx.execute(sql`select label from ${probe}`));
		expect(labels(rows as unknown as Record<string, unknown>[])).toEqual(['b1']);
	});

	it('cannot move its own row to another author', async () => {
		await expect(
			withAuthor(app.db, a, (tx) =>
				tx.execute(sql`update ${probe} set author_id = ${b} where label = 'a1'`)
			)
		).rejects.toMatchObject(rlsViolation);
	});
});
