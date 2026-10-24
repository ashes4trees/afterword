import { describe, expect, it } from 'vitest';
import { parseEdits, ratePer1000 } from './exclusivityForm';

const parse = (q: Record<string, string>, currency = 'USD') =>
	parseEdits((n) => q[n] ?? null, currency);

describe('parseEdits', () => {
	it('reads amounts, pages, the KU rate per 1,000 pages, and a percentage', () => {
		expect(
			parse({ amazon: '300', pages: '40,000', rate: '4.50', ku: '10', wide: '50.00', direct: '0' })
				.edits
		).toEqual({
			amazonMinor: 30000,
			kenpPages: 40000,
			kenpRate: 0.45,
			kuReadersWhoBuy: 0.1,
			wideMinor: 5000,
			directMinor: 0
		});
	});

	it('ignores blank fields, and reports bad ones instead of guessing', () => {
		const r = parse({ amazon: '', rate: 'cheap', ku: '150' });
		expect(r.edits).toEqual({});
		expect(r.problems).toEqual([
			'KU rate: use an amount per 1,000 pages, like 4.50.',
			'KU readers who buy: use a percentage from 0 to 100.'
		]);
		expect(r.values).toEqual({ rate: 'cheap', ku: '150' });
	});

	it('shows a rate back per 1,000 pages', () => {
		expect(ratePer1000(0.45, 'USD')).toBe('4.50');
	});
});
