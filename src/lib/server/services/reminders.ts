import { PLAYBOOKS } from '$lib/server/content/playbooks';
import type { Playbook } from '$lib/server/content/schema';
import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import { comingUp, type DatedItem } from '$lib/server/engine/reminders';
import { packRef } from '$lib/server/engine/tasks';
import { getPreferences, updatePreferences, type SessionAuthor } from '$lib/server/repo/authors';
import * as tasksRepo from '$lib/server/repo/tasks';
import * as works from '$lib/server/repo/works';
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
			titleId: t.titleId
		}));
}

/** What's coming up for this author today, with the book each item belongs to. */
export async function comingUpFor(
	db: Executor,
	author: SessionAuthor,
	today: string,
	packs: Playbook[] = PLAYBOOKS
) {
	const { reminders } = await getPreferences(db, author.id);
	return withAuthor(db, author.id, async (tx) => {
		// Keep every book's tasks current, so a pack change or new book shows up here.
		for (const book of await works.listTitles(tx, author.id)) {
			await syncTitleTasks(tx, author.id, book.id, packs);
		}
		const sources = await keyDateItems(tx, author.id, packs);
		const titleFor = new Map(sources.map((s) => [s.item.key, s.titleId]));
		return {
			leadDays: reminders.lead_days,
			items: comingUp(
				sources.map((s) => s.item),
				reminders,
				today
			).map((r) => ({ ...r, titleId: titleFor.get(r.key)! }))
		};
	});
}

export async function getReminderSettings(db: Executor, author: SessionAuthor) {
	return (await getPreferences(db, author.id)).reminders;
}

/** Saves lead times. Throws a ZodError for invalid ones. */
export async function saveReminderSettings(
	db: Executor,
	author: SessionAuthor,
	reminders: Preferences['reminders']
) {
	await updatePreferences(db, author.id, { reminders });
}
