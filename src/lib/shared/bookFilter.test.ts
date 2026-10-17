import { describe, expect, it } from 'vitest';
import {
	NONE,
	bookFilterFields,
	fold,
	isFiltered,
	matchesBook,
	parseBookFilter,
	type BookFilter,
	type FilterableBook
} from './bookFilter';

const book = (fields: Partial<FilterableBook>): FilterableBook => ({
	workingTitle: 'Untitled',
	penName: null,
	seriesTitle: null,
	genre: null,
	subgenre: null,
	tropes: [],
	stage: 'metadata',
	...fields
});

const none: BookFilter = { q: '', pen: null, series: null, stage: null };
const spy = book({
	workingTitle: 'The Glass Archive',
	penName: 'Ava Marlowe',
	seriesTitle: 'Harbor Lights',
	genre: 'Romance',
	subgenre: 'historical fantasy romance',
	tropes: ['secret identity', 'kidnapping']
});
const gothic = book({
	workingTitle: 'Hollow House',
	genre: 'Horror',
	subgenre: 'Gothic',
	stage: 'preorder'
});

describe('matchesBook', () => {
	it('matches everything with no filter', () => {
		expect(matchesBook(spy, none)).toBe(true);
	});

	it.each([
		['title', 'glass'],
		['series', 'harbor'],
		['pen name', 'marlowe'],
		['genre', 'ROMANCE'],
		['subgenre', 'fantasy'],
		['a trope', 'kidnap'],
		['several words across fields', 'secret marlowe']
	])('searches %s', (_label, q) => {
		expect(matchesBook(spy, { ...none, q })).toBe(true);
	});

	it('requires every word to match', () => {
		expect(matchesBook(spy, { ...none, q: 'glass horror' })).toBe(false);
	});

	it('ignores accents', () => {
		expect(matchesBook(book({ workingTitle: 'Anaïs Returns' }), { ...none, q: 'anais' })).toBe(
			true
		);
		expect(fold('Café')).toBe('cafe');
	});

	it('filters by pen name, series, and stage, including "has none"', () => {
		expect(matchesBook(spy, { ...none, pen: 'ava marlowe' })).toBe(true);
		expect(matchesBook(gothic, { ...none, pen: 'Ava Marlowe' })).toBe(false);
		expect(matchesBook(gothic, { ...none, pen: NONE })).toBe(true);
		expect(matchesBook(spy, { ...none, series: NONE })).toBe(false);
		expect(matchesBook(gothic, { ...none, stage: 'preorder' })).toBe(true);
		expect(matchesBook(spy, { ...none, stage: 'preorder' })).toBe(false);
	});
});

describe('parseBookFilter', () => {
	it('reads the URL and ignores an unknown stage', () => {
		const f = parseBookFilter(new URLSearchParams('q=heist&pen=Ava&stage=drafting'));
		expect(f).toEqual({ q: 'heist', pen: 'Ava', series: null, stage: null });
		expect(isFiltered(f)).toBe(true);
		expect(isFiltered(parseBookFilter(new URLSearchParams('sort=release')))).toBe(false);
	});
});

describe('bookFilterFields', () => {
	it('offers only fields with a real choice, with "none" options where some books lack one', () => {
		const fields = bookFilterFields([spy, gothic]);
		expect(fields.map((f) => [f.param, f.options.map((o) => o.label)])).toEqual([
			['pen', ['Ava Marlowe', 'No pen name']],
			['series', ['Harbor Lights', 'Standalones']],
			['stage', ['Metadata', 'Preorder']]
		]);
	});

	it('hides a field when every book has the same value', () => {
		expect(bookFilterFields([spy, { ...spy, workingTitle: 'Two' }])).toEqual([]);
	});

	it('merges values that differ only in case', () => {
		const fields = bookFilterFields([spy, { ...spy, penName: 'ava marlowe' }, gothic]);
		expect(fields[0]!.options.map((o) => o.label)).toEqual(['Ava Marlowe', 'No pen name']);
	});
});
