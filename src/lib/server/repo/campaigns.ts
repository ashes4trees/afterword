import { and, desc, eq } from 'drizzle-orm';
import { campaignReviews, campaigns, titles } from '$lib/server/db/schema';
import type { Executor } from '$lib/server/db/types';

// Ad campaigns and the engine's reviews of them (#19). Call only with a transaction from
// withAuthor().

export type CampaignValues = Omit<
	typeof campaigns.$inferInsert,
	'id' | 'authorId' | 'createdAt' | 'updatedAt'
>;

export async function insertCampaign(tx: Executor, authorId: string, values: CampaignValues) {
	const [row] = await tx
		.insert(campaigns)
		.values({ authorId, ...values })
		.returning({ id: campaigns.id });
	return row!.id;
}

export function listCampaigns(tx: Executor, authorId: string) {
	return tx
		.select()
		.from(campaigns)
		.where(eq(campaigns.authorId, authorId))
		.orderBy(desc(campaigns.startedAt));
}

export type ReviewValues = Omit<
	typeof campaignReviews.$inferInsert,
	'id' | 'authorId' | 'evaluatedAt'
>;

/** Records a verdict. Reviews are history: a later review is a new row. */
export async function insertReview(tx: Executor, authorId: string, values: ReviewValues) {
	const [row] = await tx
		.insert(campaignReviews)
		.values({ authorId, ...values })
		.returning({ id: campaignReviews.id });
	return row!.id;
}

/** A campaign's reviews, newest first. */
export function listReviews(tx: Executor, authorId: string, campaignId: string) {
	return tx
		.select()
		.from(campaignReviews)
		.where(and(eq(campaignReviews.authorId, authorId), eq(campaignReviews.campaignId, campaignId)))
		.orderBy(desc(campaignReviews.evaluatedAt), desc(campaignReviews.id));
}

/** Campaigns with their book's title and latest review, newest start first. */
export function listCampaignsWithLatestReview(tx: Executor, authorId: string) {
	const latest = tx
		.selectDistinctOn([campaignReviews.campaignId])
		.from(campaignReviews)
		.where(eq(campaignReviews.authorId, authorId))
		.orderBy(
			campaignReviews.campaignId,
			desc(campaignReviews.evaluatedAt),
			desc(campaignReviews.id)
		)
		.as('latest');
	return tx
		.select({
			campaign: campaigns,
			bookTitle: titles.workingTitle,
			verdict: latest.verdict,
			explanation: latest.explanation,
			evaluatedAt: latest.evaluatedAt
		})
		.from(campaigns)
		.innerJoin(titles, eq(titles.id, campaigns.titleId))
		.leftJoin(latest, eq(latest.campaignId, campaigns.id))
		.where(eq(campaigns.authorId, authorId))
		.orderBy(titles.workingTitle, desc(campaigns.startedAt), campaigns.name);
}

export async function getCampaign(tx: Executor, authorId: string, id: string) {
	const [row] = await tx
		.select({ campaign: campaigns, bookTitle: titles.workingTitle })
		.from(campaigns)
		.innerJoin(titles, eq(titles.id, campaigns.titleId))
		.where(and(eq(campaigns.authorId, authorId), eq(campaigns.id, id)));
	return row;
}

export async function updateCampaign(
	tx: Executor,
	authorId: string,
	id: string,
	values: CampaignValues
) {
	const rows = await tx
		.update(campaigns)
		.set(values)
		.where(and(eq(campaigns.authorId, authorId), eq(campaigns.id, id)))
		.returning({ id: campaigns.id });
	return rows.length > 0;
}

/** Deletes a campaign with its results and reviews. */
export async function deleteCampaign(tx: Executor, authorId: string, id: string) {
	const rows = await tx
		.delete(campaigns)
		.where(and(eq(campaigns.authorId, authorId), eq(campaigns.id, id)))
		.returning({ id: campaigns.id });
	return rows.length > 0;
}
