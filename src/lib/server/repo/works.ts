import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { penNames, series, titles } from '$lib/server/db/schema';
import type { Executor } from '$lib/server/db/types';

// Pen names, series, and titles. Call these only with a transaction from withAuthor().
// Every query still filters by author_id; row-level security is the backstop.

export type TitleValues = Omit<
	typeof titles.$inferInsert,
	'id' | 'authorId' | 'createdAt' | 'updatedAt'
>;

export async function findOrCreatePenName(tx: Executor, authorId: string, name: string) {
	await tx.insert(penNames).values({ authorId, name }).onConflictDoNothing();
	const [row] = await tx
		.select()
		.from(penNames)
		.where(and(eq(penNames.authorId, authorId), sql`lower(${penNames.name}) = lower(${name})`));
	return row!;
}

export async function findSeriesByTitle(tx: Executor, authorId: string, title: string) {
	const [row] = await tx
		.select()
		.from(series)
		.where(and(eq(series.authorId, authorId), sql`lower(${series.title}) = lower(${title})`));
	return row;
}

export async function createSeries(
	tx: Executor,
	authorId: string,
	title: string,
	penNameId: string | null
) {
	const [row] = await tx.insert(series).values({ authorId, title, penNameId }).returning();
	return row!;
}

export async function listPenNames(tx: Executor, authorId: string) {
	return tx
		.select({ id: penNames.id, name: penNames.name })
		.from(penNames)
		.where(eq(penNames.authorId, authorId))
		.orderBy(asc(penNames.name));
}

/**
 * Every trope the author has used, most used first. Spellings that differ only in case
 * count as one trope, shown in a single spelling.
 */
export async function listTropes(tx: Executor, authorId: string): Promise<string[]> {
	const rows = (await tx.execute(sql`
		select min(trope) as trope
		from ${titles}, unnest(${titles.tropes}) as trope
		where ${titles.authorId} = ${authorId}
		group by lower(trope)
		order by count(*) desc, min(trope)`)) as unknown as { trope: string }[];
	return rows.map((r) => r.trope);
}

export async function listSeries(tx: Executor, authorId: string) {
	return tx
		.select({ id: series.id, title: series.title, penName: penNames.name })
		.from(series)
		.leftJoin(penNames, eq(penNames.id, series.penNameId))
		.where(eq(series.authorId, authorId))
		.orderBy(asc(series.title));
}

const titleColumns = {
	id: titles.id,
	workingTitle: titles.workingTitle,
	penNameId: titles.penNameId,
	penName: penNames.name,
	seriesId: titles.seriesId,
	seriesTitle: series.title,
	seriesPosition: titles.seriesPosition,
	genre: titles.genre,
	subgenre: titles.subgenre,
	tropes: titles.tropes,
	contentSex: titles.contentSex,
	contentViolence: titles.contentViolence,
	contentLanguage: titles.contentLanguage,
	pageCount: titles.pageCount,
	wordCount: titles.wordCount,
	releaseDate: titles.releaseDate,
	stage: titles.stage,
	createdAt: titles.createdAt,
	updatedAt: titles.updatedAt
};

function selectTitles(tx: Executor) {
	return tx
		.select(titleColumns)
		.from(titles)
		.leftJoin(penNames, eq(penNames.id, titles.penNameId))
		.leftJoin(series, eq(series.id, titles.seriesId));
}

export type TitleRow = Awaited<ReturnType<typeof listTitles>>[number];

export async function listTitles(tx: Executor, authorId: string) {
	return selectTitles(tx)
		.where(eq(titles.authorId, authorId))
		.orderBy(
			asc(series.title),
			asc(titles.seriesPosition),
			desc(titles.releaseDate),
			asc(titles.workingTitle)
		);
}

export async function getTitle(tx: Executor, authorId: string, id: string) {
	const [row] = await selectTitles(tx).where(and(eq(titles.authorId, authorId), eq(titles.id, id)));
	return row;
}

export async function insertTitle(tx: Executor, authorId: string, values: TitleValues) {
	const [row] = await tx
		.insert(titles)
		.values({ ...values, authorId })
		.returning({ id: titles.id });
	return row!.id;
}

export async function updateTitle(tx: Executor, authorId: string, id: string, values: TitleValues) {
	const rows = await tx
		.update(titles)
		.set(values)
		.where(and(eq(titles.authorId, authorId), eq(titles.id, id)))
		.returning({ id: titles.id });
	return rows.length > 0;
}

export async function deleteTitle(tx: Executor, authorId: string, id: string) {
	const rows = await tx
		.delete(titles)
		.where(and(eq(titles.authorId, authorId), eq(titles.id, id)))
		.returning({ id: titles.id });
	return rows.length > 0;
}
