import { describe, expect, it } from 'vitest';
import { modelExclusivity, type ExclusivityInputs, type HistoryRow } from './exclusivity';

const row = (o: Partial<HistoryRow>): HistoryRow => ({
	channel: 'kdp',
	format: 'ebook',
	metric: 'royalty_minor',
	value: 0,
	currency: 'USD',
	periodStart: '2026-07-01',
	...o
});

// Hand-worked: three months of a book in Select.
//   Amazon ebook royalties $300 + $330 + $270 = $900, so $300.00 a month.
//   KENP pages 100k + 120k + 80k = 300k, so 100k a month; at 0.45¢ a page, $450.00.
//   Ad spend $60 a month. No other stores or direct sales yet (it's been exclusive).
const history: HistoryRow[] = [
	row({ value: 30000, periodStart: '2026-07-01' }),
	row({ value: 33000, periodStart: '2026-08-01' }),
	row({ value: 27000, periodStart: '2026-09-01' }),
	row({ metric: 'kenp_pages', value: 100000, periodStart: '2026-07-01' }),
	row({ metric: 'kenp_pages', value: 120000, periodStart: '2026-08-01' }),
	row({ metric: 'kenp_pages', value: 80000, periodStart: '2026-09-01' }),
	row({ metric: 'ad_spend_minor', value: 18000, periodStart: '2026-08-01' }),
	// Left out: paperback, outside the period, and another currency.
	row({ format: 'paperback', value: 99999, periodStart: '2026-08-01' }),
	row({ value: 99999, periodStart: '2026-05-01' }),
	row({ value: 5000, currency: 'GBP', periodStart: '2026-08-01' })
];

const base: ExclusivityInputs = {
	currency: 'USD',
	from: '2026-07-01',
	to: '2026-09-30',
	months: 3,
	history,
	kenpRate: { value: 0.45, basis: 'default' },
	kuReadersWhoBuy: { value: 0.1, basis: 'default' },
	commitment: { until: '2026-11-15' },
	today: '2026-10-24'
};

const monthly = (m: ReturnType<typeof modelExclusivity>) =>
	Object.fromEntries(m.scenarios.map((s) => [s.key, s.monthlyMinor]));

describe('modelExclusivity', () => {
	it("models each option from the author's own history", () => {
		const m = modelExclusivity(base);
		// Select: $300 sales + $450 KU. Wide: $300 + 10% of KU ($45) + $0 elsewhere.
		expect(monthly(m)).toEqual({ select: 75000, wide: 34500, wide_direct: 34500 });
		expect(m.scenarios[0]!.parts).toEqual([
			{ label: 'Amazon ebook sales', minor: 30000 },
			{ label: 'Kindle Unlimited pages read', minor: 45000 }
		]);
	});

	it("uses the author's own estimates for stores with no history", () => {
		const m = modelExclusivity({ ...base, estimates: { wideMinor: 20000, directMinor: 5000 } });
		expect(monthly(m)).toEqual({ select: 75000, wide: 54500, wide_direct: 59500 });
		expect(m.assumptions.find((a) => a.key === 'wide_monthly')).toMatchObject({
			value: '$200.00 a month',
			basis: 'author'
		});
	});

	it('returns every assumption, flags the understated ones, and says which can be edited', () => {
		const m = modelExclusivity(base);
		const byKey = Object.fromEntries(m.assumptions.map((a) => [a.key, a]));
		expect(byKey.kenp_rate).toMatchObject({ basis: 'default', editable: true });
		expect(byKey.kenp_rate!.value).toContain('$4.50 per 1,000 pages');
		expect(byKey.kenp_rate!.value).toContain('one blended rate for USD');
		expect(byKey.wide_monthly!.value).toBe('$0.00 a month (no history, so likely understated)');
		expect(byKey.ad_spend).toMatchObject({ value: '$60.00 a month', editable: false });
		expect(byKey.amazon_sales).toMatchObject({ value: '$300.00 a month', basis: 'history' });
		expect(byKey.kenp_pages!.value).toBe('100,000 a month');
		expect(Object.keys(byKey)).toEqual([
			'period',
			'kenp_rate',
			'amazon_sales',
			'kenp_pages',
			'ku_readers_who_buy',
			'wide_monthly',
			'direct_monthly',
			'ad_spend',
			'prices',
			'scope'
		]);
	});

	it('surfaces the Select term as a commitment, and when wide could start', () => {
		const m = modelExclusivity(base);
		expect(m.commitment).toMatchObject({ until: '2026-11-15', daysLeft: 22 });
		expect(m.commitment!.note).toContain('Turn off auto-renew');
		expect(m.scenarios.map((s) => [s.key, s.earliestStart])).toEqual([
			['select', '2026-10-24'],
			['wide', '2026-11-16'],
			['wide_direct', '2026-11-16']
		]);
		const free = modelExclusivity({ ...base, commitment: null });
		expect(free.commitment).toBeNull();
		expect(free.scenarios.every((s) => s.earliestStart === '2026-10-24')).toBe(true);
		const lapsed = modelExclusivity({ ...base, commitment: { until: '2026-10-01' } });
		expect(lapsed.commitment).toBeNull();
	});

	it('leaves other currencies out rather than converting them', () => {
		expect(modelExclusivity(base).excluded).toEqual([{ currency: 'GBP', rows: 1 }]);
	});

	it('responds to the author changing an assumption', () => {
		const m = modelExclusivity({
			...base,
			kenpRate: { value: 0.4, basis: 'author' },
			kuReadersWhoBuy: { value: 0, basis: 'author' }
		});
		expect(monthly(m)).toEqual({ select: 70000, wide: 30000, wide_direct: 30000 });
	});

	it("uses the author's own sales and pages for a book with no history yet", () => {
		const m = modelExclusivity({
			...base,
			history: [],
			estimates: { amazonMinor: 20000, kenpPages: 50000 }
		});
		// Select: $200 + 50k pages at 0.45¢ ($225). Wide: $200 + 10% of $225.
		expect(monthly(m)).toEqual({ select: 42500, wide: 22250, wide_direct: 22250 });
		expect(m.assumptions.find((a) => a.key === 'kenp_pages')).toMatchObject({ basis: 'author' });
	});
});
