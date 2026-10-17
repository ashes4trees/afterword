// Channels from spec §5. The `channels` table is seeded from this list by migrations
// (0003, then 0007 for the stores added later); a later change here needs a new migration, and channels.integration.test.ts
// fails until the two match.

export type ChannelCapabilities = {
	formats: ('ebook' | 'print' | 'audio')[];
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
		capabilities: caps({ formats: ['ebook'], exclusivity: true })
	},
	{
		slug: 'kdp_print',
		displayName: 'Amazon KDP Print',
		capabilities: caps({ formats: ['print'] })
	},
	{ slug: 'kobo', displayName: 'Kobo Writing Life', capabilities: caps({ formats: ['ebook'] }) },
	{
		slug: 'd2d',
		displayName: 'Draft2Digital',
		capabilities: caps({ formats: ['ebook', 'print'], aggregator: true })
	},
	{
		slug: 'ingram',
		displayName: 'IngramSpark',
		capabilities: caps({ formats: ['print', 'ebook'], wholesaleDiscount: true, returns: true })
	},
	{ slug: 'apple', displayName: 'Apple Books', capabilities: caps({ formats: ['ebook'] }) },
	{
		slug: 'google_play',
		displayName: 'Google Play Books',
		capabilities: caps({ formats: ['ebook'] })
	},
	{
		slug: 'bn_press',
		displayName: 'Barnes & Noble Press',
		capabilities: caps({ formats: ['ebook', 'print'] })
	},
	{
		slug: 'acx',
		displayName: 'Audible (ACX)',
		capabilities: caps({ formats: ['audio'], exclusivity: true })
	},
	{
		slug: 'findaway',
		displayName: 'Spotify (Findaway Voices)',
		capabilities: caps({ formats: ['audio'], aggregator: true })
	},
	{
		slug: 'kickstarter',
		displayName: 'Kickstarter',
		capabilities: caps({ formats: ['ebook', 'print', 'audio'] })
	},
	{
		slug: 'direct',
		displayName: 'Direct sales',
		capabilities: caps({ formats: ['ebook', 'print', 'audio'] })
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
