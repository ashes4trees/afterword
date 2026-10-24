import { describe, expect, it } from 'vitest';
import { RULES } from '$lib/server/content/rulePacks';
import { campaignTotals, daysLive, reviewCampaign, type AdObservation } from './campaigns';

// The real rule packs. Defaults: judge after 30 days and $50 spent; target ACOS 70%, so
// kill above 140%, pause above 87.5%, lower above 70%, raise below 35%, otherwise keep.
const TODAY = '2026-10-05';
const live35 = { startedAt: '2026-09-01', endedAt: null, currency: 'USD' };

const obs = (spend: number, sales: number, o: Partial<AdObservation> = {}): AdObservation[] => [
	{
		metric: 'ad_spend_minor',
		value: spend,
		currency: 'USD',
		periodStart: '2026-09-01',
		periodEnd: '2026-09-30',
		...o
	},
	{
		metric: 'ad_sales_minor',
		value: sales,
		currency: 'USD',
		periodStart: '2026-09-01',
		periodEnd: '2026-09-30',
		...o
	}
];
const verdict = (spend: number, sales: number, stored = {}, campaign = live35) =>
	reviewCampaign(campaign, obs(spend, sales), stored, TODAY, RULES).verdict;

describe('reviewCampaign', () => {
	it('says too_young, with what it still needs, rather than staying silent', () => {
		const young = { ...live35, startedAt: '2026-09-26' };
		const review = reviewCampaign(young, obs(3000, 0), {}, TODAY, RULES);
		expect(review).toMatchObject({ verdict: 'too_young', ruleId: 'ad.too_young' });
		expect(review.explanation).toBe(
			'Too early to judge: 10 days and $30.00 spent so far. Give it at least 30 days and $50.00 before deciding.'
		);
		expect(verdict(4999, 0)).toBe('too_young');
	});

	it.each([
		['kill', 15000, 10000],
		['pause', 10000, 10000],
		['lower', 8000, 10000],
		['keep', 5000, 10000],
		['raise', 6000, 20000],
		['kill', 6000, 0]
	])('%s at spend %i, sales %i', (expected, spend, sales) => {
		expect(verdict(spend, sales)).toBe(expected);
	});

	it.each([
		[
			'exactly 30 days and $50 is enough to judge',
			5000,
			10000,
			'keep',
			{ ...live35, startedAt: '2026-09-06' }
		],
		['exactly double the target is a pause, not a kill', 14000, 10000, 'pause', live35],
		['exactly 87.5% is lower, not pause', 8750, 10000, 'lower', live35],
		['exactly on target is keep', 7000, 10000, 'keep', live35],
		['exactly half the target is keep, not raise', 7000, 20000, 'keep', live35]
	])('boundary: %s', (_label, spend, sales, expected, campaign) => {
		expect(verdict(spend, sales, {}, campaign)).toBe(expected);
	});

	it("moves every band with the author's own target ACOS", () => {
		// 150% ACOS: a kill at a 70% target, only a "lower" for an author who accepts 120%.
		expect(verdict(15000, 10000)).toBe('kill');
		expect(verdict(15000, 10000, { target_acos: 1.2 })).toBe('lower');
	});

	it('returns the rule, its version, and every input behind the verdict', () => {
		const review = reviewCampaign(live35, obs(15000, 10000), {}, TODAY, RULES);
		expect(review).toMatchObject({ ruleId: 'ad.kill.underperforming', ruleVersion: 2 });
		expect(review.inputs).toMatchObject({
			ad_spend_minor: 15000,
			ad_sales_minor: 10000,
			days_live: 35,
			acos: 1.5,
			kill_acos: 1.4
		});
		expect(review.explanation).toBe(
			'Consider stopping it. Live 35 days, $150.00 spent, $100.00 in sales: ACOS 150%, more than double your 70% target.'
		);
	});

	it('gives explanations that stand on their own for every verdict', () => {
		for (const [spend, sales] of [
			[15000, 10000],
			[10000, 10000],
			[8000, 10000],
			[5000, 10000],
			[6000, 20000]
		]) {
			const text = reviewCampaign(live35, obs(spend!, sales!), {}, TODAY, RULES).explanation;
			expect(text).toMatch(/^(Consider|Keep)/);
			expect(text).not.toMatch(/\{|undefined|NaN/);
		}
	});
});

describe('campaign inputs', () => {
	it('counts days live including the first, stopping at the end date', () => {
		expect(daysLive(live35, TODAY)).toBe(35);
		expect(daysLive({ ...live35, endedAt: '2026-09-10' }, TODAY)).toBe(10);
		expect(daysLive({ ...live35, startedAt: '2026-11-01' }, TODAY)).toBe(0);
	});

	it('only counts observations in the campaign currency and its running period', () => {
		const totals = campaignTotals(
			live35,
			[
				...obs(5000, 9000),
				...obs(9999, 9999, { currency: 'GBP' }),
				...obs(7777, 7777, { periodStart: '2026-07-01', periodEnd: '2026-07-31' })
			],
			TODAY
		);
		expect(totals).toEqual({ ad_spend_minor: 5000, ad_sales_minor: 9000 });
	});
});
