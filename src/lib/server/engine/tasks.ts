import type { Playbook } from '$lib/server/content/schema';
import type { BookFormat } from '$lib/shared/channels';

// Task generation (#16): turns playbook steps into a checklist per book and per listing.
// Pure: callers pass the book, its listings, the packs, and the tasks already stored, and
// get back what to create, change, and remove.

/** Which pack, step, and (for channel packs) listing a task belongs to. */
export type TaskScope = {
	pack: string;
	stepId: string;
	channel: string | null;
	format: BookFormat | null;
};

export type PlannedTask = TaskScope & { packVersion: number; label: string; dueOn: string | null };

export type ExistingTask = TaskScope & {
	id: string;
	packVersion: number;
	label: string;
	dueOn: string | null;
	/** The author set the date by hand; it no longer follows the anchor. */
	duePinned: boolean;
	done: boolean;
	skipped: boolean;
};

export type TaskBook = { releaseDate: string | null; formats: BookFormat[] };
export type TaskListing = { channel: string; format: BookFormat; externalId: string | null };

/** "title/launch-timeline", "ingram/print-setup": stable across versions. */
export const packRef = (pack: Pick<Playbook, 'channel' | 'pack'>) =>
	`${pack.channel ?? 'title'}/${pack.pack}`;

export const scopeKey = (t: TaskScope) =>
	[t.pack, t.stepId, t.channel ?? '', t.format ?? ''].join('|');

/** A calendar date plus whole days, as YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

const dueOn = (step: Playbook['steps'][number], book: TaskBook) =>
	step.due && book.releaseDate ? addDays(book.releaseDate, step.due.offset_days) : null;

/**
 * Every task the packs call for. Title packs give one task per step per book, skipping
 * steps for formats the book isn't in. Channel packs give one task per step per listing
 * on that channel, skipping steps for other formats.
 */
export function plannedTasks(
	book: TaskBook,
	listings: TaskListing[],
	packs: Playbook[]
): PlannedTask[] {
	const tasks: PlannedTask[] = [];
	for (const pack of packs) {
		const base = { pack: packRef(pack), packVersion: pack.version };
		if (!pack.channel) {
			for (const step of pack.steps) {
				if (step.formats && !step.formats.some((f) => book.formats.includes(f))) continue;
				tasks.push({
					...base,
					stepId: step.id,
					channel: null,
					format: null,
					label: step.label,
					dueOn: dueOn(step, book)
				});
			}
			continue;
		}
		for (const listing of listings.filter((l) => l.channel === pack.channel)) {
			for (const step of pack.steps) {
				if (step.formats && !step.formats.includes(listing.format)) continue;
				tasks.push({
					...base,
					stepId: step.id,
					channel: listing.channel,
					format: listing.format,
					label: step.label,
					dueOn: dueOn(step, book)
				});
			}
		}
	}
	return tasks;
}

export type TaskChanges = {
	create: PlannedTask[];
	update: { id: string; label: string; packVersion: number; dueOn: string | null }[];
	remove: string[];
};

/**
 * What to change so stored tasks match the plan. Running it twice changes nothing the
 * second time. Done and skipped tasks are never changed, removed, or recreated. Open tasks
 * follow the plan's label and date, except a date the author pinned. Open tasks the plan
 * no longer calls for (a removed listing or step) are removed.
 */
export function syncTasks(planned: PlannedTask[], existing: ExistingTask[]): TaskChanges {
	const stored = new Map(existing.map((t) => [scopeKey(t), t]));
	const wanted = new Set(planned.map(scopeKey));
	const changes: TaskChanges = { create: [], update: [], remove: [] };

	for (const plan of planned) {
		const task = stored.get(scopeKey(plan));
		if (!task) {
			changes.create.push(plan);
			continue;
		}
		if (task.done || task.skipped) continue;
		const nextDue = task.duePinned ? task.dueOn : plan.dueOn;
		if (
			task.label !== plan.label ||
			task.dueOn !== nextDue ||
			task.packVersion !== plan.packVersion
		) {
			changes.update.push({
				id: task.id,
				label: plan.label,
				packVersion: plan.packVersion,
				dueOn: nextDue
			});
		}
	}
	for (const task of existing) {
		if (!task.done && !task.skipped && !wanted.has(scopeKey(task))) changes.remove.push(task.id);
	}
	return changes;
}

/**
 * Why a task can't be acted on yet: preconditions that are other steps not yet done or
 * skipped (in the same pack and listing), or facts that aren't true. Empty means ready.
 */
export function blockedBy(
	task: TaskScope,
	preconditions: string[],
	tasks: Pick<ExistingTask, keyof TaskScope | 'done' | 'skipped'>[],
	facts: { release_date_set: boolean; isbn_assigned: boolean }
): string[] {
	return preconditions.filter((p) => {
		if (p in facts) return !facts[p as keyof typeof facts];
		const prior = tasks.find(
			(t) =>
				t.pack === task.pack &&
				t.stepId === p &&
				t.channel === task.channel &&
				t.format === task.format
		);
		return !prior || !(prior.done || prior.skipped);
	});
}

/** The facts preconditions can name, for one book and (for channel packs) one listing. */
export function taskFacts(book: TaskBook, listing: TaskListing | null) {
	return { release_date_set: book.releaseDate !== null, isbn_assigned: !!listing?.externalId };
}
