import { eq } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authors } from '$lib/server/db/schema';
import { withAuthor } from '$lib/server/db/tenant';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { createImport, insertObservations } from '$lib/server/repo/imports';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import { createBook } from './books';
import { decisionLog } from './decisions';
import { chooseOption, historyWindow, selectVsWide } from './exclusivity';
import { saveListing } from './listings';

const TODAY = '2026-10-24';

describe('historyWindow', () => {
	it('is the last whole months before this one', () => {
		expect(historyWindow(TODAY, 3)).toEqual({ from: '2026-07-01', to: '2026-09-30' });
		expect(historyWindow('2026-01-15', 2)).toEqual({ from: '2025-11-01', to: '2025-12-31' });
	});
});

describe.skipIf(!hasDatabase)('Select or wide (#25)', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let book: string;

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		const [a] = await owner.db
			.insert(authors)
			.values({ email: `sw-${tag}@example.test`, displayName: 'S' })
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName });
		me = a!;
		book = await createBook(
			app.db,
			me,
			TitleInputSchema.parse({ ...EMPTY_TITLE_FORM, workingTitle: 'The Salt Lantern' })
		);
		await withAuthor(app.db, me.id, async (tx) => {
			const id = await createImport(tx, me.id, {
				channelSlug: 'kdp',
				kind: 'kdp_report',
				filename: 'q3.xlsx'
			});
			const row = (metric: 'royalty_minor' | 'kenp_pages', value: number, periodStart: string) => ({
				titleId: book,
				format: 'ebook' as const,
				channelSlug: 'kdp',
				marketplace: 'US',
				currency: 'USD',
				metric,
				value,
				periodStart,
				periodEnd: periodStart.replace(/01$/, '28')
			});
			await insertObservations(tx, me.id, id, [
				row('royalty_minor', 30000, '2026-07-01'),
				row('royalty_minor', 30000, '2026-08-01'),
				row('royalty_minor', 30000, '2026-09-01'),
				row('kenp_pages', 100000, '2026-08-01'),
				row('kenp_pages', 200000, '2026-09-01')
			]);
		});
		await saveListing(app.db, me, book, 'kdp', 'ebook', null, {
			status: 'live',
			externalId: null,
			priceMinor: null,
			currency: null,
			enrolledInSelect: true,
			exclusivityStart: '2026-10-01',
			exclusivityEnd: '2026-12-29',
			wholesaleDiscountPct: null,
			returnable: null
		});
	});

	afterAll(async () => {
		if (me) await owner.db.delete(authors).where(eq(authors.id, me.id));
		await app?.client.end();
		await owner?.client.end();
	});

	it('models the book from its history, the dated defaults, and the current Select term', async () => {
		const r = (await selectVsWide(app.db, me, book, TODAY))!;
		expect(r.hasHistory).toBe(true);
		expect(r.needsRate).toBe(false);
		// $300 a month in sales; 300k pages over 3 months = 100k a month at the 0.45¢ default.
		expect(r.model.scenarios.map((s) => [s.key, s.monthlyMinor])).toEqual([
			['select', 75000],
			['wide', 30000],
			['wide_direct', 30000]
		]);
		expect(r.model.commitment).toMatchObject({ until: '2026-12-29', daysLeft: 66 });
	});

	it('lets the author test their own beliefs', async () => {
		const r = (await selectVsWide(app.db, me, book, TODAY, {
			wideMinor: 60000,
			kuReadersWhoBuy: 0.2
		}))!;
		expect(r.model.scenarios.map((s) => s.monthlyMinor)).toEqual([75000, 99000, 99000]);
	});

	it('logs the choice as a decision with the numbers behind it', async () => {
		expect(
			await chooseOption(app.db, me, book, 'select', 'KU readers love this series', TODAY)
		).toBe(true);
		const [d] = (await decisionLog(app.db, me, book)).filter((x) => x.kind === 'distribution');
		expect(d).toMatchObject({
			choice: 'Stay in (or enroll in) KDP Select',
			rationale: 'KU readers love this series',
			commitsUntil: '2026-12-29'
		});
		expect(d!.assumptions).toMatchObject({
			select_total_minor: 75000,
			wide_total_minor: 30000,
			wide_monthly: '$0.00 a month (no history, so likely understated)',
			currency: 'USD'
		});
	});
});
