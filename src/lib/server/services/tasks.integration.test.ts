import { eq } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Playbook } from '$lib/server/content/schema';
import { authors, channelListings, tasks, titles } from '$lib/server/db/schema';
import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import * as tasksRepo from '$lib/server/repo/tasks';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { syncTitleTasks } from './tasks';

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
		title: 'Launch',
		version: 1,
		as_of: '2026-10-01',
		sources: [{ url: 'https://example.com' }],
		steps: [
			step({ id: 'cover-reveal', due: { anchor: 'release_date', offset_days: -60 } }),
			step({ id: 'arc-recruit', due: { anchor: 'release_date', offset_days: -90 } })
		]
	},
	{
		pack: 'kdp-setup',
		kind: 'timeline' as const,
		channel: 'kdp',
		title: 'KDP',
		version: 1,
		as_of: '2026-10-01',
		sources: [{ url: 'https://example.com' }],
		steps: [step({ id: 'upload' })]
	}
];

describe.skipIf(!hasDatabase)('task sync against the database', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let authorId: string;
	let titleId: string;

	const as = <T>(fn: (tx: Executor) => Promise<T>) => withAuthor(app.db, authorId, fn);
	const sync = () => as((tx) => syncTitleTasks(tx, authorId, titleId, packs));
	const rows = () => as((tx) => tasksRepo.listTitleTasks(tx, authorId, titleId));
	const byStep = async () =>
		Object.fromEntries(
			(await rows()).map((t) => [`${t.stepId}${t.format ? `:${t.format}` : ''}`, t])
		);

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		const [a] = await owner.db
			.insert(authors)
			.values({ email: `tasks-${tag}@example.test`, displayName: 'T' })
			.returning();
		authorId = a!.id;
		titleId = await as(async (tx) => {
			const [t] = await tx
				.insert(titles)
				.values({
					authorId,
					workingTitle: 'Task book',
					releaseDate: '2027-02-07',
					formats: ['ebook']
				})
				.returning();
			await tx
				.insert(channelListings)
				.values({ authorId, titleId: t!.id, channelSlug: 'kdp', format: 'ebook' });
			return t!.id;
		});
	});

	afterAll(async () => {
		if (authorId) await owner.db.delete(authors).where(eq(authors.id, authorId));
		await app?.client.end();
		await owner?.client.end();
	});

	it('creates dated tasks once, and re-running adds nothing', async () => {
		await sync();
		const first = await byStep();
		expect(Object.keys(first).sort()).toEqual(['arc-recruit', 'cover-reveal', 'upload:ebook']);
		expect(first['cover-reveal']!.dueOn).toBe('2026-12-09');
		const again = await sync();
		expect(again).toEqual({ create: [], update: [], remove: [] });
		expect(await rows()).toHaveLength(3);
	});

	it('moves open tasks with the release date, but not pinned or done ones', async () => {
		const t = await byStep();
		await as((tx) =>
			tasksRepo.updateTask(tx, authorId, t['arc-recruit']!.id, {
				dueOn: '2026-11-01',
				duePinned: true
			})
		);
		await as((tx) =>
			tasksRepo.updateTask(tx, authorId, t['upload:ebook']!.id, { doneAt: new Date() })
		);
		await as((tx) =>
			tx.update(titles).set({ releaseDate: '2027-03-07' }).where(eq(titles.id, titleId))
		);
		await sync();
		const after = await byStep();
		expect(after['cover-reveal']!.dueOn).toBe('2027-01-06');
		expect(after['arc-recruit']!.dueOn).toBe('2026-11-01');
	});

	it('keeps done tasks when their listing goes, and never recreates them', async () => {
		await as((tx) => tx.delete(channelListings).where(eq(channelListings.titleId, titleId)));
		await sync();
		expect((await byStep())['upload:ebook']!.doneAt).not.toBeNull();
		await as((tx) =>
			tx.insert(channelListings).values({ authorId, titleId, channelSlug: 'kdp', format: 'ebook' })
		);
		await sync();
		expect((await rows()).filter((r) => r.stepId === 'upload')).toHaveLength(1);
	});

	it('removes open tasks whose listing goes away', async () => {
		const t = await byStep();
		await as((tx) => tasksRepo.updateTask(tx, authorId, t['upload:ebook']!.id, { doneAt: null }));
		await as((tx) => tx.delete(channelListings).where(eq(channelListings.titleId, titleId)));
		await sync();
		expect((await byStep())['upload:ebook']).toBeUndefined();
	});

	it('refuses a duplicate playbook task at the database level', async () => {
		const t = (await byStep())['cover-reveal']!;
		await expect(
			as((tx) =>
				tx.insert(tasks).values({
					authorId,
					titleId,
					source: 'playbook',
					pack: t.pack,
					packVersion: 1,
					stepId: t.stepId,
					label: 'dup'
				})
			)
		).rejects.toMatchObject({ cause: { code: '23505' } });
	});
});
