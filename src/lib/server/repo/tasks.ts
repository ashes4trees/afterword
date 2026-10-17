import { and, eq, inArray } from 'drizzle-orm';
import { tasks } from '$lib/server/db/schema';
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
