import { and, desc, eq } from 'drizzle-orm';
import { campaignReviews, campaigns } from '$lib/server/db/schema';
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
