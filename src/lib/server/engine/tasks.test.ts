import { describe, expect, it } from 'vitest';
import type { Playbook } from '$lib/server/content/schema';
import {
	addDays,
	blockedBy,
	plannedTasks,
	syncTasks,
	taskFacts,
	type ExistingTask,
	type PlannedTask
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

const launch: Playbook = {
	pack: 'launch-timeline',
	kind: 'timeline' as const,
	title: 'Launch',
	version: 1,
	as_of: '2026-10-01',
	sources: [{ url: 'https://example.com' }],
	steps: [
		step({ id: 'arc-recruit', due: { anchor: 'release_date', offset_days: -90 } }),
		step({
			id: 'cover-reveal',
			due: { anchor: 'release_date', offset_days: -60 },
			milestone: true
		}),
		step({ id: 'audio-codes', formats: ['audiobook'] }),
		step({ id: 'reviews', preconditions: ['cover-reveal', 'release_date_set'] })
	]
};

const kdp: Playbook = {
	pack: 'kdp-setup',
	kind: 'timeline' as const,
	channel: 'kdp',
	title: 'KDP setup',
	version: 2,
	as_of: '2026-10-01',
	sources: [{ url: 'https://example.com' }],
	steps: [
		step({ id: 'isbn', formats: ['paperback'] }),
		step({ id: 'upload', preconditions: ['isbn_assigned'] })
	]
};

const book = { releaseDate: '2027-02-07', formats: ['ebook', 'paperback'] as const };
const kdpEbook = { channel: 'kdp', format: 'ebook' as const, externalId: null };
const kdpPaper = { channel: 'kdp', format: 'paperback' as const, externalId: '978-0' };

const stored = (p: PlannedTask, fields: Partial<ExistingTask> = {}): ExistingTask => ({
	...p,
	id: `${p.stepId}:${p.format ?? ''}`,
	duePinned: false,
	done: false,
	skipped: false,
	...fields
});

describe('addDays', () => {
	it('crosses months and leap days in UTC', () => {
		expect(addDays('2027-02-07', -90)).toBe('2026-11-09');
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
	});
});

describe('plannedTasks', () => {
	const plan = plannedTasks(
		{ ...book, formats: [...book.formats] },
		[kdpEbook, kdpPaper],
		[launch, kdp]
	);
	const keys = plan.map((t) => [t.pack, t.stepId, t.channel, t.format, t.dueOn]);

	it('gives title packs one task per step, dated from the release date', () => {
		expect(keys.filter((k) => k[0] === 'title/launch-timeline')).toEqual([
			['title/launch-timeline', 'arc-recruit', null, null, '2026-11-09'],
			['title/launch-timeline', 'cover-reveal', null, null, '2026-12-09'],
			['title/launch-timeline', 'reviews', null, null, null]
		]);
	});

	it('skips steps for formats the book or listing is not in', () => {
		expect(keys.some((k) => k[1] === 'audio-codes')).toBe(false);
		expect(keys.filter((k) => k[0] === 'kdp/kdp-setup')).toEqual([
			['kdp/kdp-setup', 'upload', 'kdp', 'ebook', null],
			['kdp/kdp-setup', 'isbn', 'kdp', 'paperback', null],
			['kdp/kdp-setup', 'upload', 'kdp', 'paperback', null]
		]);
	});

	it('leaves due dates empty until the book has a release date', () => {
		const undated = plannedTasks({ releaseDate: null, formats: ['ebook'] }, [], [launch]);
		expect(undated.every((t) => t.dueOn === null)).toBe(true);
	});
});

describe('syncTasks', () => {
	const plan = plannedTasks({ ...book, formats: [...book.formats] }, [kdpEbook], [launch, kdp]);

	it('creates everything the first time and nothing the second', () => {
		const first = syncTasks(plan, []);
		expect(first.create).toHaveLength(plan.length);
		const second = syncTasks(
			plan,
			plan.map((p) => stored(p))
		);
		expect(second).toEqual({ create: [], update: [], remove: [] });
	});

	it('skips key dates already past when the book was added, but not plain steps', () => {
		const launchOnly = plannedTasks(
			{ releaseDate: '2027-02-07', formats: ['ebook'] },
			[],
			[launch]
		);
		const late = syncTasks(launchOnly, [], '2026-12-20');
		expect(late.create.map((t) => [t.stepId, t.dueOn, t.passedOnAdd])).toEqual([
			['arc-recruit', '2026-11-09', false],
			['cover-reveal', '2026-12-09', true],
			['reviews', null, false]
		]);
		expect(syncTasks(launchOnly, [], '2026-12-01').create.every((t) => !t.passedOnAdd)).toBe(true);
	});

	it('skips a key date whose first date is already past the day the book was added', () => {
		const undated = plannedTasks({ releaseDate: null, formats: ['ebook'] }, [], [launch]);
		const dated = plannedTasks({ releaseDate: '2027-02-07', formats: ['ebook'] }, [], [launch]);
		const { update } = syncTasks(
			dated,
			undated.map((p) => stored(p)),
			'2026-12-20'
		);
		expect(update.find((u) => u.id.startsWith('cover-reveal'))).toMatchObject({
			dueOn: '2026-12-09',
			passedOnAdd: true
		});
		expect(update.find((u) => u.id.startsWith('arc-recruit'))).not.toHaveProperty('passedOnAdd');
		// A date that moves into the past later is just overdue, not skipped.
		const moved = plannedTasks({ releaseDate: '2027-01-07', formats: ['ebook'] }, [], [launch]);
		const again = syncTasks(
			moved,
			dated.map((p) => stored(p, { dueOn: p.dueOn })),
			'2026-12-20'
		);
		expect(again.update.some((u) => u.passedOnAdd)).toBe(false);
	});

	it('moves open tasks when the release date moves, but not pinned dates', () => {
		const moved = plannedTasks({ releaseDate: '2027-03-07', formats: ['ebook'] }, [], [launch]);
		const existing = plan
			.filter((p) => p.pack === 'title/launch-timeline')
			.map((p) => stored(p, { duePinned: p.stepId === 'cover-reveal', dueOn: p.dueOn }));
		const { update } = syncTasks(moved, existing);
		expect(update).toEqual([
			{ id: 'arc-recruit:', label: 'arc-recruit', packVersion: 1, dueOn: '2026-12-07' }
		]);
	});

	it('never changes, removes, or recreates done or skipped tasks', () => {
		const existing = plan.map((p) =>
			stored(p, {
				done: p.stepId === 'arc-recruit',
				skipped: p.stepId === 'reviews',
				dueOn: '1999-01-01'
			})
		);
		const changes = syncTasks([], existing);
		expect(changes.create).toEqual([]);
		expect(changes.remove).not.toContain('arc-recruit:');
		expect(changes.remove).not.toContain('reviews:');
		expect(syncTasks(plan, existing).update.map((u) => u.id)).not.toContain('arc-recruit:');
	});

	it('removes open tasks for a listing that no longer exists', () => {
		const existing = plan.map((p) => stored(p));
		const withoutKdp = plannedTasks({ ...book, formats: [...book.formats] }, [], [launch, kdp]);
		expect(syncTasks(withoutKdp, existing).remove).toEqual(['upload:ebook']);
	});

	it('updates labels and versions when a pack changes', () => {
		const existing = plan.map((p) => stored(p, { label: 'old', packVersion: 0 }));
		expect(syncTasks(plan, existing).update).toHaveLength(plan.length);
	});
});

describe('blockedBy', () => {
	const facts = taskFacts({ releaseDate: null, formats: ['ebook'] }, null);
	const reviews = { pack: 'title/launch-timeline', stepId: 'reviews', channel: null, format: null };
	const cover = { ...reviews, stepId: 'cover-reveal', done: false, skipped: false };

	it('lists unmet steps and facts', () => {
		expect(blockedBy(reviews, ['cover-reveal', 'release_date_set'], [cover], facts)).toEqual([
			'cover-reveal',
			'release_date_set'
		]);
	});

	it('treats done or skipped steps and true facts as met', () => {
		const ready = taskFacts({ releaseDate: '2027-01-01', formats: ['ebook'] }, null);
		expect(
			blockedBy(reviews, ['cover-reveal', 'release_date_set'], [{ ...cover, skipped: true }], ready)
		).toEqual([]);
	});

	it('reads isbn_assigned from the listing', () => {
		expect(taskFacts({ releaseDate: null, formats: [] }, kdpPaper).isbn_assigned).toBe(true);
		expect(taskFacts({ releaseDate: null, formats: [] }, kdpEbook).isbn_assigned).toBe(false);
	});

	it("ignores a step that doesn't apply, such as the ebook preorder on a print-only book", () => {
		const ready = taskFacts({ releaseDate: '2027-01-01', formats: ['paperback'] }, null);
		expect(blockedBy(reviews, ['cover-reveal'], [], ready)).toEqual([]);
	});
});
