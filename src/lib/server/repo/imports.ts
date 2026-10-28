import { and, asc, between, eq, inArray, isNull, sql } from 'drizzle-orm';
import { imports, observations } from '$lib/server/db/schema';
import type { Executor } from '$lib/server/db/types';
import type { ImportKind, Metric } from '$lib/shared/observations';

// Report imports and the observations they produce (#20). Call only with a transaction
// from withAuthor().

export async function createImport(
	tx: Executor,
	authorId: string,
	values: { channelSlug: string; kind: ImportKind; filename: string }
) {
	const [row] = await tx
		.insert(imports)
		.values({ authorId, ...values })
		.returning({ id: imports.id });
	return row!.id;
}

/** Marks an import parsed with its row count, or failed with a reason. */
export async function finishImport(
	tx: Executor,
	authorId: string,
	id: string,
	result: { rowCount: number } | { error: string }
) {
	await tx
		.update(imports)
		.set(
			'error' in result
				? { status: 'failed', error: result.error.slice(0, 2000) }
				: { status: 'parsed', rowCount: result.rowCount, error: null, parsedAt: new Date() }
		)
		.where(and(eq(imports.authorId, authorId), eq(imports.id, id)));
}

export type ObservationValues = Omit<
	typeof observations.$inferInsert,
	'id' | 'authorId' | 'importId' | 'createdAt'
>;

/** Results typed in by hand for a campaign (#122): no import, linked to the campaign. */
export async function insertCampaignObservations(
	tx: Executor,
	authorId: string,
	campaignId: string,
	rows: ObservationValues[]
) {
	if (rows.length === 0) return;
	await tx
		.insert(observations)
		.values(rows.map((r) => ({ authorId, importId: null, ...r, campaignId })));
}

/** A campaign's observations, oldest period first. */
export function listCampaignObservations(tx: Executor, authorId: string, campaignId: string) {
	return tx
		.select()
		.from(observations)
		.where(and(eq(observations.authorId, authorId), eq(observations.campaignId, campaignId)))
		.orderBy(asc(observations.periodStart), asc(observations.id));
}

/** Removes one period of a campaign's results. */
export async function deleteCampaignPeriod(
	tx: Executor,
	authorId: string,
	campaignId: string,
	periodStart: string,
	periodEnd: string
) {
	const rows = await tx
		.delete(observations)
		.where(
			and(
				eq(observations.authorId, authorId),
				eq(observations.campaignId, campaignId),
				eq(observations.periodStart, periodStart),
				eq(observations.periodEnd, periodEnd)
			)
		)
		.returning({ id: observations.id });
	return rows.length > 0;
}

export async function insertObservations(
	tx: Executor,
	authorId: string,
	importId: string,
	rows: ObservationValues[]
) {
	if (rows.length === 0) return;
	await tx.insert(observations).values(rows.map((r) => ({ authorId, importId, ...r })));
}

export function listImports(tx: Executor, authorId: string) {
	return tx.select().from(imports).where(eq(imports.authorId, authorId)).orderBy(asc(imports.id));
}

/** Observations, oldest period first, optionally for one book. */
export function listObservations(tx: Executor, authorId: string, titleId?: string) {
	return tx
		.select()
		.from(observations)
		.where(
			titleId
				? and(eq(observations.authorId, authorId), eq(observations.titleId, titleId))
				: eq(observations.authorId, authorId)
		)
		.orderBy(asc(observations.periodStart), asc(observations.id));
}

/** Deletes an import and everything it produced, so the report can be imported again. */
export async function deleteImport(tx: Executor, authorId: string, id: string) {
	const rows = await tx
		.delete(imports)
		.where(and(eq(imports.authorId, authorId), eq(imports.id, id)))
		.returning({ id: imports.id });
	return rows.length > 0;
}

/**
 * Removes what earlier imports of the same kind said about one metric over these days, so
 * a new upload replaces them rather than double counting (#21). Results typed in by hand
 * (no import) are never touched.
 */
export async function deleteImportedCoverage(
	tx: Executor,
	authorId: string,
	kind: ImportKind,
	metric: Metric,
	from: string,
	to: string
) {
	await tx.delete(observations).where(
		and(
			eq(observations.authorId, authorId),
			eq(observations.metric, metric),
			between(observations.periodStart, from, to),
			inArray(
				observations.importId,
				tx
					.select({ id: imports.id })
					.from(imports)
					.where(and(eq(imports.authorId, authorId), eq(imports.kind, kind)))
			)
		)
	);
}

/** Imports, newest first, with how many observations each still provides. */
export function listImportsWithCounts(tx: Executor, authorId: string) {
	return tx
		.select({
			id: imports.id,
			kind: imports.kind,
			filename: imports.filename,
			status: imports.status,
			error: imports.error,
			rowCount: imports.rowCount,
			createdAt: imports.createdAt,
			// Written out in full: inside a subquery Drizzle may leave columns unqualified.
			remaining: sql<number>`(select count(*)::int from observations o where o.import_id = "imports"."id")`
		})
		.from(imports)
		.where(eq(imports.authorId, authorId))
		.orderBy(sql`${imports.id} desc`);
}

/** Links imported rows for a store ID to its book, once the author records that ID. */
export async function linkObservations(
	tx: Executor,
	authorId: string,
	titleId: string,
	externalId: string
) {
	await tx
		.update(observations)
		.set({ titleId })
		.where(
			and(
				eq(observations.authorId, authorId),
				eq(observations.externalId, externalId),
				isNull(observations.titleId)
			)
		);
}
