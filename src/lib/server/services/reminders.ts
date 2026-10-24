import { PLAYBOOKS } from '$lib/server/content/playbooks';
import type { Playbook } from '$lib/server/content/schema';
import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import { comingUp, reminderWindow, type DatedItem } from '$lib/server/engine/reminders';
import { packRef } from '$lib/server/engine/tasks';
import { getPreferences, updatePreferences, type SessionAuthor } from '$lib/server/repo/authors';
import * as decisionsRepo from '$lib/server/repo/decisions';
import * as tasksRepo from '$lib/server/repo/tasks';
import * as works from '$lib/server/repo/works';
import { CHANNELS, FORMAT_LABELS, type BookFormat } from '$lib/shared/channels';
import type { Preferences } from '$lib/shared/preferences';
import { syncTitleTasks } from './tasks';

// Reminder sources and the Coming up list (#46). Each source maps its rows to DatedItems;
// the engine decides what's due. Key dates are the first source; decisions (#26) and
// cadence (M4) add theirs here.

/** Milestone steps from title packs, open and dated, across every book. */
async function keyDateItems(tx: Executor, authorId: string, packs: Playbook[]) {
	const milestones = new Set(
		packs
			.filter((p) => !p.channel)
			.flatMap((p) => p.steps.filter((s) => s.milestone).map((s) => `${packRef(p)}|${s.id}`))
	);
	const rows = await tasksRepo.listOpenDatedTasks(tx, authorId);
	return rows
		.filter((t) => milestones.has(`${t.pack}|${t.stepId}`))
		.map((t) => ({
			item: {
				kind: 'key_date' as const,
				subject: t.bookTitle,
				date: t.dueOn!,
				label: t.label,
				key: `task:${t.id}`
			} satisfies DatedItem,
			link: { kind: 'timeline' as const, titleId: t.titleId }
		}));
}

/** Current exclusivity commitments (#12): "your KDP Select term ends in 7 days". */
async function commitmentItems(tx: Executor, authorId: string) {
	const rows = await decisionsRepo.listCurrentListingCommitments(tx, authorId);
	return rows.map((c) => {
		const store = CHANNELS.find((ch) => ch.slug === c.channelSlug)?.displayName ?? c.channelSlug;
		return {
			item: {
				kind: 'commitment' as const,
				subject: `${c.bookTitle} · ${FORMAT_LABELS[c.format as BookFormat]}`,
				date: c.commitsUntil!,
				label: `${c.choice.replace(/^Enrolled in /, '')} term ends on ${store}`,
				key: `decision:${c.id}`
			} satisfies DatedItem,
			link: {
				kind: 'listing' as const,
				titleId: c.titleId,
				channel: c.channelSlug,
				format: c.format as BookFormat
			}
		};
	});
}

/** Commitments logged by hand on a book or the whole account (#26). */
async function otherCommitmentItems(tx: Executor, authorId: string) {
	const rows = await decisionsRepo.listCurrentOtherCommitments(tx, authorId);
	return rows.map((c) => ({
		item: {
			kind: 'commitment' as const,
			subject: c.bookTitle ?? 'All your books',
			date: c.commitsUntil!,
			label: `Commitment ends: ${c.choice}`,
			key: `decision:${c.id}`
		} satisfies DatedItem,
		link: c.titleId
			? { kind: 'book_decisions' as const, titleId: c.titleId }
			: { kind: 'decisions' as const }
	}));
}

/** What's coming up for this author today, with the book each item belongs to. */
export async function comingUpFor(
	db: Executor,
	author: SessionAuthor,
	today: string,
	packs: Playbook[] = PLAYBOOKS
) {
	const { reminders, hide_overdue } = await getPreferences(db, author.id);
	return withAuthor(db, author.id, async (tx) => {
		// Keep every book's tasks current, so a pack change or new book shows up here.
		for (const book of await works.listTitles(tx, author.id)) {
			await syncTitleTasks(tx, author.id, book.id, packs);
		}
		const sources = [
			...(await keyDateItems(tx, author.id, packs)),
			...(await commitmentItems(tx, author.id)),
			...(await otherCommitmentItems(tx, author.id))
		];
		const linkFor = new Map(sources.map((s) => [s.item.key, s.link]));
		const all = comingUp(
			sources.map((s) => s.item),
			reminders,
			today
		);
		return {
			windowDays: reminderWindow(reminders),
			hideOverdue: hide_overdue,
			overdueHidden: hide_overdue ? all.filter((r) => r.overdue).length : 0,
			items: all
				.filter((r) => !(hide_overdue && r.overdue))
				.map((r) => ({ ...r, link: linkFor.get(r.key)! }))
		};
	});
}

export async function getReminderSettings(db: Executor, author: SessionAuthor) {
	return (await getPreferences(db, author.id)).reminders;
}

/** Shows or hides overdue items in Coming up. */
export async function setHideOverdue(db: Executor, author: SessionAuthor, hide: boolean) {
	await updatePreferences(db, author.id, { hide_overdue: hide });
}

/** Saves lead times. Throws a ZodError for invalid ones. */
export async function saveReminderSettings(
	db: Executor,
	author: SessionAuthor,
	reminders: Preferences['reminders']
) {
	await updatePreferences(db, author.id, { reminders });
}
