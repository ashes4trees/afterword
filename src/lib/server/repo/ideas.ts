import { and, asc, eq } from 'drizzle-orm';
import { authorIdeas, ideaDismissals } from '$lib/server/db/schema';
import type { Executor } from '$lib/server/db/types';
import { MY_IDEAS_PACK, type MyIdeaInput } from '$lib/shared/ideas';

// The author's own ideas (#91). Call only with a transaction from withAuthor().

const columns = (idea: MyIdeaInput) => ({
	label: idea.label,
	note: idea.note,
	phase: idea.phase,
	windowFromDays: idea.window?.from_days ?? null,
	windowToDays: idea.window?.to_days ?? null,
	repeatable: idea.repeatable,
	sharedAt: idea.shared ? new Date() : null
});

export type MyIdeaRow = MyIdeaInput & { id: string };

const toIdea = (r: typeof authorIdeas.$inferSelect): MyIdeaRow => ({
	id: r.id,
	label: r.label,
	note: r.note,
	phase: r.phase,
	window:
		r.windowFromDays !== null && r.windowToDays !== null
			? { from_days: r.windowFromDays, to_days: r.windowToDays }
			: null,
	repeatable: r.repeatable,
	shared: r.sharedAt !== null
});

export async function listMyIdeas(tx: Executor, authorId: string) {
	const rows = await tx
		.select()
		.from(authorIdeas)
		.where(eq(authorIdeas.authorId, authorId))
		.orderBy(asc(authorIdeas.label));
	return rows.map(toIdea);
}

export async function getMyIdea(tx: Executor, authorId: string, id: string) {
	const [row] = await tx
		.select()
		.from(authorIdeas)
		.where(and(eq(authorIdeas.authorId, authorId), eq(authorIdeas.id, id)));
	return row ? toIdea(row) : null;
}

export async function insertMyIdea(tx: Executor, authorId: string, idea: MyIdeaInput) {
	const [row] = await tx
		.insert(authorIdeas)
		.values({ authorId, ...columns(idea) })
		.returning({ id: authorIdeas.id });
	return row!.id;
}

export async function updateMyIdea(tx: Executor, authorId: string, id: string, idea: MyIdeaInput) {
	const rows = await tx
		.update(authorIdeas)
		.set(columns(idea))
		.where(and(eq(authorIdeas.authorId, authorId), eq(authorIdeas.id, id)))
		.returning({ id: authorIdeas.id });
	return rows.length > 0;
}

/**
 * Deletes an idea and its "Not for this book" marks. Copies already on a timeline stay,
 * like any added step, until the author removes them.
 */
export async function deleteMyIdea(tx: Executor, authorId: string, id: string) {
	await tx
		.delete(ideaDismissals)
		.where(
			and(
				eq(ideaDismissals.authorId, authorId),
				eq(ideaDismissals.pack, MY_IDEAS_PACK),
				eq(ideaDismissals.stepId, id)
			)
		);
	const rows = await tx
		.delete(authorIdeas)
		.where(and(eq(authorIdeas.authorId, authorId), eq(authorIdeas.id, id)))
		.returning({ id: authorIdeas.id });
	return rows.length > 0;
}
