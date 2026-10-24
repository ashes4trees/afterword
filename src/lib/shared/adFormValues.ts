import { fromMinor } from './money';

// Campaign form values as strings (#122), so a failed save can show them again.

export const campaignFormValues = (f: FormData | null, defaults: Record<string, string>) =>
	Object.fromEntries(
		[
			'name',
			'titleId',
			'status',
			'channelSlug',
			'marketplace',
			'campaignType',
			'targetingKind',
			'budget',
			'currency',
			'startedAt',
			'endedAt'
		].map((k) => [k, f ? String(f.get(k) ?? '') : (defaults[k] ?? '')])
	);

/** A stored campaign as form values. */
export const storedCampaignValues = (c: {
	name: string;
	titleId: string;
	status: string;
	channelSlug: string;
	marketplace: string;
	campaignType: string;
	targetingKind: string;
	dailyBudgetMinor: number | null;
	currency: string;
	startedAt: string;
	endedAt: string | null;
}) => ({
	name: c.name,
	titleId: c.titleId,
	status: c.status,
	channelSlug: c.channelSlug,
	marketplace: c.marketplace,
	campaignType: c.campaignType,
	targetingKind: c.targetingKind,
	budget: c.dailyBudgetMinor === null ? '' : fromMinor(c.dailyBudgetMinor, c.currency),
	currency: c.currency,
	startedAt: c.startedAt,
	endedAt: c.endedAt ?? ''
});
