import { describe, expect, it } from 'vitest';
import { adSettingsSchema, resultsSchema } from './adForms';

describe('adSettingsSchema', () => {
	const parse = (o: Record<string, string>) =>
		adSettingsSchema('USD').safeParse({ targetAcos: '', evalDays: '', evalSpend: '', ...o });

	it('reads a percentage, days, and an amount in the author currency', () => {
		expect(parse({ targetAcos: '120', evalDays: '14', evalSpend: '25.50' }).data).toEqual({
			target_acos: 1.2,
			min_ad_eval_days: 14,
			min_ad_eval_spend_minor: 2550
		});
		expect(parse({ targetAcos: '62.5%' }).data?.target_acos).toBe(0.625);
	});

	it('treats blank as "use the default"', () => {
		expect(parse({}).data).toEqual({
			target_acos: null,
			min_ad_eval_days: null,
			min_ad_eval_spend_minor: null
		});
	});

	it.each([
		[{ targetAcos: 'lots' }, 'Use a percentage like 70.'],
		[{ targetAcos: '0' }, 'Use a percentage like 70.'],
		[{ evalDays: '2.5' }, 'Use whole days, 1 to 365.'],
		[{ evalSpend: 'fifty' }, 'Use an amount like 50.00.']
	])('explains %j', (o, message) => {
		expect(parse(o).error?.issues[0]?.message).toBe(message);
	});
});

describe('resultsSchema', () => {
	it('turns amounts into minor units in the campaign currency', () => {
		expect(
			resultsSchema('JPY').parse({
				periodStart: '2026-09-01',
				periodEnd: '2026-09-30',
				spend: '1200',
				sales: '3000',
				impressions: '',
				clicks: '12'
			})
		).toEqual({
			periodStart: '2026-09-01',
			periodEnd: '2026-09-30',
			spendMinor: 1200,
			salesMinor: 3000,
			impressions: null,
			clicks: 12
		});
	});
});
