import { eq } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authors } from '$lib/server/db/schema';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { CampaignInputSchema, resultsSchema } from '$lib/shared/adForms';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import {
	adSettings,
	adsOverview,
	saveAdSettings,
	campaignDetail,
	deleteCampaign,
	deleteResults,
	recordResults,
	reviewNow,
	saveCampaign
} from './ads';
import { createBook } from './books';

describe.skipIf(!hasDatabase)('Ads page (#122)', () => {
	const tag = crypto.randomUUID();
	const TODAY = '2026-10-05';
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let other: SessionAuthor;
	let book: string;
	let campaign: string;
	const results = (o: Record<string, string>) =>
		resultsSchema('USD').parse({ impressions: '', clicks: '', ...o });

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		[me, other] = (await owner.db
			.insert(authors)
			.values([
				{ email: `ads-svc-${tag}@example.test`, displayName: 'A' },
				{ email: `ads-svc-other-${tag}@example.test`, displayName: 'B' }
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

	it('adds a campaign from the form', async () => {
		const input = CampaignInputSchema.parse({
			titleId: book,
			channelSlug: 'kdp',
			marketplace: 'us',
			name: 'Auto, broad',
			campaignType: 'sponsored_products',
			targetingKind: 'auto',
			status: 'enabled',
			budget: '5.00',
			currency: 'USD',
			startedAt: '2026-09-01',
			endedAt: ''
		});
		campaign = (await saveCampaign(app.db, me, null, input))!;
		const [row] = await adsOverview(app.db, me);
		expect(row).toMatchObject({
			bookTitle: 'The Salt Lantern',
			verdict: null,
			campaign: { marketplace: 'US', dailyBudgetMinor: 500 }
		});
	});

	it('says too young until there is enough to judge', async () => {
		await recordResults(
			app.db,
			me,
			campaign,
			results({ periodStart: '2026-09-01', periodEnd: '2026-09-07', spend: '12.00', sales: '0' })
		);
		const review = await reviewNow(app.db, me, campaign, TODAY);
		expect(review).toMatchObject({ verdict: 'too_young', ruleId: 'ad.too_young' });
	});

	it('recommends stopping a campaign that has spent enough with no return, with no model call', async () => {
		await recordResults(
			app.db,
			me,
			campaign,
			results({
				periodStart: '2026-09-08',
				periodEnd: '2026-09-30',
				spend: '88.00',
				sales: '30.00'
			})
		);
		const review = await reviewNow(app.db, me, campaign, TODAY);
		expect(review).toMatchObject({ verdict: 'kill' });
		expect(review!.explanation).toBe(
			'Consider stopping it. Live 35 days, $100.00 spent, $30.00 in sales: ACOS 333%, more than double your 70% target.'
		);
		const detail = (await campaignDetail(app.db, me, campaign))!;
		expect(detail.reviews.map((r) => r.verdict)).toEqual(['kill', 'too_young']);
		expect(detail.results.map((r) => [r.periodStart, r.spendMinor, r.salesMinor])).toEqual([
			['2026-09-01', 1200, 0],
			['2026-09-08', 8800, 3000]
		]);
		expect((await adsOverview(app.db, me))[0]!.verdict).toBe('kill');
	});

	it("uses the author's own target ACOS from Settings, and the default again once cleared", async () => {
		await saveAdSettings(app.db, me, {
			target_acos: 3,
			min_ad_eval_days: null,
			min_ad_eval_spend_minor: null
		});
		expect(await adSettings(app.db, me)).toMatchObject({ targetAcos: 3, evalDays: null });
		expect((await reviewNow(app.db, me, campaign, TODAY))!.verdict).toBe('lower');
		await saveAdSettings(app.db, me, {
			target_acos: null,
			min_ad_eval_days: null,
			min_ad_eval_spend_minor: null
		});
		expect((await adSettings(app.db, me)).targetAcos).toBeNull();
		expect((await reviewNow(app.db, me, campaign, TODAY))!.verdict).toBe('kill');
	});

	it('replaces a period recorded twice, and removes one on request', async () => {
		await recordResults(
			app.db,
			me,
			campaign,
			results({
				periodStart: '2026-09-08',
				periodEnd: '2026-09-30',
				spend: '20.00',
				sales: '60.00',
				clicks: '40'
			})
		);
		let detail = (await campaignDetail(app.db, me, campaign))!;
		expect(detail.results[1]).toMatchObject({ spendMinor: 2000, salesMinor: 6000, clicks: 40 });
		expect(await deleteResults(app.db, me, campaign, '2026-09-08', '2026-09-30')).toBe(true);
		detail = (await campaignDetail(app.db, me, campaign))!;
		expect(detail.results).toHaveLength(1);
	});

	it('keeps campaigns private, and deletes them with their results and reviews', async () => {
		expect(await campaignDetail(app.db, other, campaign)).toBeNull();
		expect(await reviewNow(app.db, other, campaign, TODAY)).toBeNull();
		expect(await deleteCampaign(app.db, me, campaign)).toBe(true);
		expect(await adsOverview(app.db, me)).toEqual([]);
	});
});
