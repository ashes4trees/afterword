import { eq, sql } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authors } from '$lib/server/db/schema';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { TENANT_TABLES } from '$lib/server/repo/export';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import { deleteAccount } from './account';
import { createBook } from './books';
import { saveListing } from './listings';
import { addMetricFixtures } from '$lib/server/testing/fixtures';
import { addOwnStep, saveMyIdea, setIdeaHidden } from './tasks';

describe.skipIf(!hasDatabase)('account deletion (#40)', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let other: SessionAuthor;

	/** Rows referencing an author, per tenant table, seen past row-level security. */
	const counts = async (authorId: string) =>
		Object.fromEntries(
			await Promise.all(
				TENANT_TABLES.map(async (t) => {
					const [row] = await owner.db.execute<{ n: number }>(
						sql`select count(*)::int as n from ${sql.identifier(t.name)} where author_id = ${authorId}`
					);
					return [t.name, row!.n] as const;
				})
			)
		);

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		[me, other] = (await owner.db
			.insert(authors)
			.values([
				{ email: `Delete-Me-${tag}@example.test`, displayName: 'Leaving' },
				{ email: `delete-other-${tag}@example.test`, displayName: 'Staying' }
			])
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName })) as [
			SessionAuthor,
			SessionAuthor
		];
		for (const author of [me, other]) {
			const book = await createBook(
				app.db,
				author,
				TitleInputSchema.parse({
					...EMPTY_TITLE_FORM,
					workingTitle: 'The Salt Lantern',
					penName: 'A. Vale',
					seriesTitle: 'Lantern Cycle',
					seriesPosition: '1',
					releaseDate: '2027-02-01',
					formats: 'ebook'
				}),
				['kdp']
			);
			const listing = {
				status: 'live' as const,
				externalId: null,
				priceMinor: null,
				currency: null,
				enrolledInSelect: true,
				exclusivityStart: '2026-10-01',
				exclusivityEnd: '2026-12-30',
				wholesaleDiscountPct: null,
				returnable: null
			};
			await saveListing(app.db, author, book, 'kdp', 'ebook', null, listing);
			await saveListing(app.db, author, book, 'kdp', 'ebook', null, {
				...listing,
				exclusivityEnd: '2027-03-30'
			});
			await addOwnStep(app.db, author, book, 'Email the street team', null, { phase: 'launch' });
			await saveMyIdea(app.db, author, null, {
				label: 'Live read',
				note: null,
				phase: 'launch',
				window: null,
				repeatable: false,
				shared: false
			});
			await setIdeaHidden(
				app.db,
				author,
				book,
				{ pack: 'mine', stepId: crypto.randomUUID() },
				true
			);
			await addMetricFixtures(app.db, author.id, book);
		}
	});

	afterAll(async () => {
		await owner.db.delete(authors).where(eq(authors.id, me.id));
		await owner.db.delete(authors).where(eq(authors.id, other.id));
		await app?.client.end();
		await owner?.client.end();
	});

	it('starts with rows in every tenant table', async () => {
		for (const [table, n] of Object.entries(await counts(me.id))) {
			expect(n, `${table} needs a fixture row`).toBeGreaterThan(0);
		}
	});

	it('deletes nothing when the typed email does not match', async () => {
		expect(await deleteAccount(app.db, me, 'someone-else@example.test')).toBe('mismatch');
		expect(Object.values(await counts(me.id)).every((n) => n > 0)).toBe(true);
	});

	it('deletes the author and every row that references them, and nobody else', async () => {
		expect(await deleteAccount(app.db, me, ` ${me.email.toLowerCase()} `)).toBe('deleted');
		expect(await owner.db.select().from(authors).where(eq(authors.id, me.id))).toEqual([]);
		expect(Object.values(await counts(me.id)).every((n) => n === 0)).toBe(true);
		expect(Object.values(await counts(other.id)).every((n) => n > 0)).toBe(true);
	});
});
