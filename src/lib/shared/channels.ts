// Channels from spec §5. The `channels` table is seeded from this list by migrations
// (0003, 0007, and 0008, which merged KDP Print into Amazon KDP); a later change here needs a new migration, and channels.integration.test.ts
// fails until the two match.

export const BOOK_FORMATS = ['ebook', 'paperback', 'hardcover', 'audiobook'] as const;
export type BookFormat = (typeof BOOK_FORMATS)[number];

export const FORMAT_LABELS: Record<BookFormat, string> = {
	ebook: 'Ebook',
	paperback: 'Paperback',
	hardcover: 'Hardcover',
	audiobook: 'Audiobook'
};

export type ChannelCapabilities = {
	/** Formats this store sells. The listing matrix only offers cells for these (#72). */
	formats: BookFormat[];
	/** Offers an exclusivity program, such as KDP Select. */
	exclusivity: boolean;
	/** Sets a wholesale discount for bookstores, such as IngramSpark. */
	wholesaleDiscount: boolean;
	/** Lets bookstores return unsold print copies. */
	returns: boolean;
	/** Distributes on to other stores, such as Draft2Digital. */
	aggregator: boolean;
};

const caps = (c: Partial<ChannelCapabilities> & Pick<ChannelCapabilities, 'formats'>) => ({
	exclusivity: false,
	wholesaleDiscount: false,
	returns: false,
	aggregator: false,
	...c
});

export const CHANNELS = [
	{
		slug: 'kdp',
		displayName: 'Amazon KDP',
		capabilities: caps({ formats: ['ebook', 'paperback', 'hardcover'], exclusivity: true })
	},
	{
		slug: 'kobo',
		displayName: 'Kobo Writing Life',
		capabilities: caps({ formats: ['ebook', 'audiobook'] })
	},
	{
		slug: 'd2d',
		displayName: 'Draft2Digital',
		capabilities: caps({ formats: ['ebook', 'paperback'], aggregator: true })
	},
	{
		slug: 'ingram',
		displayName: 'IngramSpark',
		capabilities: caps({
			formats: ['paperback', 'hardcover', 'ebook'],
			wholesaleDiscount: true,
			returns: true
		})
	},
	{ slug: 'apple', displayName: 'Apple Books', capabilities: caps({ formats: ['ebook'] }) },
	{
		slug: 'google_play',
		displayName: 'Google Play Books',
		capabilities: caps({ formats: ['ebook', 'audiobook'] })
	},
	{
		slug: 'bn_press',
		displayName: 'Barnes & Noble Press',
		capabilities: caps({ formats: ['ebook', 'paperback', 'hardcover'] })
	},
	{
		slug: 'acx',
		displayName: 'Audible (ACX)',
		capabilities: caps({ formats: ['audiobook'], exclusivity: true })
	},
	{
		slug: 'findaway',
		displayName: 'Spotify (Findaway Voices)',
		capabilities: caps({ formats: ['audiobook'], aggregator: true })
	},
	{
		slug: 'kickstarter',
		displayName: 'Kickstarter',
		capabilities: caps({ formats: [...BOOK_FORMATS] })
	},
	{
		slug: 'direct',
		displayName: 'Direct sales',
		capabilities: caps({ formats: [...BOOK_FORMATS] })
	}
] as const satisfies readonly {
	slug: string;
	displayName: string;
	capabilities: ChannelCapabilities;
}[];

export const CHANNEL_SLUGS = CHANNELS.map((c) => c.slug) as [
	(typeof CHANNELS)[number]['slug'],
	...(typeof CHANNELS)[number]['slug'][]
];

export type ChannelSlug = (typeof CHANNELS)[number]['slug'];

/** Whether a store sells a format, so a listing for it makes sense. */
export function sellsFormat(slug: string, format: BookFormat): boolean {
	const channel = CHANNELS.find((c) => c.slug === slug);
	return !!channel && (channel.capabilities.formats as readonly string[]).includes(format);
}
