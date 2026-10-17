import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { ideaDismissals, tasks, titles } from '$lib/server/db/schema';
import type { Executor } from '$lib/server/db/types';
import type { PlannedTask } from '$lib/server/engine/tasks';

// Tasks (#16). Call only with a transaction from withAuthor().

export function listTitleTasks(tx: Executor, authorId: string, titleId: string) {
	return tx
		.select()
		.from(tasks)
		.where(and(eq(tasks.authorId, authorId), eq(tasks.titleId, titleId)))
		.orderBy(tasks.dueOn, tasks.createdAt);
}

export async function insertPlaybookTasks(
	tx: Executor,
	authorId: string,
	titleId: string,
	planned: PlannedTask[]
) {
	if (planned.length === 0) return;
	await tx.insert(tasks).values(
		planned.map((p) => ({
			authorId,
			titleId,
			source: 'playbook' as const,
			pack: p.pack,
			packVersion: p.packVersion,
			stepId: p.stepId,
			channelSlug: p.channel,
			format: p.format,
			label: p.label,
			dueOn: p.dueOn
		}))
	);
}

export async function updateTask(
	tx: Executor,
	authorId: string,
	id: string,
	values: Partial<
		Pick<
			typeof tasks.$inferInsert,
			'label' | 'packVersion' | 'dueOn' | 'duePinned' | 'doneAt' | 'skippedAt'
		>
	>
) {
	const rows = await tx
		.update(tasks)
		.set(values)
		.where(and(eq(tasks.authorId, authorId), eq(tasks.id, id)))
		.returning({ id: tasks.id });
	return rows.length > 0;
}

export async function deleteTasks(tx: Executor, authorId: string, ids: string[]) {
	if (ids.length === 0) return;
	await tx.delete(tasks).where(and(eq(tasks.authorId, authorId), inArray(tasks.id, ids)));
}

/** Open, dated playbook and idea tasks across every book, with each book's title, for reminders. */
export function listOpenDatedTasks(tx: Executor, authorId: string) {
	return tx
		.select({
			id: tasks.id,
			titleId: tasks.titleId,
			bookTitle: titles.workingTitle,
			pack: tasks.pack,
			stepId: tasks.stepId,
			label: tasks.label,
			dueOn: tasks.dueOn
		})
		.from(tasks)
		.innerJoin(titles, eq(titles.id, tasks.titleId))
		.where(
			and(
				eq(tasks.authorId, authorId),
				inArray(tasks.source, ['playbook', 'idea']),
				isNull(tasks.doneAt),
				isNull(tasks.skippedAt),
				isNotNull(tasks.dueOn)
			)
		);
}

/** Adds an idea to a book's timeline once per date (#84). */
export async function insertIdeaTasks(
	tx: Executor,
	authorId: string,
	titleId: string,
	idea: { pack: string; packVersion: number; stepId: string },
	entries: { label: string; dueOn: string | null }[]
) {
	if (entries.length === 0) return;
	await tx.insert(tasks).values(
		entries.map((e) => ({
			authorId,
			titleId,
			source: 'idea' as const,
			pack: idea.pack,
			packVersion: idea.packVersion,
			stepId: idea.stepId,
			label: e.label,
			dueOn: e.dueOn,
			duePinned: true
		}))
	);
}

export async function insertAuthorTask(
	tx: Executor,
	authorId: string,
	titleId: string,
	label: string,
	dueOn: string | null
) {
	await tx
		.insert(tasks)
		.values({ authorId, titleId, source: 'author', label, dueOn, duePinned: true });
}

/** Removes an idea or the author's own step. Playbook steps can be skipped, never removed. */
export async function deleteAddedTask(tx: Executor, authorId: string, id: string) {
	const rows = await tx
		.delete(tasks)
		.where(
			and(eq(tasks.authorId, authorId), eq(tasks.id, id), inArray(tasks.source, ['idea', 'author']))
		)
		.returning({ id: tasks.id });
	return rows.length > 0;
}

export function listDismissals(tx: Executor, authorId: string, titleId: string) {
	return tx
		.select({ pack: ideaDismissals.pack, stepId: ideaDismissals.stepId })
		.from(ideaDismissals)
		.where(and(eq(ideaDismissals.authorId, authorId), eq(ideaDismissals.titleId, titleId)));
}

export async function setDismissed(
	tx: Executor,
	authorId: string,
	titleId: string,
	pack: string,
	stepId: string,
	dismissed: boolean
) {
	if (dismissed) {
		await tx
			.insert(ideaDismissals)
			.values({ authorId, titleId, pack, stepId })
			.onConflictDoNothing();
	} else {
		await tx
			.delete(ideaDismissals)
			.where(
				and(
					eq(ideaDismissals.authorId, authorId),
					eq(ideaDismissals.titleId, titleId),
					eq(ideaDismissals.pack, pack),
					eq(ideaDismissals.stepId, stepId)
				)
			);
	}
}
