// Test-only: rows in the tenant tables that have no service yet, so tests that need a
// row in every tenant table (export, account deletion) stay complete. Add to this when a
// new tenant table lands. App code must not import this.
import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import { insertCampaign, insertReview } from '$lib/server/repo/campaigns';

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
	});
}
