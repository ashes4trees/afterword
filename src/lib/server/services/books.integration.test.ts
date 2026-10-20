import { inArray } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authors } from '$lib/server/db/schema';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { EMPTY_TITLE_FORM, TitleInputSchema, type TitleFormValues } from '$lib/shared/titles';
import {
	bookFormOptions,
	createBook,
	deleteBook,
	getBook,
	listBooks,
	newBookStoreOptions,
	setDefaultStores,
	toFormValues,
	updateBook
} from './books';
import { listingMatrix } from './listings';
import { suggestStores } from '$lib/shared/storeSuggestion';

const input = (fields: Partial<TitleFormValues>) =>
	TitleInputSchema.parse({ ...EMPTY_TITLE_FORM, ...fields });

describe.skipIf(!hasDatabase)('books service', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let other: SessionAuthor;

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		[me, other] = (await owner.db
			.insert(authors)
			.values([
				{ email: `books-me-${tag}@example.test`, displayName: 'Me' },
				{ email: `books-other-${tag}@example.test`, displayName: 'Other' }
			])
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName })) as [
			SessionAuthor,
			SessionAuthor
		];
	});

	afterAll(async () => {
		if (me && other) await owner.db.delete(authors).where(inArray(authors.id, [me.id, other.id]));
		await app?.client.end();
		await owner?.client.end();
	});

	it('creates pen names and series by name, reusing them regardless of case', async () => {
		await createBook(
			app.db,
			me,
			input({
				workingTitle: 'One',
				penName: 'Ava Quill',
				seriesTitle: 'Ember Saga',
				seriesPosition: '1'
			})
		);
		await createBook(
			app.db,
			me,
			input({
				workingTitle: 'Two',
				penName: 'ava quill',
				seriesTitle: 'ember saga',
				seriesPosition: '2'
			})
		);

		const options = await bookFormOptions(app.db, me);
		expect(options.penNames).toEqual(['Ava Quill']);
		expect(options.series).toEqual([{ title: 'Ember Saga', penName: 'Ava Quill' }]);
	});

	it("gives a book its series' pen name when none is entered", async () => {
		const id = await createBook(
			app.db,
			me,
			input({ workingTitle: 'Three', seriesTitle: 'Ember Saga', seriesPosition: '3' })
		);
		expect((await getBook(app.db, me, id))?.penName).toBe('Ava Quill');
	});

	it("keeps the author's pen name when it differs from the series'", async () => {
		const id = await createBook(
			app.db,
			me,
			input({
				workingTitle: 'Crossover',
				penName: 'Other Name',
				seriesTitle: 'Ember Saga',
				seriesPosition: '3.5'
			})
		);
		const book = await getBook(app.db, me, id);
		expect(book).toMatchObject({
			penName: 'Other Name',
			seriesTitle: 'Ember Saga',
			seriesPosition: 3.5
		});
	});

	it('round-trips a book through the edit form', async () => {
		const id = await createBook(
			app.db,
			me,
			input({
				workingTitle: 'Standalone',
				tropes: 'heist, slow burn',
				contentViolence: '2',
				releaseDate: '2027-01-05'
			})
		);
		const values = toFormValues((await getBook(app.db, me, id))!);
		expect(values).toMatchObject({
			tropes: 'heist, slow burn',
			contentViolence: '2',
			releaseDate: '2027-01-05',
			penName: ''
		});

		expect(await updateBook(app.db, me, id, input({ ...values, stage: 'preorder' }))).toBe(true);
		expect((await getBook(app.db, me, id))?.stage).toBe('preorder');
	});

	it('suggests tropes from every book, most used first, one spelling per trope', async () => {
		await createBook(app.db, me, input({ workingTitle: 'T1', tropes: 'Found family, heist' }));
		await createBook(app.db, me, input({ workingTitle: 'T2', tropes: 'found family, Heist' }));
		await createBook(app.db, me, input({ workingTitle: 'T3', tropes: 'found family' }));
		// An earlier test also used heist; one more keeps found family clearly ahead.
		await createBook(app.db, me, input({ workingTitle: 'T4', tropes: 'FOUND FAMILY' }));
		const { tropes } = await bookFormOptions(app.db, me);
		expect(tropes.map((t) => t.toLowerCase()).slice(0, 2)).toEqual(['found family', 'heist']);
		expect(tropes.filter((t) => t.toLowerCase() === 'found family')).toHaveLength(1);
		expect((await bookFormOptions(app.db, other)).tropes).toEqual([]);
	});

	it("never shows, edits, or deletes another author's books", async () => {
		const [mine] = await listBooks(app.db, me);
		expect(await listBooks(app.db, other)).toEqual([]);
		expect(await getBook(app.db, other, mine!.id)).toBeUndefined();
		expect(await updateBook(app.db, other, mine!.id, input({ workingTitle: 'Hijacked' }))).toBe(
			false
		);
		expect(await deleteBook(app.db, other, mine!.id)).toBe(false);
		expect((await getBook(app.db, me, mine!.id))?.workingTitle).toBe(mine!.workingTitle);
	});

	it('deletes a book', async () => {
		const id = await createBook(app.db, me, input({ workingTitle: 'Doomed' }));
		expect(await deleteBook(app.db, me, id)).toBe(true);
		expect(await getBook(app.db, me, id)).toBeUndefined();
	});

	it('adds listings on the chosen stores for the formats each sells, and suggests them next time', async () => {
		const empty = await newBookStoreOptions(app.db, other);
		expect(empty).toEqual({ defaults: null, history: [] });

		const id = await createBook(
			app.db,
			other,
			input({ workingTitle: 'Salt Lantern', penName: 'A. Vale', formats: 'ebook,audiobook' }),
			['kdp', 'acx']
		);
		const { listings } = await listingMatrix(app.db, other);
		expect(
			listings
				.filter((l) => l.titleId === id)
				.map((l) => [l.channelSlug, l.format, l.status])
				.sort()
		).toEqual([
			['acx', 'audiobook', 'not_started'],
			['kdp', 'ebook', 'not_started']
		]);

		const options = await newBookStoreOptions(app.db, other);
		expect(suggestStores({ ...options, penName: 'a. vale' })).toEqual({
			stores: ['kdp', 'acx'],
			source: { kind: 'book', title: 'Salt Lantern' }
		});

		await setDefaultStores(app.db, other, []);
		expect((await newBookStoreOptions(app.db, other)).defaults).toEqual([]);
		await setDefaultStores(app.db, other, null);
		expect((await newBookStoreOptions(app.db, other)).defaults).toBeNull();
	});
});
