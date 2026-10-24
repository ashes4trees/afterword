import { and, asc, eq } from 'drizzle-orm';
import { imports, observations } from '$lib/server/db/schema';
import type { Executor } from '$lib/server/db/types';
import type { ImportKind } from '$lib/shared/observations';

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
