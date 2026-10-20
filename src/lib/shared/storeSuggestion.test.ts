import { describe, expect, it } from 'vitest';
import { describeSuggestion, suggestStores, type StoreHistory } from './storeSuggestion';

const history: StoreHistory = [
	{ title: 'Ember Road', penName: 'A. Vale', addedAt: '2026-01-01T00:00:00Z', stores: ['kdp'] },
	{
		title: 'Salt Lantern',
		penName: 'A. Vale',
		addedAt: '2026-03-01T00:00:00Z',
		stores: ['kdp', 'kobo']
	},
	{ title: 'Drafty', penName: 'A. Vale', addedAt: '2026-05-01T00:00:00Z', stores: [] },
	{ title: 'Glass Archive', penName: null, addedAt: '2026-04-01T00:00:00Z', stores: ['ingram'] }
];

describe('suggestStores', () => {
	it('1. uses default stores when the author chose them, even none', () => {
		expect(suggestStores({ defaults: ['apple'], penName: 'A. Vale', history })).toEqual({
			stores: ['apple'],
			source: { kind: 'default' }
		});
		expect(suggestStores({ defaults: [], penName: null, history }).stores).toEqual([]);
	});

	it('2. otherwise copies the latest book with listings under the same pen name, any case', () => {
		expect(suggestStores({ defaults: null, penName: ' a. vale ', history })).toEqual({
			stores: ['kdp', 'kobo'],
			source: { kind: 'book', title: 'Salt Lantern' }
		});
	});

	it('3. otherwise copies the latest book with listings under any pen name', () => {
		for (const penName of [null, '', 'Someone New']) {
			expect(suggestStores({ defaults: null, penName, history }).source).toEqual({
				kind: 'book',
				title: 'Glass Archive'
			});
		}
	});

	it('4. otherwise ticks nothing', () => {
		expect(suggestStores({ defaults: null, penName: 'A. Vale', history: [] })).toEqual({
			stores: [],
			source: null
		});
	});

	it('says where the suggestion came from', () => {
		expect(describeSuggestion({ kind: 'default' })).toBe('Your default stores');
		expect(describeSuggestion({ kind: 'book', title: 'Salt Lantern' })).toBe(
			'Same as “Salt Lantern”'
		);
		expect(describeSuggestion(null)).toBeNull();
	});
});
