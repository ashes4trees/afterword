import { PLAYBOOKS } from '$lib/server/content/playbooks';
import {
	IDEA_PHASES,
	type IdeaPhase,
	type Playbook,
	type PlaybookStep
} from '$lib/server/content/schema';
import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import {
	addDays,
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
import type { BookFormat } from '$lib/shared/channels';

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
	/** playbook: a core step. idea: picked from the ideas library. author: their own. */
	source: 'playbook' | 'idea' | 'author';
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

export type IdeaView = {
	pack: string;
	stepId: string;
	label: string;
	detail: string | null;
	links: { label: string; url: string }[];
	repeatable: boolean;
	milestone: boolean;
	window: { from_days: number; to_days: number } | null;
	/** Today, held inside the idea's window, or today when there's no window or release date. */
	suggestedDate: string;
	/** How many times it's already on this book's timeline. */
	added: number;
};

export type BookTimeline = {
	/** When the timeline's advice was last reviewed. */
	asOf: string | null;
	steps: TimelineStep[];
	ideas: { phase: IdeaPhase; items: IdeaView[] }[];
	/** Ideas the author marked "Not for this book". */
	hiddenIdeas: IdeaView[];
	ideasAsOf: string | null;
};

const FACT_LABELS: Record<string, string> = {
	release_date_set: 'a release date',
	isbn_assigned: 'an ISBN'
};

const appliesTo = (step: PlaybookStep, formats: BookFormat[]) =>
	!step.formats || step.formats.some((f) => formats.includes(f));

/** Today, moved into [from, to] around the release date when there's a window. */
export function suggestedIdeaDate(
	window: { from_days: number; to_days: number } | undefined,
	releaseDate: string | null,
	today: string
) {
	if (!window || !releaseDate) return today;
	const from = addDays(releaseDate, window.from_days);
	// Before the window: its start. Inside it, or after it: today. Late beats never, and
	// the author can always pick another date.
	return today < from ? from : today;
}

/**
 * A book's whole timeline (#45, #84): core steps from title timelines, ideas the author
 * added, and their own steps, ordered by date (undated last, in pack order). Plus the
 * ideas library, grouped by phase, minus anything hidden for this book. Syncs first, so a
 * pack added or changed since the book was last saved shows up here.
 */
export function bookTimeline(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	today: string,
	packs: Playbook[] = PLAYBOOKS
): Promise<BookTimeline | null> {
	return withAuthor(db, author.id, async (tx) => {
		const book = await works.getTitle(tx, author.id, titleId);
		if (!book) return null;
		await syncTitleTasks(tx, author.id, titleId, packs);
		const rows = await tasksRepo.listTitleTasks(tx, author.id, titleId);
		const dismissed = new Set(
			(await tasksRepo.listDismissals(tx, author.id, titleId)).map((d) => `${d.pack}|${d.stepId}`)
		);
		const facts = taskFacts({ releaseDate: book.releaseDate, formats: book.formats }, null);
		const titlePacks = packs.filter((p) => !p.channel);
		const stepFor = new Map(
			titlePacks.flatMap((p) =>
				p.steps.map((s, i) => [`${packRef(p)}|${s.id}`, { pack: p, step: s, order: i }] as const)
			)
		);
		const scope = rows.map((t) => ({
			pack: t.pack ?? '',
			stepId: t.stepId ?? '',
			channel: t.channelSlug,
			format: t.format,
			done: t.doneAt !== null,
			skipped: t.skippedAt !== null
		}));

		const steps = rows
			.filter((t) => t.channelSlug === null)
			.flatMap((t): (TimelineStep & { order: number })[] => {
				const found = t.pack ? stepFor.get(`${t.pack}|${t.stepId}`) : undefined;
				// A playbook step that left its pack (and was never done) is cleaned up by sync.
				if (t.source !== 'author' && !found) return [];
				const step = found?.step;
				const unmet =
					t.source === 'playbook' && step
						? blockedBy(
								{ pack: t.pack!, stepId: t.stepId!, channel: null, format: null },
								step.preconditions,
								scope,
								facts
							)
						: [];
				return [
					{
						id: t.id,
						source: t.source,
						label: t.label,
						detail: step?.detail ?? null,
						gotchas: step?.gotchas ?? [],
						links: step?.links ?? [],
						milestone: step?.milestone ?? false,
						dueOn: t.dueOn,
						duePinned: t.duePinned,
						done: t.doneAt !== null,
						skipped: t.skippedAt !== null,
						waitingOn: unmet.map(
							(u) => FACT_LABELS[u] ?? found!.pack.steps.find((s) => s.id === u)?.label ?? u
						),
						order: found?.order ?? 1000
					}
				];
			})
			.sort((a, b) =>
				a.dueOn && b.dueOn
					? a.dueOn.localeCompare(b.dueOn) || a.order - b.order
					: a.dueOn
						? -1
						: b.dueOn
							? 1
							: a.order - b.order
			)
			.map(({ order: _order, ...step }) => step);

		const ideaPacks = titlePacks.filter((p) => p.kind === 'ideas');
		const allIdeas = ideaPacks.flatMap((p) =>
			p.steps
				.filter((s) => appliesTo(s, book.formats))
				.map((s) => ({
					phase: s.phase!,
					hidden: dismissed.has(`${packRef(p)}|${s.id}`),
					view: {
						pack: packRef(p),
						stepId: s.id,
						label: s.label,
						detail: s.detail ?? null,
						links: s.links,
						repeatable: s.repeatable,
						milestone: s.milestone,
						window: s.window ? { from_days: s.window.from_days, to_days: s.window.to_days } : null,
						suggestedDate: suggestedIdeaDate(s.window, book.releaseDate, today),
						added: rows.filter(
							(t) => t.source === 'idea' && t.pack === packRef(p) && t.stepId === s.id
						).length
					} satisfies IdeaView
				}))
		);

		const timelinePack = titlePacks.find((p) => p.kind === 'timeline');
		return {
			asOf: timelinePack?.as_of ?? null,
			steps,
			ideas: IDEA_PHASES.map((phase) => ({
				phase,
				items: allIdeas.filter((i) => i.phase === phase && !i.hidden).map((i) => i.view)
			})).filter((g) => g.items.length > 0),
			hiddenIdeas: allIdeas.filter((i) => i.hidden).map((i) => i.view),
			ideasAsOf: ideaPacks[0]?.as_of ?? null
		};
	});
}

/**
 * Adds an idea to a book's timeline, `times` times a week apart starting on `start`
 * (#84). Returns false if the book or idea doesn't exist, or a one-off idea is repeated.
 */
export function addIdea(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	idea: { pack: string; stepId: string },
	start: string,
	times: number,
	packs: Playbook[] = PLAYBOOKS
) {
	const pack = packs.find((p) => p.kind === 'ideas' && packRef(p) === idea.pack);
	const step = pack?.steps.find((s) => s.id === idea.stepId);
	if (!pack || !step || times < 1 || times > 8 || (times > 1 && !step.repeatable)) {
		return Promise.resolve(false);
	}
	return withAuthor(db, author.id, async (tx) => {
		if (!(await works.getTitle(tx, author.id, titleId))) return false;
		const entries = Array.from({ length: times }, (_, i) => ({
			label: times > 1 ? `${step.label} (${i + 1} of ${times})` : step.label,
			dueOn: addDays(start, 7 * i)
		}));
		await tasksRepo.insertIdeaTasks(
			tx,
			author.id,
			titleId,
			{ pack: idea.pack, packVersion: pack.version, stepId: step.id },
			entries
		);
		return true;
	});
}

/** Adds the author's own step. Returns false if the book doesn't exist. */
export function addOwnStep(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	label: string,
	dueOn: string | null
) {
	return withAuthor(db, author.id, async (tx) => {
		if (!(await works.getTitle(tx, author.id, titleId))) return false;
		await tasksRepo.insertAuthorTask(tx, author.id, titleId, label, dueOn);
		return true;
	});
}

/** Removes an added idea or own step. Core steps can only be skipped. */
export function removeAddedStep(db: Executor, author: SessionAuthor, id: string) {
	return withAuthor(db, author.id, (tx) => tasksRepo.deleteAddedTask(tx, author.id, id));
}

/** Hides an idea for one book ("Not for this book"), or brings it back. */
export function setIdeaHidden(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	idea: { pack: string; stepId: string },
	hidden: boolean
) {
	return withAuthor(db, author.id, async (tx) => {
		if (!(await works.getTitle(tx, author.id, titleId))) return false;
		await tasksRepo.setDismissed(tx, author.id, titleId, idea.pack, idea.stepId, hidden);
		return true;
	});
}

export type SetupStep = {
	stepId: string;
	/** The task to tick, once the listing is tracked. */
	id: string | null;
	label: string;
	detail: string | null;
	gotchas: string[];
	links: { label: string; url: string }[];
	done: boolean;
	skipped: boolean;
	waitingOn: string[];
};

/**
 * A store's setup walkthrough for one listing (#14, #15): its playbook steps in pack
 * order, with the listing's tasks once it's tracked. Untracked listings still get the
 * steps to read. Runs inside the caller's transaction.
 */
export async function listingSetup(
	tx: Executor,
	authorId: string,
	book: { id: string; releaseDate: string | null; formats: BookFormat[] },
	listing: { channel: string; format: BookFormat; externalId: string | null } | null,
	channel: string,
	format: BookFormat,
	packs: Playbook[] = PLAYBOOKS
): Promise<{ steps: SetupStep[]; asOf: string | null }> {
	const storePacks = packs.filter((p) => p.channel === channel && p.kind === 'timeline');
	if (listing) await syncTitleTasks(tx, authorId, book.id, packs);
	const rows = listing
		? (await tasksRepo.listTitleTasks(tx, authorId, book.id)).filter(
				(t) => t.channelSlug === channel && t.format === format
			)
		: [];
	const scope = rows.map((t) => ({
		pack: t.pack ?? '',
		stepId: t.stepId ?? '',
		channel: t.channelSlug,
		format: t.format,
		done: t.doneAt !== null,
		skipped: t.skippedAt !== null
	}));
	const facts = taskFacts(book, listing);
	const steps = storePacks.flatMap((pack) =>
		pack.steps
			.filter((s) => !s.formats || s.formats.includes(format))
			.map((step): SetupStep => {
				const task = rows.find((t) => t.pack === packRef(pack) && t.stepId === step.id);
				const unmet = blockedBy(
					{ pack: packRef(pack), stepId: step.id, channel, format },
					step.preconditions,
					scope,
					facts
				);
				return {
					stepId: step.id,
					id: task?.id ?? null,
					label: step.label,
					detail: step.detail ?? null,
					gotchas: step.gotchas,
					links: step.links,
					done: task?.doneAt != null,
					skipped: task?.skippedAt != null,
					waitingOn: unmet.map(
						(u) => FACT_LABELS[u] ?? pack.steps.find((s) => s.id === u)?.label ?? u
					)
				};
			})
	);
	const asOf =
		storePacks
			.map((p) => p.as_of)
			.sort()
			.at(-1) ?? null;
	return { steps, asOf };
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
