import { eq } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Playbook } from '$lib/server/content/schema';
import { authors, titles } from '$lib/server/db/schema';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import { createBook } from './books';
import { bookTimeline, setTaskDone, setTaskDue, setTaskSkipped } from './tasks';

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
const packs: Playbook[] = [
	{
		pack: 'launch-timeline',
		kind: 'timeline' as const,
		title: 'Launch timeline',
		version: 1,
		as_of: '2026-10-01',
		sources: [{ url: 'https://example.com', title: 'Example' }],
		steps: [
			step({ id: 'recruit', label: 'Recruit', due: { anchor: 'release_date', offset_days: -90 } }),
			step({
				id: 'send',
				label: 'Send',
				detail: 'Advice',
				gotchas: ['Careful'],
				preconditions: ['recruit'],
				due: { anchor: 'release_date', offset_days: -35 },
				milestone: true
			}),
			step({ id: 'audio', label: 'Audio', formats: ['audiobook'] })
		]
	}
];

describe.skipIf(!hasDatabase)('book timeline', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let book: string;

	const timeline = async () => (await bookTimeline(app.db, me, book, '2026-10-17', packs))!;
	const stepOf = async (id: string) => (await timeline()).steps.find((s) => s.label === id)!;

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		const [a] = await owner.db
			.insert(authors)
			.values({ email: `tl-${tag}@example.test`, displayName: 'T' })
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName });
		me = a!;
		book = await createBook(
			app.db,
			me,
			TitleInputSchema.parse({ ...EMPTY_TITLE_FORM, workingTitle: 'TL', releaseDate: '2027-02-07' })
		);
	});

	afterAll(async () => {
		if (me) await owner.db.delete(authors).where(eq(authors.id, me.id));
		await app?.client.end();
		await owner?.client.end();
	});

	it('lists dated steps with advice, pack details, and what each waits on', async () => {
		const t = await timeline();
		expect(t.asOf).toBe('2026-10-01');
		expect(t.steps.map((s) => [s.label, s.dueOn, s.milestone])).toEqual([
			['Recruit', '2026-11-09', false],
			['Send', '2027-01-03', true]
		]);
		expect(await stepOf('Send')).toMatchObject({
			detail: 'Advice',
			gotchas: ['Careful'],
			waitingOn: ['Recruit']
		});
	});

	it('marks done, which unblocks the next step', async () => {
		await setTaskDone(app.db, me, (await stepOf('Recruit')).id, true);
		expect((await stepOf('Recruit')).done).toBe(true);
		expect((await stepOf('Send')).waitingOn).toEqual([]);
	});

	it('skips and brings back a step', async () => {
		const id = (await stepOf('Send')).id;
		await setTaskSkipped(app.db, me, id, true);
		expect((await stepOf('Send')).skipped).toBe(true);
		await setTaskSkipped(app.db, me, id, false);
		expect((await stepOf('Send')).skipped).toBe(false);
	});

	it('pins a date through a release date change, then goes back to the schedule', async () => {
		const id = (await stepOf('Send')).id;
		await setTaskDue(app.db, me, book, id, '2026-12-25');
		await owner.db.update(titles).set({ releaseDate: '2027-03-07' }).where(eq(titles.id, book));
		expect(await stepOf('Send')).toMatchObject({ dueOn: '2026-12-25', duePinned: true });
		await setTaskDue(app.db, me, book, id, null);
		expect(await stepOf('Send')).toMatchObject({ dueOn: '2027-01-31', duePinned: false });
	});
});
