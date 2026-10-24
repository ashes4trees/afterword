// Test-only: rows in the tenant tables that have no service yet, so tests that need a
// row in every tenant table (export, account deletion) stay complete. Add to this when a
// new tenant table lands. App code must not import this.
import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import { insertCampaign, insertReview } from '$lib/server/repo/campaigns';
import { createImport, finishImport, insertObservations } from '$lib/server/repo/imports';

export async function addMetricFixtures(db: Executor, authorId: string, titleId: string) {
	await withAuthor(db, authorId, async (tx) => {
		const campaign = await insertCampaign(tx, authorId, {
			titleId,
			channelSlug: 'kdp',
			marketplace: 'US',
			name: 'Auto, broad',
			campaignType: 'sponsored_products',
			targetingKind: 'auto',
			dailyBudgetMinor: 500,
			currency: 'USD',
			startedAt: '2026-09-01'
		});
		await insertReview(tx, authorId, {
			campaignId: campaign,
			verdict: 'kill',
			ruleId: 'ad.kill.underperforming',
			ruleVersion: 1,
			inputs: { days_live: 35, ad_spend_minor: 12000, ad_sales_minor: 9000 },
			explanation:
				'Live 35 days, $120.00 spent, $90.00 attributed, ACOS 133% against your 70% target.'
		});
		const report = await createImport(tx, authorId, {
			channelSlug: 'kdp',
			kind: 'kdp_report',
			filename: 'KDP_Royalties_2026-09.xlsx'
		});
		await insertObservations(tx, authorId, report, [
			{
				titleId,
				externalId: 'B0FIXTURE1',
				format: 'ebook',
				channelSlug: 'kdp',
				marketplace: 'US',
				currency: 'USD',
				metric: 'royalty_minor',
				value: 4180,
				periodStart: '2026-09-01',
				periodEnd: '2026-09-30'
			}
		]);
		await finishImport(tx, authorId, report, { rowCount: 1 });
	});
}
