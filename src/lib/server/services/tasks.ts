import { PLAYBOOKS } from '$lib/server/content/playbooks';
import type { Playbook } from '$lib/server/content/schema';
import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import {
	blockedBy,
	packRef,
	plannedTasks,
	syncTasks,
	taskFacts,
	type ExistingTask
} from '$lib/server/engine/tasks';
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

export type TimelineStep = {
	id: string;
	label: string;
	detail: string | null;
	gotchas: string[];
	links: { label: string; url: string }[];
	milestone: boolean;
	dueOn: string | null;
	duePinned: boolean;
	done: boolean;
	skipped: boolean;
	/** Labels of unmet preconditions; empty means the step can be done now. */
	waitingOn: string[];
};

export type Timeline = {
	pack: {
		title: string;
		version: number;
		asOf: string;
		sources: { url: string; title?: string }[];
	};
	steps: TimelineStep[];
};

const FACT_LABELS: Record<string, string> = {
	release_date_set: 'a release date',
	isbn_assigned: 'an ISBN'
};

/**
 * A book's title-pack timelines (#45), with each step's advice, dates, and what it's
 * waiting on. Syncs first, so a pack added or changed since the book was last saved
 * shows up here.
 */
export function bookTimelines(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	packs: Playbook[] = PLAYBOOKS
): Promise<Timeline[]> {
	return withAuthor(db, author.id, async (tx) => {
		const book = await works.getTitle(tx, author.id, titleId);
		if (!book) return [];
		await syncTitleTasks(tx, author.id, titleId, packs);
		const rows = await tasksRepo.listTitleTasks(tx, author.id, titleId);
		const facts = taskFacts({ releaseDate: book.releaseDate, formats: book.formats }, null);

		return packs
			.filter((p) => !p.channel)
			.map((pack) => {
				const ref = packRef(pack);
				const mine = rows.filter((t) => t.pack === ref);
				const scope = mine.map((t) => ({
					pack: t.pack!,
					stepId: t.stepId!,
					channel: t.channelSlug,
					format: t.format,
					done: t.doneAt !== null,
					skipped: t.skippedAt !== null
				}));
				const steps = pack.steps.flatMap((step): TimelineStep[] => {
					const task = mine.find((t) => t.stepId === step.id);
					if (!task) return [];
					const unmet = blockedBy(
						scope.find((s) => s.stepId === step.id)!,
						step.preconditions,
						scope,
						facts
					);
					return [
						{
							id: task.id,
							label: task.label,
							detail: step.detail ?? null,
							gotchas: step.gotchas,
							links: step.links,
							milestone: step.milestone,
							dueOn: task.dueOn,
							duePinned: task.duePinned,
							done: task.doneAt !== null,
							skipped: task.skippedAt !== null,
							waitingOn: unmet.map(
								(u) => FACT_LABELS[u] ?? pack.steps.find((s) => s.id === u)?.label ?? u
							)
						}
					];
				});
				return {
					pack: {
						title: pack.title,
						version: pack.version,
						asOf: pack.as_of,
						sources: pack.sources
					},
					steps
				};
			})
			.filter((t) => t.steps.length > 0);
	});
}

/** Marks a task done or not done. Done and skipped are exclusive. */
export function setTaskDone(db: Executor, author: SessionAuthor, id: string, done: boolean) {
	return withAuthor(db, author.id, (tx) =>
		tasksRepo.updateTask(
			tx,
			author.id,
			id,
			done ? { doneAt: new Date(), skippedAt: null } : { doneAt: null }
		)
	);
}

/** Skips a task for this book, or brings it back. */
export function setTaskSkipped(db: Executor, author: SessionAuthor, id: string, skipped: boolean) {
	return withAuthor(db, author.id, (tx) =>
		tasksRepo.updateTask(
			tx,
			author.id,
			id,
			skipped ? { skippedAt: new Date(), doneAt: null } : { skippedAt: null }
		)
	);
}

/**
 * Pins a task to a date the author chose, which then stays put when the release date
 * moves. Null unpins it, and it follows the schedule again.
 */
export function setTaskDue(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	id: string,
	dueOn: string | null
) {
	return withAuthor(db, author.id, async (tx) => {
		const ok = await tasksRepo.updateTask(
			tx,
			author.id,
			id,
			dueOn ? { dueOn, duePinned: true } : { duePinned: false }
		);
		if (ok && !dueOn) await syncTitleTasks(tx, author.id, titleId);
		return ok;
	});
}
