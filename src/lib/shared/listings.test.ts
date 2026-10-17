import { describe, expect, it } from 'vitest';
import {
	bookFormats,
	matrixCells,
	matrixChannels,
	selectObligation,
	statusCounts,
	type MatrixListing
} from './listings';

const channels = [
	{ slug: 'kdp', displayName: 'Amazon KDP' },
	{ slug: 'kobo', displayName: 'Kobo Writing Life' },
	{ slug: 'ingram', displayName: 'IngramSpark' }
];

const listing = (fields: Partial<MatrixListing>): MatrixListing => ({
	titleId: 't1',
	channelSlug: 'kdp',
	format: 'ebook',
	marketplace: null,
	status: 'live',
	enrolledInSelect: false,
	exclusivityEnd: null,
	...fields
});

describe('matrixChannels', () => {
	it('shows every channel unless hidden, in reference order', () => {
		expect(matrixChannels(channels, [])).toEqual(channels);
		expect(matrixChannels(channels, ['kobo']).map((c) => c.slug)).toEqual(['kdp', 'ingram']);
	});

	it('never hides every column', () => {
		expect(matrixChannels(channels, ['kdp', 'kobo', 'ingram'])).toEqual(channels);
	});

	it('can show only channels in use, within the chosen ones', () => {
		const ls = [listing({ channelSlug: 'kobo' }), listing({ channelSlug: 'ingram' })];
		expect(matrixChannels(channels, [], true, ls).map((c) => c.slug)).toEqual(['kobo', 'ingram']);
		expect(matrixChannels(channels, ['ingram'], true, ls).map((c) => c.slug)).toEqual(['kobo']);
	});

	it('falls back to the chosen channels when none are in use', () => {
		expect(matrixChannels(channels, ['kobo'], true, []).map((c) => c.slug)).toEqual([
			'kdp',
			'ingram'
		]);
	});
});

describe('matrixCells', () => {
	it('prefers the default listing and counts the other marketplaces', () => {
		const ls = [
			listing({ marketplace: 'GB', status: 'in_review' }),
			listing({ status: 'live' }),
			listing({ marketplace: 'CA', status: 'submitted' }),
			listing({ titleId: 't2', status: 'unpublished' })
		];
		const [kdp, kobo] = matrixCells('t1', 'ebook', channels, ls);
		expect(kdp).toMatchObject({ status: 'live', extraMarkets: 2 });
		expect(kobo).toMatchObject({ status: 'none', listing: null, extraMarkets: 0 });
	});

	it('falls back to a marketplace listing when there is no default', () => {
		const [kdp] = matrixCells('t1', 'ebook', channels, [
			listing({ marketplace: 'US', status: 'submitted' })
		]);
		expect(kdp).toMatchObject({ status: 'submitted', extraMarkets: 0 });
	});
});

describe('statusCounts', () => {
	it('counts each state, including not listed', () => {
		const cells = matrixCells('t1', 'ebook', channels, [
			listing({}),
			listing({ channelSlug: 'kobo', status: 'live' })
		]);
		expect(statusCounts(cells)).toMatchObject({ live: 2, none: 1, in_review: 0 });
	});
});

describe('selectObligation', () => {
	it('reports an enrollment and its end date', () => {
		expect(
			selectObligation(listing({ enrolledInSelect: true, exclusivityEnd: '2027-03-03' }))
		).toEqual({
			until: '2027-03-03'
		});
		expect(selectObligation(listing({}))).toBeNull();
		expect(selectObligation(null)).toBeNull();
	});
});

describe('per-format cells (#72)', () => {
	const stores = [
		{ slug: 'kdp', displayName: 'Amazon KDP' },
		{ slug: 'acx', displayName: 'Audible (ACX)' }
	];

	it('marks cells for formats a store does not sell', () => {
		const ebook = matrixCells('t1', 'ebook', stores, []);
		expect(ebook.map((c) => c.sold)).toEqual([true, false]);
		const audio = matrixCells('t1', 'audiobook', stores, []);
		expect(audio.map((c) => c.sold)).toEqual([false, true]);
	});

	it('keeps formats separate on the same store', () => {
		const ls = [
			listing({ format: 'ebook', status: 'live' }),
			listing({ format: 'paperback', status: 'in_review' })
		];
		expect(matrixCells('t1', 'ebook', stores, ls)[0]!.status).toBe('live');
		expect(matrixCells('t1', 'paperback', stores, ls)[0]!.status).toBe('in_review');
	});

	it('does not count unsold cells in the legend', () => {
		expect(statusCounts(matrixCells('t1', 'ebook', stores, [])).none).toBe(1);
	});

	it('gives a book rows for its formats plus any format that still has listings', () => {
		const book = { id: 't1', formats: ['paperback', 'ebook'] as ('ebook' | 'paperback')[] };
		expect(bookFormats(book, [])).toEqual(['ebook', 'paperback']);
		expect(
			bookFormats({ ...book, formats: ['ebook'] }, [listing({ format: 'hardcover' })])
		).toEqual(['ebook', 'hardcover']);
	});
});
