import { describe, expect, it } from 'vitest';
import {
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
	marketplace: null,
	status: 'live',
	enrolledInSelect: false,
	exclusivityEnd: null,
	...fields
});

describe('matrixChannels', () => {
	it('shows every channel to an author with no listings', () => {
		expect(matrixChannels(channels, [], [], false)).toEqual(channels);
	});

	it('shows channels in use plus defaults, in reference order', () => {
		const shown = matrixChannels(channels, [listing({ channelSlug: 'ingram' })], ['kdp'], false);
		expect(shown.map((c) => c.slug)).toEqual(['kdp', 'ingram']);
	});

	it('shows everything when asked', () => {
		expect(matrixChannels(channels, [listing({})], [], true)).toEqual(channels);
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
		const [kdp, kobo] = matrixCells('t1', channels, ls);
		expect(kdp).toMatchObject({ status: 'live', extraMarkets: 2 });
		expect(kobo).toMatchObject({ status: 'none', listing: null, extraMarkets: 0 });
	});

	it('falls back to a marketplace listing when there is no default', () => {
		const [kdp] = matrixCells('t1', channels, [
			listing({ marketplace: 'US', status: 'submitted' })
		]);
		expect(kdp).toMatchObject({ status: 'submitted', extraMarkets: 0 });
	});
});

describe('statusCounts', () => {
	it('counts each state, including not listed', () => {
		const cells = matrixCells('t1', channels, [
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
