// Ad campaigns (#19). Shared by the schema, rule packs, and the UI.

/** What the engine can conclude about a campaign (spec §5). */
export const CAMPAIGN_VERDICTS = ['too_young', 'keep', 'raise', 'lower', 'pause', 'kill'] as const;
export type CampaignVerdict = (typeof CAMPAIGN_VERDICTS)[number];

export const CAMPAIGN_TYPES = [
	'sponsored_products',
	'sponsored_brands',
	'sponsored_display'
] as const;
export const TARGETING_KINDS = ['auto', 'keyword', 'product', 'category'] as const;
export const CAMPAIGN_STATUSES = ['enabled', 'paused', 'archived'] as const;

export type CampaignType = (typeof CAMPAIGN_TYPES)[number];
export type TargetingKind = (typeof TARGETING_KINDS)[number];
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const TYPE_LABELS: Record<CampaignType, string> = {
	sponsored_products: 'Sponsored Products',
	sponsored_brands: 'Sponsored Brands',
	sponsored_display: 'Sponsored Display'
};
export const TARGETING_LABELS: Record<TargetingKind, string> = {
	auto: 'Automatic',
	keyword: 'Keywords',
	product: 'Products (ASINs)',
	category: 'Categories'
};
export const STATUS_LABELS: Record<CampaignStatus, string> = {
	enabled: 'Running',
	paused: 'Paused',
	archived: 'Archived'
};

/** How a verdict reads, and how loudly. */
export const VERDICT_META: Record<
	CampaignVerdict,
	{ label: string; tone: 'muted' | 'ok' | 'accent' | 'warn' | 'danger' }
> = {
	too_young: { label: 'Too early to judge', tone: 'muted' },
	keep: { label: 'Keep', tone: 'ok' },
	raise: { label: 'Raise budget', tone: 'accent' },
	lower: { label: 'Lower bids', tone: 'warn' },
	pause: { label: 'Pause', tone: 'danger' },
	kill: { label: 'Stop', tone: 'danger' }
};

/** How a review's inputs read on the campaign page, in this order. */
export const REVIEW_INPUTS: {
	key: string;
	label: string;
	format: 'money' | 'percent' | 'number';
}[] = [
	{ key: 'days_live', label: 'Days live', format: 'number' },
	{ key: 'ad_spend_minor', label: 'Spent', format: 'money' },
	{ key: 'ad_sales_minor', label: 'Sales', format: 'money' },
	{ key: 'acos', label: 'ACOS', format: 'percent' },
	{ key: 'acos_ceiling', label: 'Your target ACOS', format: 'percent' },
	{ key: 'raise_acos', label: 'Raise budget below', format: 'percent' },
	{ key: 'pause_acos', label: 'Pause above', format: 'percent' },
	{ key: 'kill_acos', label: 'Stop above', format: 'percent' },
	{ key: 'min_days', label: 'Judge after (days)', format: 'number' },
	{ key: 'min_spend_minor', label: 'Judge after spending', format: 'money' }
];
