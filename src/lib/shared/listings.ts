// The listing matrix (#11): which channels to show, and each book × channel cell.
// Pure, so it's unit tested and shared by the grid and the stacked phone view.

export const LISTING_STATUSES = [
	'not_started',
	'metadata_draft',
	'submitted',
	'in_review',
	'live',
	'unpublished'
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export type StatusTone = 'faint' | 'muted' | 'info' | 'warn' | 'ok' | 'danger';
export type StatusIcon = 'dashed' | 'circle' | 'pencil' | 'send' | 'hourglass' | 'check' | 'ban';

/** Every state gets a distinct shape and word as well as a color (#11). */
export const STATUS_META: Record<
	ListingStatus | 'none',
	{ label: string; icon: StatusIcon; tone: StatusTone }
> = {
	none: { label: 'Not listed', icon: 'dashed', tone: 'faint' },
	not_started: { label: 'Not started', icon: 'circle', tone: 'muted' },
	metadata_draft: { label: 'Draft', icon: 'pencil', tone: 'info' },
	submitted: { label: 'Submitted', icon: 'send', tone: 'info' },
	in_review: { label: 'In review', icon: 'hourglass', tone: 'warn' },
	live: { label: 'Live', icon: 'check', tone: 'ok' },
	unpublished: { label: 'Unpublished', icon: 'ban', tone: 'danger' }
};

export type MatrixChannel = { slug: string; displayName: string };

export type MatrixListing = {
	titleId: string;
	channelSlug: string;
	marketplace: string | null;
	status: ListingStatus;
	enrolledInSelect: boolean;
	exclusivityEnd: string | null;
};

export type MatrixCell = {
	channel: MatrixChannel;
	/** The default (no marketplace) listing, or else the first marketplace listing. */
	listing: MatrixListing | null;
	status: ListingStatus | 'none';
	/** Marketplace-specific listings beyond the one shown. */
	extraMarkets: number;
};

/**
 * Channels shown as columns, in reference order. Every channel shows by default, so
 * any book can be listed anywhere from the grid. "Hide unused stores" narrows it to
 * channels already in use plus the author's default channels, unless that would
 * leave nothing to show.
 */
export function matrixChannels(
	all: MatrixChannel[],
	listings: MatrixListing[],
	defaultChannels: string[],
	hideUnused: boolean
): MatrixChannel[] {
	if (!hideUnused) return all;
	const used = new Set([...listings.map((l) => l.channelSlug), ...defaultChannels]);
	const shown = all.filter((c) => used.has(c.slug));
	return shown.length > 0 ? shown : all;
}

export function matrixCells(
	titleId: string,
	channels: MatrixChannel[],
	listings: MatrixListing[]
): MatrixCell[] {
	return channels.map((channel) => {
		const mine = listings.filter((l) => l.titleId === titleId && l.channelSlug === channel.slug);
		const listing = mine.find((l) => l.marketplace === null) ?? mine[0] ?? null;
		return {
			channel,
			listing,
			status: listing?.status ?? 'none',
			extraMarkets: Math.max(0, mine.length - 1)
		};
	});
}

/** How many cells in view are in each state, for the legend. */
export function statusCounts(cells: MatrixCell[]): Record<ListingStatus | 'none', number> {
	const counts = Object.fromEntries(
		(['none', ...LISTING_STATUSES] as const).map((s) => [s, 0])
	) as Record<ListingStatus | 'none', number>;
	for (const cell of cells) counts[cell.status]++;
	return counts;
}

/** A KDP Select obligation worth showing in the cell, with the date it ends. */
export function selectObligation(listing: MatrixListing | null) {
	if (!listing?.enrolledInSelect) return null;
	return { until: listing.exclusivityEnd };
}
