import { RULES } from '$lib/server/content/rulePacks';
import type { RuleDef } from '$lib/server/content/rules';
import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import { reviewCampaign } from '$lib/server/engine/campaigns';
import {
	getPreferences,
	getStoredPreferences,
	updatePreferences,
	type SessionAuthor
} from '$lib/server/repo/authors';
import * as campaignsRepo from '$lib/server/repo/campaigns';
import * as importsRepo from '$lib/server/repo/imports';
import * as works from '$lib/server/repo/works';
import type { CampaignInput, ResultsInput } from '$lib/shared/adForms';
import type { Metric } from '$lib/shared/observations';

// The Ads pages (#122): campaigns, the results the author records for them, and the
// engine's reviews (#23). Verdicts come from the rule packs, never a model (C5).

/** What the campaign form needs: books to pick from, and the author's usual currency and marketplace. */
export async function campaignFormOptions(db: Executor, author: SessionAuthor) {
	const { currency, marketplaces } = await getPreferences(db, author.id);
	const books = await withAuthor(db, author.id, (tx) => works.listTitles(tx, author.id));
	return {
		books: books.map((b) => ({ id: b.id, title: b.workingTitle })),
		currency,
		marketplace: marketplaces[0] ?? 'US'
	};
}

export function adsOverview(db: Executor, author: SessionAuthor) {
	return withAuthor(db, author.id, (tx) =>
		campaignsRepo.listCampaignsWithLatestReview(tx, author.id)
	);
}

export type ResultPeriod = {
	periodStart: string;
	periodEnd: string;
	spendMinor: number;
	salesMinor: number;
	impressions: number | null;
	clicks: number | null;
};

/** A campaign with its results grouped by period, and its reviews, newest first. */
export function campaignDetail(db: Executor, author: SessionAuthor, id: string) {
	return withAuthor(db, author.id, async (tx) => {
		const found = await campaignsRepo.getCampaign(tx, author.id, id);
		if (!found) return null;
		const rows = await importsRepo.listCampaignObservations(tx, author.id, id);
		const periods = new Map<string, ResultPeriod>();
		for (const o of rows) {
			const key = `${o.periodStart}|${o.periodEnd}`;
			const p = periods.get(key) ?? {
				periodStart: o.periodStart,
				periodEnd: o.periodEnd,
				spendMinor: 0,
				salesMinor: 0,
				impressions: null,
				clicks: null
			};
			if (o.metric === 'ad_spend_minor') p.spendMinor += o.value;
			if (o.metric === 'ad_sales_minor') p.salesMinor += o.value;
			if (o.metric === 'impressions') p.impressions = (p.impressions ?? 0) + o.value;
			if (o.metric === 'clicks') p.clicks = (p.clicks ?? 0) + o.value;
			periods.set(key, p);
		}
		return {
			...found,
			results: [...periods.values()],
			reviews: await campaignsRepo.listReviews(tx, author.id, id)
		};
	});
}

/** Adds a campaign, or saves changes to one. Null if the book (or campaign) is gone. */
export function saveCampaign(
	db: Executor,
	author: SessionAuthor,
	id: string | null,
	input: CampaignInput
) {
	return withAuthor(db, author.id, async (tx) => {
		if (!(await works.getTitle(tx, author.id, input.titleId))) return null;
		if (!id) return campaignsRepo.insertCampaign(tx, author.id, input);
		return (await campaignsRepo.updateCampaign(tx, author.id, id, input)) ? id : null;
	});
}

export function deleteCampaign(db: Executor, author: SessionAuthor, id: string) {
	return withAuthor(db, author.id, (tx) => campaignsRepo.deleteCampaign(tx, author.id, id));
}

/**
 * Records one period of results as observations in the campaign's store, marketplace, and
 * currency. Recording the same period again replaces it. False if the campaign is gone.
 */
export function recordResults(
	db: Executor,
	author: SessionAuthor,
	campaignId: string,
	input: ResultsInput
) {
	return withAuthor(db, author.id, async (tx) => {
		const found = await campaignsRepo.getCampaign(tx, author.id, campaignId);
		if (!found) return false;
		const c = found.campaign;
		await importsRepo.deleteCampaignPeriod(
			tx,
			author.id,
			campaignId,
			input.periodStart,
			input.periodEnd
		);
		const values: [Metric, number | null][] = [
			['ad_spend_minor', input.spendMinor],
			['ad_sales_minor', input.salesMinor],
			['impressions', input.impressions],
			['clicks', input.clicks]
		];
		await importsRepo.insertCampaignObservations(
			tx,
			author.id,
			campaignId,
			values
				.filter((v): v is [Metric, number] => v[1] !== null)
				.map(([metric, value]) => ({
					titleId: c.titleId,
					channelSlug: c.channelSlug,
					marketplace: c.marketplace,
					currency: c.currency,
					metric,
					value,
					periodStart: input.periodStart,
					periodEnd: input.periodEnd
				}))
		);
		return true;
	});
}

export function deleteResults(
	db: Executor,
	author: SessionAuthor,
	campaignId: string,
	periodStart: string,
	periodEnd: string
) {
	return withAuthor(db, author.id, (tx) =>
		importsRepo.deleteCampaignPeriod(tx, author.id, campaignId, periodStart, periodEnd)
	);
}

/**
 * Runs the campaign rules (#23) on everything recorded so far and stores the verdict, its
 * rule, and its inputs. Earlier reviews stay as history. Null if the campaign is gone.
 */
export async function reviewNow(
	db: Executor,
	author: SessionAuthor,
	campaignId: string,
	today: string,
	rules: RuleDef[] = RULES
) {
	const stored = await getStoredPreferences(db, author.id);
	return withAuthor(db, author.id, async (tx) => {
		const found = await campaignsRepo.getCampaign(tx, author.id, campaignId);
		if (!found) return null;
		const observations = await importsRepo.listCampaignObservations(tx, author.id, campaignId);
		const review = reviewCampaign(found.campaign, observations, stored, today, rules);
		await campaignsRepo.insertReview(tx, author.id, { campaignId, ...review });
		return review;
	});
}

/** Settings → Ads (#126): what the author has set, and their currency for the spend. */
export async function adSettings(db: Executor, author: SessionAuthor) {
	const [{ currency }, stored] = await Promise.all([
		getPreferences(db, author.id),
		getStoredPreferences(db, author.id)
	]);
	return {
		currency,
		targetAcos: stored.target_acos ?? null,
		evalDays: stored.min_ad_eval_days ?? null,
		evalSpendMinor: stored.min_ad_eval_spend_minor ?? null
	};
}

/** Saves the ad thresholds. Null clears one, so the rule's own default applies. */
export async function saveAdSettings(
	db: Executor,
	author: SessionAuthor,
	patch: {
		target_acos: number | null;
		min_ad_eval_days: number | null;
		min_ad_eval_spend_minor: number | null;
	}
) {
	await updatePreferences(db, author.id, patch);
}
