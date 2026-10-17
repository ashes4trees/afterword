import { describe, expect, it } from 'vitest';
import { nextSeriesPosition, organizeBooks, releaseCountdown, type BookListItem } from './bookList';

let n = 0;
const book = (fields: Partial<BookListItem>): BookListItem => ({
	id: `b${++n}`,
	workingTitle: `Book ${n}`,
	penName: null,
	seriesId: null,
	seriesTitle: null,
	seriesPosition: null,
	releaseDate: null,
	createdAt: new Date(2026, 0, n),
	...fields
});

const saga = { seriesId: 's1', seriesTitle: 'Saga', penName: 'Ava' };
const arc = { seriesId: 's2', seriesTitle: 'Arc', penName: 'Ava' };

const one = book({ ...saga, workingTitle: 'Saga 1', seriesPosition: 1, releaseDate: '2027-05-01' });
const half = book({
	...saga,
	workingTitle: 'Saga 0.5',
	seriesPosition: 0.5,
	releaseDate: '2027-09-01'
});
const two = book({ ...saga, workingTitle: 'Saga 2', seriesPosition: 2 });
const arc1 = book({ ...arc, workingTitle: 'Arc 1', seriesPosition: 1, releaseDate: '2027-03-01' });
const solo = book({ workingTitle: 'Solo', releaseDate: '2027-01-01' });
const draft = book({ workingTitle: 'Draft' });
const all = [two, solo, arc1, half, draft, one];

const titles = (groups: ReturnType<typeof organizeBooks>) =>
	groups.map((g) => [g.seriesTitle, g.books.map((b) => b.workingTitle)]);

describe('organizeBooks', () => {
	it('groups series alphabetically in reading order, standalones last', () => {
		expect(titles(organizeBooks(all, 'series', true))).toEqual([
			['Arc', ['Arc 1']],
			['Saga', ['Saga 0.5', 'Saga 1', 'Saga 2']],
			[null, ['Solo', 'Draft']]
		]);
	});

	it('by release date: soonest first, undated last, series ordered by their soonest book', () => {
		expect(titles(organizeBooks(all, 'release', true))).toEqual([
			['Arc', ['Arc 1']],
			['Saga', ['Saga 1', 'Saga 0.5', 'Saga 2']],
			[null, ['Solo', 'Draft']]
		]);
	});

	it('by date added: newest first, series ordered by their newest book', () => {
		// Created in declaration order: one, half, two, arc1, solo, draft.
		expect(titles(organizeBooks(all, 'added', true))).toEqual([
			['Arc', ['Arc 1']],
			['Saga', ['Saga 2', 'Saga 0.5', 'Saga 1']],
			[null, ['Draft', 'Solo']]
		]);
	});

	it('ungrouped is one flat list in the chosen order', () => {
		expect(titles(organizeBooks(all, 'release', false))).toEqual([
			[null, ['Solo', 'Arc 1', 'Saga 1', 'Saga 0.5', 'Draft', 'Saga 2']]
		]);
	});

	it('names a pen name for a series only when all its books share it', () => {
		const mixed = book({ ...arc, penName: 'Other', seriesPosition: 2 });
		const groups = organizeBooks([arc1, mixed, one], 'series', true);
		expect(groups.map((g) => g.penName)).toEqual([null, 'Ava']);
	});

	it('returns nothing for no books', () => {
		expect(organizeBooks([], 'series', true)).toEqual([]);
		expect(organizeBooks([], 'series', false)).toEqual([]);
	});
});

describe('nextSeriesPosition', () => {
	it('is the next whole number after the highest position', () => {
		expect(nextSeriesPosition(all, 'saga')).toBe(3);
		expect(nextSeriesPosition([half], 'Saga')).toBe(1);
	});

	it('starts at 1 for a series with no positioned books', () => {
		expect(nextSeriesPosition(all, 'New series')).toBe(1);
	});
});

describe('releaseCountdown', () => {
	it.each([
		['2026-10-17', 'today'],
		['2026-10-18', 'tomorrow'],
		['2026-10-26', 'in 9 days'],
		['2026-11-14', 'in 4 weeks'],
		['2027-02-07', 'in 4 months'],
		['2026-10-16', 'Released']
	])('%s → %s', (date, expected) => {
		expect(releaseCountdown(date, '2026-10-17')).toBe(expected);
	});
});
