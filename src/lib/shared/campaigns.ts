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
