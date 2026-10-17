import { eq } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Playbook } from '$lib/server/content/schema';
import { authors } from '$lib/server/db/schema';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import { createBook, updateBook } from './books';
import { comingUpFor } from './reminders';
import {
	addIdea,
	addOwnStep,
	bookTimeline,
	removeAddedStep,
	setIdeaHidden,
	suggestedIdeaDate
} from './tasks';

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
		kind: 'timeline',
		title: 'Launch',
		version: 1,
		as_of: '2026-10-01',
		sources: [{ url: 'https://example.com' }],
		steps: [
			step({
				id: 'launch-day',
				label: 'Launch day',
				due: { anchor: 'release_date', offset_days: 0 }
			})
		]
	},
	{
		pack: 'promo-ideas',
		kind: 'ideas',
		title: 'Ideas',
		version: 2,
		as_of: '2026-10-02',
		sources: [{ url: 'https://example.com' }],
		steps: [
			step({ id: 'mood-board', label: 'Mood board', phase: 'writing' }),
			step({
				id: 'teaser',
				label: 'Teaser quote',
				phase: 'prelaunch',
				repeatable: true,
				window: { anchor: 'release_date', from_days: -42, to_days: -7 }
			}),
			step({
				id: 'trope-reveal',
				label: 'Trope reveal',
				phase: 'prelaunch',
				milestone: true,
				window: { anchor: 'release_date', from_days: -56, to_days: -35 }
			}),
			step({ id: 'audio-only', label: 'Audio idea', phase: 'launch', formats: ['audiobook'] })
		]
	}
];
const IDEAS = 'title/promo-ideas';
const TODAY = '2026-11-01';

describe('suggestedIdeaDate', () => {
	const w = { from_days: -42, to_days: -7 };
	it('is the window start before it opens, today inside or after it, today without a window', () => {
		expect(suggestedIdeaDate(w, '2027-02-07', '2026-11-01')).toBe('2026-12-27');
		expect(suggestedIdeaDate(w, '2027-02-07', '2027-01-10')).toBe('2027-01-10');
		expect(suggestedIdeaDate(w, '2027-02-07', '2027-03-01')).toBe('2027-03-01');
		expect(suggestedIdeaDate(undefined, '2027-02-07', TODAY)).toBe(TODAY);
		expect(suggestedIdeaDate(w, null, TODAY)).toBe(TODAY);
	});
});

describe.skipIf(!hasDatabase)('promo ideas on a timeline', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let book: string;
	const timeline = async () => (await bookTimeline(app.db, me, book, TODAY, packs))!;
	const input = {
		...EMPTY_TITLE_FORM,
		workingTitle: 'The Glass Archive',
		releaseDate: '2026-12-15',
		formats: 'ebook'
	};

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		const [a] = await owner.db
			.insert(authors)
			.values({ email: `ideas-${tag}@example.test`, displayName: 'I' })
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName });
		me = a!;
		book = await createBook(app.db, me, TitleInputSchema.parse(input));
	});

	afterAll(async () => {
		if (me) await owner.db.delete(authors).where(eq(authors.id, me.id));
		await app?.client.end();
		await owner?.client.end();
	});

	it('offers ideas by phase, never adds them on its own, and skips ideas for other formats', async () => {
		const t = await timeline();
		expect(t.steps.map((s) => s.label)).toEqual(['Launch day']);
		expect(t.ideas.map((g) => [g.phase, g.items.map((i) => i.label)])).toEqual([
			['writing', ['Mood board']],
			['prelaunch', ['Teaser quote', 'Trope reveal']]
		]);
		expect(t.ideasAsOf).toBe('2026-10-02');
		expect(t.ideas[1]!.items[0]!.suggestedDate).toBe('2026-11-03');
	});

	it('adds an idea once, or weekly with numbered labels, merged into the timeline by date', async () => {
		expect(
			await addIdea(
				app.db,
				me,
				book,
				{ pack: IDEAS, stepId: 'trope-reveal' },
				'2026-11-05',
				1,
				packs
			)
		).toBe(true);
		expect(
			await addIdea(app.db, me, book, { pack: IDEAS, stepId: 'teaser' }, '2026-11-10', 3, packs)
		).toBe(true);
		const t = await timeline();
		expect(t.steps.map((s) => [s.label, s.dueOn, s.source])).toEqual([
			['Trope reveal', '2026-11-05', 'idea'],
			['Teaser quote (1 of 3)', '2026-11-10', 'idea'],
			['Teaser quote (2 of 3)', '2026-11-17', 'idea'],
			['Teaser quote (3 of 3)', '2026-11-24', 'idea'],
			['Launch day', '2026-12-15', 'playbook']
		]);
		expect(t.ideas[1]!.items.find((i) => i.stepId === 'teaser')!.added).toBe(3);
	});

	it('refuses to repeat a one-off idea, or add one that does not exist', async () => {
		expect(
			await addIdea(app.db, me, book, { pack: IDEAS, stepId: 'trope-reveal' }, TODAY, 2, packs)
		).toBe(false);
		expect(await addIdea(app.db, me, book, { pack: IDEAS, stepId: 'nope' }, TODAY, 1, packs)).toBe(
			false
		);
	});

	it('keeps added ideas when the book is saved and tasks resync', async () => {
		await updateBook(
			app.db,
			me,
			book,
			TitleInputSchema.parse({ ...input, releaseDate: '2027-01-15' })
		);
		const labels = (await timeline()).steps.map((s) => s.label);
		expect(labels.filter((l) => l.startsWith('Teaser'))).toHaveLength(3);
		expect(labels).toContain('Trope reveal');
	});

	it('shows key-date ideas in Coming up', async () => {
		await comingUpFor(app.db, me, TODAY, packs).then(({ items }) =>
			expect(items.map((i) => i.label)).toContain('Trope reveal')
		);
	});

	it('adds and removes your own steps, but never removes core steps', async () => {
		expect(await addOwnStep(app.db, me, book, 'Email my street team', '2026-11-20')).toBe(true);
		const own = (await timeline()).steps.find((s) => s.label === 'Email my street team')!;
		expect(own.source).toBe('author');
		expect(await removeAddedStep(app.db, me, own.id)).toBe(true);
		const core = (await timeline()).steps.find((s) => s.label === 'Launch day')!;
		expect(await removeAddedStep(app.db, me, core.id)).toBe(false);
	});

	it('hides an idea for this book and brings it back', async () => {
		await setIdeaHidden(app.db, me, book, { pack: IDEAS, stepId: 'mood-board' }, true);
		let t = await timeline();
		expect(t.ideas.find((g) => g.phase === 'writing')).toBeUndefined();
		expect(t.hiddenIdeas.map((i) => i.label)).toEqual(['Mood board']);
		await setIdeaHidden(app.db, me, book, { pack: IDEAS, stepId: 'mood-board' }, false);
		t = await timeline();
		expect(t.hiddenIdeas).toEqual([]);
	});
});
