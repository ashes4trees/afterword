import { PLAYBOOKS } from '$lib/server/content/playbooks';
import type { Playbook } from '$lib/server/content/schema';
import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import { plannedTasks, syncTasks, type ExistingTask } from '$lib/server/engine/tasks';
import type { SessionAuthor } from '$lib/server/repo/authors';
import * as listingsRepo from '$lib/server/repo/listings';
import * as tasksRepo from '$lib/server/repo/tasks';
import * as works from '$lib/server/repo/works';

// Keeps a book's playbook tasks in step with its formats, release date, and listings
// (#16). Called inside the same transaction as any change to those.

export async function syncTitleTasks(
	tx: Executor,
	authorId: string,
	titleId: string,
	packs: Playbook[] = PLAYBOOKS
) {
	const book = await works.getTitle(tx, authorId, titleId);
	if (!book) return;
	const listings = (await listingsRepo.listListings(tx, authorId)).filter(
		(l) => l.titleId === titleId && l.marketplace === null
	);
	const planned = plannedTasks(
		{ releaseDate: book.releaseDate, formats: book.formats },
		listings.map((l) => ({ channel: l.channelSlug, format: l.format, externalId: l.externalId })),
		packs
	);
	const existing: ExistingTask[] = (await tasksRepo.listTitleTasks(tx, authorId, titleId))
		.filter((t) => t.source === 'playbook')
		.map((t) => ({
			id: t.id,
			pack: t.pack!,
			stepId: t.stepId!,
			channel: t.channelSlug,
			format: t.format,
			packVersion: t.packVersion!,
			label: t.label,
			dueOn: t.dueOn,
			duePinned: t.duePinned,
			done: t.doneAt !== null,
			skipped: t.skippedAt !== null
		}));

	const changes = syncTasks(planned, existing);
	await tasksRepo.insertPlaybookTasks(tx, authorId, titleId, changes.create);
	for (const u of changes.update) await tasksRepo.updateTask(tx, authorId, u.id, u);
	await tasksRepo.deleteTasks(tx, authorId, changes.remove);
	return changes;
}

export function listBookTasks(db: Executor, author: SessionAuthor, titleId: string) {
	return withAuthor(db, author.id, (tx) => tasksRepo.listTitleTasks(tx, author.id, titleId));
}
