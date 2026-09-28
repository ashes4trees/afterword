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
	toFormValues,
	updateBook
} from './books';

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
});
