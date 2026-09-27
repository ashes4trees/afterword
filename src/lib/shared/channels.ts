// Channel slugs from spec §5. #10 adds the `channels` reference table; keep the two in step.
export const CHANNEL_SLUGS = [
	'kdp',
	'kdp_print',
	'kobo',
	'd2d',
	'ingram',
	'apple',
	'google_play',
	'direct'
] as const;

export type ChannelSlug = (typeof CHANNEL_SLUGS)[number];
