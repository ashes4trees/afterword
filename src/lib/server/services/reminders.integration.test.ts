import { eq } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Playbook } from '$lib/server/content/schema';
import { authors, titles } from '$lib/server/db/schema';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { addDays } from '$lib/server/engine/tasks';
import { localToday } from '$lib/shared/bookList';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import { createBook, updateBook } from './books';
import {
	comingUpFor,
	getReminderSettings,
	saveReminderSettings,
	setHideOverdue
} from './reminders';
import { bookTimeline, setTaskDone, setTaskSkipped } from './tasks';

const step = (s: Partial<Playbook['steps'][number]> & { id: string }) => ({
	label: s.id,
	fields: [],
	gotchas: [],
	links: [],
	preconditions: [],
	milestone: false,
	repeatable: false,
	...s
});
const due = (offset_days: number) => ({ anchor: 'release_date' as const, offset_days });
const packs: Playbook[] = [
	{
		pack: 'launch-timeline',
		kind: 'timeline' as const,
		title: 'Launch',
		version: 1,
		as_of: '2026-10-01',
		sources: [{ url: 'https://example.com' }],
		steps: [
			step({ id: 'overdue-key', label: 'Overdue key date', due: due(-30), milestone: true }),
			step({ id: 'soon-key', label: 'Soon key date', due: due(-5), milestone: true }),
			step({ id: 'soon-plain', label: 'Soon but not key', due: due(-5) }),
			step({ id: 'far-key', label: 'Far key date', due: due(60), milestone: true })
		]
	}
];

describe.skipIf(!hasDatabase)('reminders and Coming up', () => {
	const tag = crypto.randomUUID();
	// Release on 2026-11-11: overdue key date 2026-10-12, soon key date 2026-11-06.
	const TODAY = '2026-11-01';
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let book: string;

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		const [a] = await owner.db
			.insert(authors)
			.values({ email: `rem-${tag}@example.test`, displayName: 'R' })
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName });
		me = a!;
		// Added on 2026-10-01, before its overdue key date, so that date still applies.
		const input = { ...EMPTY_TITLE_FORM, workingTitle: 'The Glass Archive' };
		book = await createBook(app.db, me, TitleInputSchema.parse(input));
		await owner.db
			.update(titles)
			.set({ createdAt: new Date('2026-10-01T12:00:00Z') })
			.where(eq(titles.id, book));
		await updateBook(
			app.db,
			me,
			book,
			TitleInputSchema.parse({ ...input, releaseDate: '2026-11-11' })
		);
	});

	afterAll(async () => {
		if (me) await owner.db.delete(authors).where(eq(authors.id, me.id));
		await app?.client.end();
		await owner?.client.end();
	});

	it('lists open key dates in the window and overdue ones, not plain steps or far dates', async () => {
		const { items, windowDays } = await comingUpFor(app.db, me, TODAY, packs);
		expect(windowDays).toBe(7);
		expect(items.map((i) => [i.label, i.daysUntil, i.overdue, i.lead])).toEqual([
			['Overdue key date', -20, true, null],
			['Soon key date', 5, false, 7]
		]);
		expect(items[0]).toMatchObject({
			subject: 'The Glass Archive',
			link: { kind: 'timeline', titleId: book }
		});
	});

	it('hides overdue items when the author asks, and counts them', async () => {
		await setHideOverdue(app.db, me, true);
		const hidden = await comingUpFor(app.db, me, TODAY, packs);
		expect(hidden).toMatchObject({ hideOverdue: true, overdueHidden: 1 });
		expect(hidden.items.map((i) => i.label)).toEqual(['Soon key date']);
		await setHideOverdue(app.db, me, false);
		const shown = await comingUpFor(app.db, me, TODAY, packs);
		expect(shown.overdueHidden).toBe(0);
		expect(shown.items.map((i) => i.label)).toEqual(['Overdue key date', 'Soon key date']);
	});

	it('drops a key date once it is done', async () => {
		const timeline = await bookTimeline(app.db, me, book, TODAY, packs);
		await setTaskDone(
			app.db,
			me,
			timeline!.steps.find((s) => s.label === 'Overdue key date')!.id,
			true
		);
		expect((await comingUpFor(app.db, me, TODAY, packs)).items.map((i) => i.label)).toEqual([
			'Soon key date'
		]);
	});

	it('saves lead times and per-kind overrides, which change the list', async () => {
		await saveReminderSettings(app.db, me, { lead_days: [3], by_kind: {} });
		expect((await comingUpFor(app.db, me, TODAY, packs)).items).toEqual([]);
		await saveReminderSettings(app.db, me, { lead_days: [3], by_kind: { key_date: [90] } });
		expect((await comingUpFor(app.db, me, TODAY, packs)).items.map((i) => i.label)).toEqual([
			'Soon key date',
			'Far key date'
		]);
		expect(await getReminderSettings(app.db, me)).toEqual({
			lead_days: [3],
			by_kind: { key_date: [90] }
		});
	});

	it('rejects invalid lead times', async () => {
		await expect(
			saveReminderSettings(app.db, me, { lead_days: [400], by_kind: {} })
		).rejects.toThrow();
		await expect(
			saveReminderSettings(app.db, me, { lead_days: [1, 2, 3, 4, 5, 6], by_kind: {} })
		).rejects.toThrow();
	});

	it('skips key dates that had passed when a book was added, until the author brings one back', async () => {
		// Added today, releasing in a week: last month's key date doesn't apply.
		const soon = await createBook(
			app.db,
			me,
			TitleInputSchema.parse({
				...EMPTY_TITLE_FORM,
				workingTitle: 'The Salt Lantern',
				releaseDate: addDays(localToday(), 7)
			})
		);
		const timeline = (await bookTimeline(app.db, me, soon, localToday(), packs))!;
		const overdue = timeline.steps.find((s) => s.label === 'Overdue key date')!;
		expect(overdue).toMatchObject({ skipped: true, passedOnAdd: true });
		const coming = await comingUpFor(app.db, me, localToday(), packs);
		const labels = coming.items.filter((i) => i.subject === 'The Salt Lantern').map((i) => i.label);
		expect(labels).toContain('Soon key date');
		expect(labels).not.toContain('Overdue key date');

		await setTaskSkipped(app.db, me, overdue.id, false);
		const back = (await bookTimeline(app.db, me, soon, localToday(), packs))!.steps.find(
			(s) => s.id === overdue.id
		);
		expect(back).toMatchObject({ skipped: false, passedOnAdd: false });
	});
});
