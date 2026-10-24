// Normalized metrics from imported reports (#20). Shared by the schema, the import
// parsers (#21, #22), and the engine.

/** What a metric counts. `*_minor` metrics are money in the observation's currency. */
export const METRICS = [
	'units',
	'kenp_pages',
	'royalty_minor',
	'ad_spend_minor',
	'ad_sales_minor',
	'impressions',
	'clicks'
] as const;
export type Metric = (typeof METRICS)[number];

/** Which report an import came from. */
export const IMPORT_KINDS = ['kdp_report', 'kobo_report'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const IMPORT_STATUSES = ['pending', 'parsed', 'failed'] as const;
