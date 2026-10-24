import { describe, expect, it } from 'vitest';
import { parseRules } from '$lib/server/content/rules';
import { evaluateRule, resolveThresholds } from './rules';
import spec from '../../../../content/rules/ad.kill.underperforming.yaml?raw';

const [rule] = parseRules({ '/content/rules/ad.kill.underperforming.yaml': spec }, '2026-10-24');
const kill = rule!;

describe('resolveThresholds', () => {
	it("uses the author's own settings, the rule's defaults for the rest, and multiples", () => {
		expect(resolveThresholds(kill, {})).toEqual({
			min_days: 30,
			min_spend_minor: 5000,
			acos_ceiling: 0.7,
			kill_acos: 1.4
		});
		expect(resolveThresholds(kill, { target_acos: 1.2, min_ad_eval_days: 14 })).toEqual({
			min_days: 14,
			min_spend_minor: 5000,
			acos_ceiling: 1.2,
			kill_acos: 2.4
		});
	});
});

describe('evaluateRule', () => {
	// $120 spent, $50 in sales: ACOS 240%.
	const campaign = { ad_spend_minor: 12000, ad_sales_minor: 5000, days_live: 35 };

	it('serves a $5-a-day author and an $80-a-day one with the same rule', () => {
		const small = { min_ad_eval_spend_minor: 10000 };
		const big = { min_ad_eval_spend_minor: 200000 };
		// Enough data for the small budget, not for the big one.
		expect(evaluateRule(kill, campaign, small, 'USD').applies).toBe(true);
		expect(evaluateRule(kill, campaign, big, 'USD').applies).toBe(false);
	});

	it('explains itself deterministically from the inputs', () => {
		const result = evaluateRule(kill, campaign, {}, 'USD');
		expect(result).toMatchObject({
			ruleId: 'ad.kill.underperforming',
			verdict: 'kill',
			applies: true
		});
		expect(result.explanation).toBe(
			'Consider stopping it. Live 35 days, $120.00 spent, $50.00 in sales: ACOS 240%, more than double your 70% target.'
		);
		expect(evaluateRule(kill, campaign, {}, 'USD')).toEqual(result);
		expect(evaluateRule(kill, campaign, {}, 'GBP').explanation).toContain('£120.00 spent');
	});

	it('honours an author who accepts a higher ACOS', () => {
		expect(evaluateRule(kill, campaign, { target_acos: 1.5 }, 'USD').applies).toBe(false);
	});

	it('does not judge a campaign that has not run long enough', () => {
		expect(evaluateRule(kill, { ...campaign, days_live: 10 }, {}, 'USD').applies).toBe(false);
	});

	it('kills spend with no sales at all, showing ACOS as a dash', () => {
		const result = evaluateRule(kill, { ...campaign, ad_sales_minor: 0 }, {}, 'USD');
		expect(result.applies).toBe(true);
		expect(result.explanation).toContain('ACOS —');
	});

	it('reports missing inputs instead of guessing', () => {
		const result = evaluateRule(kill, { ad_spend_minor: 12000 }, {}, 'USD');
		expect(result).toMatchObject({
			applies: false,
			missing: ['ad_sales_minor', 'days_live'],
			explanation: null
		});
	});
});
