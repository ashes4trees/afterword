import type { RuleDef } from '$lib/server/content/rules';
import type { CampaignVerdict } from '$lib/shared/campaigns';
import { daysBetween } from '$lib/shared/dates';
import type { Preferences } from '$lib/shared/preferences';
import { evaluateRule } from './rules';

// Campaign reviews (#23): the deterministic verdict on an ad campaign. Pure, with no
// database, network, or model call (C5). The model may narrate the result later; it
// never decides it.

export type CampaignState = {
	startedAt: string;
	endedAt: string | null;
	currency: string;
};

export type AdObservation = {
	metric: string;
	value: number;
	currency: string;
	periodStart: string;
	periodEnd: string;
};

export type CampaignReview = {
	verdict: CampaignVerdict;
	ruleId: string;
	ruleVersion: number;
	/** Every input, derived value, and threshold the verdict rests on. */
	inputs: Record<string, number | null>;
	/** Plain advice that stands on its own with AI switched off. */
	explanation: string;
};

/** Days the campaign has run, counting its first day, up to today or its end. */
export function daysLive(campaign: CampaignState, today: string): number {
	const end = campaign.endedAt && campaign.endedAt < today ? campaign.endedAt : today;
	return Math.max(0, daysBetween(campaign.startedAt, end) + 1);
}

/**
 * The campaign's ad spend and sales, from observations in its own currency (never
 * converted) whose period overlaps its run.
 */
export function campaignTotals(
	campaign: CampaignState,
	observations: AdObservation[],
	today: string
) {
	const end = campaign.endedAt ?? today;
	const relevant = observations.filter(
		(o) =>
			o.currency === campaign.currency && o.periodEnd >= campaign.startedAt && o.periodStart <= end
	);
	const sum = (metric: string) =>
		relevant.filter((o) => o.metric === metric).reduce((total, o) => total + o.value, 0);
	return { ad_spend_minor: sum('ad_spend_minor'), ad_sales_minor: sum('ad_sales_minor') };
}

/**
 * Reviews a campaign: the campaign rules in priority order, and the first that applies
 * gives the verdict. `stored` holds only the preferences the author has set.
 */
export function reviewCampaign(
	campaign: CampaignState,
	observations: AdObservation[],
	stored: Partial<Preferences>,
	today: string,
	rules: RuleDef[]
): CampaignReview {
	const inputs = {
		...campaignTotals(campaign, observations, today),
		days_live: daysLive(campaign, today)
	};
	const ordered = rules
		.filter((r) => r.applies_to === 'campaign')
		.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
	for (const rule of ordered) {
		const result = evaluateRule(rule, inputs, stored, campaign.currency);
		if (result.applies) {
			return {
				verdict: rule.verdict,
				ruleId: rule.id,
				ruleVersion: rule.version,
				inputs: result.values,
				explanation: result.explanation!
			};
		}
	}
	throw new Error('No campaign rule applied. The rule packs need a catch-all (when: always).');
}
