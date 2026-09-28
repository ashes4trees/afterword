import { eq, inArray, sql } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { authors, penNames, series, titles } from './schema';
import { withAuthor } from './tenant';
import type { Executor } from './types';

// Drizzle wraps driver errors; the Postgres error is the cause.
const pgError = (code: string) => ({ cause: { code } });
const FOREIGN_KEY = '23503';
const CHECK = '23514';
const TOO_LONG = '22001';

describe.skipIf(!hasDatabase)('works schema: pen names, series, titles', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let a: string;
	let b: string;
	let penA: string;
	let penB: string;
	let seriesA: string;

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		const created = await owner.db
			.insert(authors)
			.values([
				{ email: `works-a-${tag}@example.test`, displayName: 'A' },
				{ email: `works-b-${tag}@example.test`, displayName: 'B' }
			])
			.returning({ id: authors.id });
		[a, b] = created.map((r) => r.id) as [string, string];

		await withAuthor(app.db, a, async (tx) => {
			[{ id: penA }] = (await tx
				.insert(penNames)
				.values({ authorId: a, name: 'A. Writer' })
				.returning({ id: penNames.id })) as [{ id: string }];
			[{ id: seriesA }] = (await tx
				.insert(series)
				.values({ authorId: a, penNameId: penA, title: 'Saga', plannedCount: 3 })
				.returning({ id: series.id })) as [{ id: string }];
			await tx.insert(titles).values([
				{ authorId: a, penNameId: penA, seriesId: seriesA, seriesPosition: 1, workingTitle: 'One' },
				{ authorId: a, penNameId: penA, workingTitle: 'Standalone' }
			]);
		});
		await withAuthor(app.db, b, async (tx) => {
			[{ id: penB }] = (await tx
				.insert(penNames)
				.values({ authorId: b, name: 'B. Writer' })
				.returning({ id: penNames.id })) as [{ id: string }];
		});
	});

	afterAll(async () => {
		if (a && b) await owner.db.delete(authors).where(inArray(authors.id, [a, b]));
		await app?.client.end();
		await owner?.client.end();
	});

	const asA = <T>(fn: (tx: Executor) => Promise<T>) => withAuthor(app.db, a, fn);

	it('an author sees only their own books', async () => {
		const seenByB = await withAuthor(app.db, b, (tx) => tx.select().from(titles));
		expect(seenByB).toHaveLength(0);
		const seenByA = await asA((tx) => tx.select().from(titles));
		expect(seenByA.map((t) => t.workingTitle).sort()).toEqual(['One', 'Standalone']);
	});

	it("rejects a book under another author's pen name", async () => {
		await expect(
			asA((tx) =>
				tx.insert(titles).values({ authorId: a, penNameId: penB, workingTitle: 'Stolen' })
			)
		).rejects.toMatchObject(pgError(FOREIGN_KEY));
	});

	it('allows books and series with no pen name', async () => {
		const rows = await asA(async (tx) => {
			const [s] = await tx
				.insert(series)
				.values({ authorId: a, title: 'Unlabelled saga' })
				.returning({ id: series.id });
			return tx
				.insert(titles)
				.values([
					{ authorId: a, workingTitle: 'No pen name' },
					{ authorId: a, seriesId: s!.id, seriesPosition: 1, workingTitle: 'Unlabelled one' }
				])
				.returning({ penNameId: titles.penNameId });
		});
		expect(rows.map((r) => r.penNameId)).toEqual([null, null]);
	});

	it("rejects a book in another author's series, even with no pen name", async () => {
		const [{ id: seriesB }] = (await withAuthor(app.db, b, (tx) =>
			tx.insert(series).values({ authorId: b, title: 'B saga' }).returning({ id: series.id })
		)) as [{ id: string }];
		await expect(
			asA((tx) =>
				tx.insert(titles).values({ authorId: a, seriesId: seriesB, workingTitle: 'Stolen series' })
			)
		).rejects.toMatchObject(pgError(FOREIGN_KEY));
	});

	it('keeps decimal series positions exact', async () => {
		const [row] = await asA((tx) =>
			tx
				.insert(titles)
				.values({
					authorId: a,
					penNameId: penA,
					seriesId: seriesA,
					seriesPosition: 2.5,
					workingTitle: 'Novella'
				})
				.returning({ seriesPosition: titles.seriesPosition })
		);
		expect(row!.seriesPosition).toBe(2.5);
	});

	it.each([
		['a series position without a series', { seriesPosition: 1 }, CHECK],
		['a violence rating above 5', { contentViolence: 6 }, CHECK],
		['a negative language rating', { contentLanguage: -1 }, CHECK],
		['a zero page count', { pageCount: 0 }, CHECK],
		['more than 20 tropes', { tropes: Array.from({ length: 21 }, (_, i) => `trope ${i}`) }, CHECK],
		['a working title over 200 characters', { workingTitle: 'x'.repeat(201) }, TOO_LONG],
		['a genre over 60 characters', { genre: 'x'.repeat(61) }, TOO_LONG]
	])('rejects %s', async (_label, fields, code) => {
		await expect(
			asA((tx) =>
				tx.insert(titles).values({ authorId: a, penNameId: penA, workingTitle: 'Bad', ...fields })
			)
		).rejects.toMatchObject(pgError(code));
	});

	it('rejects duplicate pen names regardless of case', async () => {
		await expect(
			asA((tx) => tx.insert(penNames).values({ authorId: a, name: 'a. writer' }))
		).rejects.toMatchObject(pgError('23505'));
	});

	it('will not delete a pen name that still has books', async () => {
		await expect(
			asA((tx) => tx.delete(penNames).where(eq(penNames.id, penA)))
		).rejects.toMatchObject(pgError(FOREIGN_KEY));
	});

	it('deleting an author removes all of their works', async () => {
		const [temp] = await owner.db
			.insert(authors)
			.values({ email: `works-c-${tag}@example.test`, displayName: 'C' })
			.returning({ id: authors.id });
		const c = temp!.id;
		await withAuthor(app.db, c, async (tx) => {
			const [pen] = await tx.insert(penNames).values({ authorId: c, name: 'C' }).returning();
			const [s] = await tx
				.insert(series)
				.values({ authorId: c, penNameId: pen!.id, title: 'S' })
				.returning();
			await tx
				.insert(titles)
				.values({ authorId: c, penNameId: pen!.id, seriesId: s!.id, workingTitle: 'T' });
		});

		await owner.db.delete(authors).where(eq(authors.id, c));

		const [left] = (await owner.db.execute(sql`
			select (select count(*) from pen_names where author_id = ${c})
			     + (select count(*) from series where author_id = ${c})
			     + (select count(*) from titles where author_id = ${c}) as n`)) as unknown as [{ n: string }];
		expect(Number(left.n)).toBe(0);
	});
});
