import { and, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { channelListings, decisions, titles } from '$lib/server/db/schema';
import type { Executor } from '$lib/server/db/types';

// Decisions (#12, #26): append-only. Call only with a transaction from withAuthor().

type Kind = (typeof decisions.$inferInsert)['kind'];

/** The decision about a subject that nothing has superseded yet. */
export async function currentDecision(
	tx: Executor,
	authorId: string,
	subjectType: string,
	subjectId: string,
	kind: Kind
) {
	const [row] = await tx
		.select()
		.from(decisions)
		.where(
			and(
				eq(decisions.authorId, authorId),
				eq(decisions.subjectType, subjectType),
				eq(decisions.subjectId, subjectId),
				eq(decisions.kind, kind),
				isNull(decisions.supersededBy)
			)
		)
		.orderBy(desc(decisions.decidedAt))
		.limit(1);
	return row;
}

/**
 * Records a decision, superseding the current one about the same subject and kind. The
 * old row is never edited beyond its superseded_by pointer (enforced by a trigger).
 */
export async function recordDecision(
	tx: Executor,
	authorId: string,
	d: Omit<typeof decisions.$inferInsert, 'id' | 'authorId' | 'decidedAt' | 'supersededBy'>
) {
	const previous = await currentDecision(tx, authorId, d.subjectType, d.subjectId, d.kind);
	const [row] = await tx
		.insert(decisions)
		.values({ ...d, authorId })
		.returning({ id: decisions.id });
	if (previous) {
		await tx
			.update(decisions)
			.set({ supersededBy: row!.id })
			.where(and(eq(decisions.authorId, authorId), eq(decisions.id, previous.id)));
	}
	return row!.id;
}

/**
 * Current listing decisions with a commitment date, with the book and listing they're about,
 * for reminders (#46). Decisions about deleted listings drop out.
 */
export function listCurrentListingCommitments(tx: Executor, authorId: string) {
	return tx
		.select({
			id: decisions.id,
			choice: decisions.choice,
			commitsUntil: decisions.commitsUntil,
			titleId: channelListings.titleId,
			bookTitle: titles.workingTitle,
			channelSlug: channelListings.channelSlug,
			format: channelListings.format
		})
		.from(decisions)
		.innerJoin(channelListings, eq(channelListings.id, decisions.subjectId))
		.innerJoin(titles, eq(titles.id, channelListings.titleId))
		.where(
			and(
				eq(decisions.authorId, authorId),
				eq(decisions.subjectType, 'listing'),
				isNull(decisions.supersededBy),
				isNotNull(decisions.commitsUntil)
			)
		);
}

/**
 * The decision log, newest first, with the book each decision is about: directly
 * (subject 'title') or through a listing (subject 'listing'). Account-wide decisions
 * (subject 'author') have no book. Optionally for one book.
 */
export function listDecisions(tx: Executor, authorId: string, titleId?: string) {
	const bookId = sql<
		string | null
	>`coalesce(${channelListings.titleId}, case when ${decisions.subjectType} = 'title' then ${decisions.subjectId} end)`;
	return tx
		.select({
			id: decisions.id,
			kind: decisions.kind,
			choice: decisions.choice,
			rationale: decisions.rationale,
			assumptions: decisions.assumptions,
			commitsUntil: decisions.commitsUntil,
			source: decisions.source,
			decidedAt: decisions.decidedAt,
			supersededBy: decisions.supersededBy,
			subjectType: decisions.subjectType,
			titleId: titles.id,
			bookTitle: titles.workingTitle,
			channelSlug: channelListings.channelSlug,
			format: channelListings.format,
			marketplace: channelListings.marketplace
		})
		.from(decisions)
		.leftJoin(
			channelListings,
			and(eq(decisions.subjectType, 'listing'), eq(channelListings.id, decisions.subjectId))
		)
		.leftJoin(titles, eq(titles.id, bookId))
		.where(
			titleId
				? and(eq(decisions.authorId, authorId), eq(titles.id, titleId))
				: and(
						eq(decisions.authorId, authorId),
						// Decisions about a deleted listing or book have no subject left to show.
						or(eq(decisions.subjectType, 'author'), isNotNull(titles.id))
					)
		)
		.orderBy(desc(decisions.decidedAt), desc(decisions.id));
}

/**
 * Current decisions about a book or the whole account with a commitment date (#26),
 * for reminders. Decisions about a deleted book drop out.
 */
export function listCurrentOtherCommitments(tx: Executor, authorId: string) {
	return tx
		.select({
			id: decisions.id,
			choice: decisions.choice,
			commitsUntil: decisions.commitsUntil,
			subjectType: decisions.subjectType,
			titleId: titles.id,
			bookTitle: titles.workingTitle
		})
		.from(decisions)
		.leftJoin(titles, and(eq(decisions.subjectType, 'title'), eq(titles.id, decisions.subjectId)))
		.where(
			and(
				eq(decisions.authorId, authorId),
				isNull(decisions.supersededBy),
				isNotNull(decisions.commitsUntil),
				or(eq(decisions.subjectType, 'author'), isNotNull(titles.id))
			)
		);
}
