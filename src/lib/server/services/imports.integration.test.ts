import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authors } from '$lib/server/db/schema';
import { withAuthor } from '$lib/server/db/tenant';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { listObservations } from '$lib/server/repo/imports';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { buildXlsx } from '$lib/server/testing/xlsx';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import { createBook } from './books';
import { deleteImport, importReport, listImports } from './imports';
import { saveListing } from './listings';

const fixture = new Uint8Array(
	readFileSync(new URL('../import/fixtures/kdp-report.xlsx', import.meta.url))
);
const listing = (externalId: string) => ({
	status: 'live' as const,
	externalId,
	priceMinor: null,
	currency: null,
	enrolledInSelect: false,
	exclusivityStart: null,
	exclusivityEnd: null,
	wholesaleDiscountPct: null,
	returnable: null
});

describe.skipIf(!hasDatabase)('KDP report import (#21)', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let lantern: string;
	let ember: string;
	const observations = () => withAuthor(app.db, me.id, (tx) => listObservations(tx, me.id));
	const sum = async (metric: string, currency?: string) =>
		(await observations())
			.filter((o) => o.metric === metric && (!currency || o.currency === currency))
			.reduce((s, o) => s + o.value, 0);

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		const [a] = await owner.db
			.insert(authors)
			.values({ email: `imp-${tag}@example.test`, displayName: 'I' })
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName });
		me = a!;
		const book = (workingTitle: string) =>
			createBook(app.db, me, TitleInputSchema.parse({ ...EMPTY_TITLE_FORM, workingTitle }));
		lantern = await book('My Salt Lantern');
		ember = await book('My Ember Road');
		await saveListing(app.db, me, lantern, 'kdp', 'ebook', null, listing('B0FAKE0001'));
	});

	afterAll(async () => {
		if (me) await owner.db.delete(authors).where(eq(authors.id, me.id));
		await app?.client.end();
		await owner?.client.end();
	});

	it('imports the report, matching books by store ID and listing the rest', async () => {
		const summary = await importReport(app.db, me, 'KDP_Report.xlsx', fixture);
		expect(summary).toMatchObject({
			ok: true,
			matched: [{ title: 'My Salt Lantern', externalId: 'B0FAKE0001' }]
		});
		if (!summary.ok) return;
		expect(summary.unmatched.map((u) => u.externalId).sort()).toEqual([
			'9790000000003',
			'B0FAKE0002'
		]);
		expect(await sum('royalty_minor', 'USD')).toBe(5262);
		expect(await sum('kenp_pages')).toBe(13775);
		expect((await observations()).filter((o) => o.titleId === lantern).length).toBeGreaterThan(0);
	});

	it('never double counts when the same report is uploaded again', async () => {
		await importReport(app.db, me, 'KDP_Report (1).xlsx', fixture);
		expect(await sum('royalty_minor', 'USD')).toBe(5262);
		expect(await sum('kenp_pages')).toBe(13775);
		const [newest, first] = await listImports(app.db, me);
		expect(newest).toMatchObject({ status: 'parsed', remaining: newest!.rowCount });
		expect(first!.remaining).toBe(0);
	});

	it('replaces only the days a newer report covers', async () => {
		const header = [
			'Royalty Date',
			'Title',
			'ASIN',
			'Marketplace',
			'Net Units Sold',
			'Royalty',
			'Currency'
		];
		const before = (await observations()).filter(
			(o) => o.metric === 'royalty_minor' && o.periodStart === '2026-10-23' && o.currency === 'USD'
		);
		const beforeDay = before.reduce((s, o) => s + o.value, 0);
		const oneDay = buildXlsx({
			'eBook Royalty': [
				header,
				['2026-10-23', 'The Salt Lantern', 'B0FAKE0001', 'Amazon.com', '2.0', '5.00', 'USD']
			]
		});
		const summary = await importReport(app.db, me, 'one-day.xlsx', oneDay);
		expect(summary).toMatchObject({
			ok: true,
			rows: 2,
			coverage: { royalty_minor: { from: '2026-10-23', to: '2026-10-23' } }
		});
		expect(await sum('royalty_minor', 'USD')).toBe(5262 - beforeDay + 500);
		expect(await sum('kenp_pages')).toBe(13775);
	});

	it('links rows to a book once the author records its store ID', async () => {
		expect((await observations()).some((o) => o.titleId === ember)).toBe(false);
		await saveListing(app.db, me, ember, 'kdp', 'ebook', null, listing('B0FAKE0002'));
		expect(
			(await observations())
				.filter((o) => o.externalId === 'B0FAKE0002')
				.every((o) => o.titleId === ember)
		).toBe(true);
	});

	it('records a file it could not read, with the reason, and stores nothing from it', async () => {
		const summary = await importReport(
			app.db,
			me,
			'notes.xlsx',
			buildXlsx({ Sheet1: [['hello']] })
		);
		expect(summary).toEqual({
			ok: false,
			error: expect.stringContaining("doesn't look like a KDP royalty report")
		});
		const [latest] = await listImports(app.db, me);
		expect(latest).toMatchObject({ filename: 'notes.xlsx', status: 'failed', remaining: 0 });
	});

	it('deleting an import removes the numbers it brought in', async () => {
		for (const i of await listImports(app.db, me)) await deleteImport(app.db, me, i.id);
		expect(await observations()).toEqual([]);
	});
});
