import { eq } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authors } from '$lib/server/db/schema';
import { withAuthor } from '$lib/server/db/tenant';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { createBook, deleteBook } from '$lib/server/services/books';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import {
	createImport,
	deleteImport,
	finishImport,
	insertObservations,
	listImports,
	listObservations,
	type ObservationValues
} from './imports';

describe.skipIf(!hasDatabase)('imports and observations (#20)', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let other: SessionAuthor;
	let book: string;
	const as = <T>(a: SessionAuthor, fn: Parameters<typeof withAuthor<T>>[2]) =>
		withAuthor(app.db, a.id, fn);

	const row = (o: Partial<ObservationValues> = {}): ObservationValues => ({
		titleId: book,
		externalId: 'B0TEST0001',
		format: 'ebook',
		channelSlug: 'kdp',
		marketplace: 'GB',
		currency: 'GBP',
		metric: 'units',
		value: 12,
		periodStart: '2026-09-01',
		periodEnd: '2026-09-30',
		...o
	});

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		[me, other] = (await owner.db
			.insert(authors)
			.values([
				{ email: `obs-${tag}@example.test`, displayName: 'O' },
				{ email: `obs-other-${tag}@example.test`, displayName: 'P' }
			])
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName })) as [
			SessionAuthor,
			SessionAuthor
		];
		book = await createBook(
			app.db,
			me,
			TitleInputSchema.parse({ ...EMPTY_TITLE_FORM, workingTitle: 'The Salt Lantern' })
		);
	});

	afterAll(async () => {
		for (const a of [me, other]) if (a) await owner.db.delete(authors).where(eq(authors.id, a.id));
		await app?.client.end();
		await owner?.client.end();
	});

	it('stores metrics with store, marketplace, currency, and period, linked to their import', async () => {
		const id = await as(me, (tx) =>
			createImport(tx, me.id, { channelSlug: 'kdp', kind: 'kdp_report', filename: 'sept.xlsx' })
		);
		await as(me, async (tx) => {
			await insertObservations(tx, me.id, id, [
				row(),
				row({ metric: 'royalty_minor', value: -350 }),
				row({ titleId: null, externalId: 'B0UNKNOWN1', metric: 'kenp_pages', value: 3_000_000_000 })
			]);
			await finishImport(tx, me.id, id, { rowCount: 3 });
		});
		const all = await as(me, (tx) => listObservations(tx, me.id));
		expect(all.map((o) => [o.metric, o.value, o.marketplace, o.currency, o.importId])).toEqual([
			['units', 12, 'GB', 'GBP', id],
			['royalty_minor', -350, 'GB', 'GBP', id],
			['kenp_pages', 3_000_000_000, 'GB', 'GBP', id]
		]);
		expect(await as(me, (tx) => listObservations(tx, me.id, book))).toHaveLength(2);
		expect((await as(me, (tx) => listImports(tx, me.id)))[0]).toMatchObject({
			status: 'parsed',
			rowCount: 3,
			error: null
		});
	});

	it('records why an import failed', async () => {
		const id = await as(me, (tx) =>
			createImport(tx, me.id, { channelSlug: 'kobo', kind: 'kobo_report', filename: 'bad.csv' })
		);
		await as(me, (tx) => finishImport(tx, me.id, id, { error: 'No sales rows found.' }));
		const failed = (await as(me, (tx) => listImports(tx, me.id))).find((i) => i.id === id);
		expect(failed).toMatchObject({ status: 'failed', error: 'No sales rows found.' });
	});

	it('rejects a period that ends before it starts, and a bad marketplace', async () => {
		const id = await as(me, (tx) =>
			createImport(tx, me.id, { channelSlug: 'kdp', kind: 'kdp_report', filename: 'x.xlsx' })
		);
		for (const bad of [row({ periodEnd: '2026-08-01' }), row({ marketplace: 'gb' })]) {
			await expect(as(me, (tx) => insertObservations(tx, me.id, id, [bad]))).rejects.toMatchObject({
				cause: { code: '23514' }
			});
		}
	});

	it('keeps imports private to their author', async () => {
		expect(await as(other, (tx) => listObservations(tx, other.id))).toEqual([]);
		expect(await as(other, (tx) => listImports(tx, other.id))).toEqual([]);
	});

	it('deleting an import removes what it produced, so the report can be imported again', async () => {
		const [first] = await as(me, (tx) => listImports(tx, me.id));
		expect(await as(me, (tx) => deleteImport(tx, me.id, first!.id))).toBe(true);
		expect(await as(me, (tx) => listObservations(tx, me.id))).toEqual([]);
	});

	it("removes a book's observations with the book", async () => {
		const id = await as(me, (tx) =>
			createImport(tx, me.id, { channelSlug: 'kdp', kind: 'kdp_report', filename: 'oct.xlsx' })
		);
		await as(me, (tx) => insertObservations(tx, me.id, id, [row()]));
		expect(await deleteBook(app.db, me, book)).toBe(true);
		expect(await as(me, (tx) => listObservations(tx, me.id))).toEqual([]);
	});
});
