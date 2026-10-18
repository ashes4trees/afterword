import { eq, sql } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fieldAdvice } from '$lib/server/content/advice';
import type { Playbook } from '$lib/server/content/schema';
import { authors, decisions } from '$lib/server/db/schema';
import { withAuthor } from '$lib/server/db/tenant';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import type { ListingInput } from '$lib/shared/listingForm';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import { createBook } from './books';
import { addMarketListing, deleteListing, listingEditor, saveListing } from './listings';
import { comingUpFor } from './reminders';
import { setTaskDone } from './tasks';

const base: ListingInput = {
	status: 'live',
	externalId: null,
	priceMinor: null,
	currency: null,
	enrolledInSelect: false,
	exclusivityStart: null,
	exclusivityEnd: null,
	wholesaleDiscountPct: null,
	returnable: null
};
const enrolled = (end: string): ListingInput => ({
	...base,
	enrolledInSelect: true,
	exclusivityStart: '2026-10-01',
	exclusivityEnd: end
});

describe('fieldAdvice', () => {
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
	const pack: Playbook = {
		pack: 'kdp-setup',
		channel: 'kdp',
		kind: 'timeline',
		title: 'KDP',
		version: 1,
		as_of: '2026-09-01',
		sources: [{ url: 'https://example.com' }],
		steps: [
			step({
				id: 'select',
				fields: ['enrolled_in_select'],
				gotchas: ['Terms renew on their own.'],
				formats: ['ebook']
			}),
			step({ id: 'price', fields: ['price_minor'], gotchas: ['Royalty depends on price.'] })
		]
	};

	it("collects each field's pitfalls from the store's playbook, for this format only", () => {
		expect(fieldAdvice('kdp', 'ebook', [pack])).toEqual({
			enrolled_in_select: { gotchas: ['Terms renew on their own.'], asOf: '2026-09-01' },
			price_minor: { gotchas: ['Royalty depends on price.'], asOf: '2026-09-01' }
		});
		expect(Object.keys(fieldAdvice('kdp', 'paperback', [pack]))).toEqual(['price_minor']);
		expect(fieldAdvice('kobo', 'ebook', [pack])).toEqual({});
	});
});

describe.skipIf(!hasDatabase)('listing editor and decisions', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let book: string;

	const editor = () => listingEditor(app.db, me, book, 'kdp', 'ebook', null, []);
	const history = async () =>
		owner.db
			.select({
				id: decisions.id,
				choice: decisions.choice,
				until: decisions.commitsUntil,
				supersededBy: decisions.supersededBy
			})
			.from(decisions)
			.where(eq(decisions.authorId, me.id))
			.orderBy(decisions.decidedAt);

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		const [a] = await owner.db
			.insert(authors)
			.values({ email: `editor-${tag}@example.test`, displayName: 'E' })
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName });
		me = a!;
		book = await createBook(
			app.db,
			me,
			TitleInputSchema.parse({
				...EMPTY_TITLE_FORM,
				workingTitle: 'The Glass Archive',
				formats: 'ebook,paperback'
			})
		);
	});

	afterAll(async () => {
		if (me) await owner.db.delete(authors).where(eq(authors.id, me.id));
		await app?.client.end();
		await owner?.client.end();
	});

	it('creates a listing on first save, with its price, and offers KDP Select for the ebook only', async () => {
		expect((await editor())!.listing).toBeNull();
		await saveListing(app.db, me, book, 'kdp', 'ebook', null, {
			...base,
			priceMinor: 499,
			currency: 'USD',
			externalId: 'B0TEST'
		});
		const e = (await editor())!;
		expect(e.listing).toMatchObject({
			status: 'live',
			priceMinor: 499,
			currency: 'USD',
			externalId: 'B0TEST'
		});
		expect(e.program?.name).toBe('KDP Select');
		expect(
			(await listingEditor(app.db, me, book, 'kdp', 'paperback', null, []))!.program
		).toBeNull();
		expect(await history()).toEqual([]);
	});

	it('records a decision on enrolling, and supersedes it when the term end changes', async () => {
		await saveListing(app.db, me, book, 'kdp', 'ebook', null, enrolled('2026-12-30'));
		await saveListing(app.db, me, book, 'kdp', 'ebook', null, enrolled('2026-12-30'));
		await saveListing(app.db, me, book, 'kdp', 'ebook', null, enrolled('2027-03-30'));
		const h = await history();
		expect(h.map((d) => [d.choice, d.until])).toEqual([
			['Enrolled in KDP Select', '2026-12-30'],
			['Enrolled in KDP Select', '2027-03-30']
		]);
		expect(h[0]!.supersededBy).toBe(h[1]!.id);
		expect(h[1]!.supersededBy).toBeNull();
		expect((await editor())!.enrollment).toMatchObject({ commitsUntil: '2027-03-30' });
	});

	it('shows the term ending in Coming up, linking to the listing', async () => {
		const { items } = await comingUpFor(app.db, me, '2027-03-25', []);
		expect(items).toEqual([
			expect.objectContaining({
				kind: 'commitment',
				label: 'KDP Select term ends on Amazon KDP',
				subject: 'The Glass Archive · Ebook',
				daysUntil: 5,
				link: { kind: 'listing', titleId: book, channel: 'kdp', format: 'ebook' }
			})
		]);
	});

	it('records leaving, which ends the commitment', async () => {
		await saveListing(app.db, me, book, 'kdp', 'ebook', null, base);
		const h = await history();
		expect(h.at(-1)).toMatchObject({ choice: 'Left KDP Select', until: null });
		expect((await comingUpFor(app.db, me, '2027-03-25', [])).items).toEqual([]);
	});

	it('refuses to edit a decision, even as its owner', async () => {
		const [first] = await history();
		await expect(
			withAuthor(app.db, me.id, (tx) =>
				tx.update(decisions).set({ choice: 'Rewritten' }).where(eq(decisions.id, first!.id))
			)
		).rejects.toMatchObject({ cause: { code: '23514' } });
		await expect(
			owner.db.update(decisions).set({ supersededBy: first!.id }).where(eq(decisions.id, first!.id))
		).rejects.toMatchObject({ cause: { code: '23514' } });
	});

	it('tracks extra marketplaces separately, and removes them', async () => {
		await addMarketListing(app.db, me, book, 'kdp', 'ebook', 'GB');
		await saveListing(app.db, me, book, 'kdp', 'ebook', 'GB', { ...base, status: 'in_review' });
		const e = (await editor())!;
		expect(e.markets).toEqual([{ marketplace: 'GB', status: 'in_review' }]);
		expect(e.listing?.status).toBe('live');
		expect(await deleteListing(app.db, me, book, 'kdp', 'ebook', 'GB')).toBe(true);
		expect((await editor())!.markets).toEqual([]);
	});

	it('walks through store setup: readable before tracking, tickable after, on every tab', async () => {
		const setupPack: Playbook = {
			pack: 'print-setup',
			channel: 'ingram',
			kind: 'timeline',
			title: 'Ingram',
			version: 1,
			as_of: '2026-10-01',
			sources: [{ url: 'https://example.com' }],
			steps: [
				{ id: 'isbn', label: 'Get an ISBN', detail: 'One per format.', fields: ['external_id'] },
				{ id: 'discount', label: 'Set the discount', preconditions: ['isbn_assigned'] },
				{ id: 'ebook-only', label: 'Ebook thing', formats: ['ebook'] }
			].map((s) => ({
				fields: [],
				gotchas: [],
				links: [],
				preconditions: [],
				milestone: false,
				repeatable: false,
				...s
			})) as Playbook['steps']
		};
		const setup = async (market: string | null = null) =>
			(await listingEditor(app.db, me, book, 'ingram', 'paperback', market, [setupPack]))!.setup;

		const before = await setup();
		expect(before.asOf).toBe('2026-10-01');
		expect(before.steps.map((s) => [s.label, s.id, s.waitingOn])).toEqual([
			['Get an ISBN', null, []],
			['Set the discount', null, ['an ISBN']]
		]);

		await saveListing(app.db, me, book, 'ingram', 'paperback', null, base);
		const tracked = await setup();
		expect(tracked.steps.every((s) => s.id)).toBe(true);
		await setTaskDone(app.db, me, tracked.steps[0]!.id!, true);

		await saveListing(app.db, me, book, 'ingram', 'paperback', null, {
			...base,
			externalId: '9780000000000'
		});
		await addMarketListing(app.db, me, book, 'ingram', 'paperback', 'AU');
		const onMarketTab = await setup('AU');
		expect(onMarketTab.steps.map((s) => [s.label, s.done, s.waitingOn])).toEqual([
			['Get an ISBN', true, []],
			['Set the discount', false, []]
		]);
		await deleteListing(app.db, me, book, 'ingram', 'paperback', 'AU');
		await deleteListing(app.db, me, book, 'ingram', 'paperback', null);
	});

	it('deleting the account removes its decisions despite the append-only rule', async () => {
		const [temp] = await owner.db
			.insert(authors)
			.values({ email: `editor-tmp-${tag}@example.test`, displayName: 'T' })
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName });
		const b = await createBook(
			app.db,
			temp!,
			TitleInputSchema.parse({ ...EMPTY_TITLE_FORM, workingTitle: 'Tmp', formats: 'ebook' })
		);
		await saveListing(app.db, temp!, b, 'kdp', 'ebook', null, enrolled('2027-01-01'));
		await owner.db.delete(authors).where(eq(authors.id, temp!.id));
		const [left] = (await owner.db.execute(
			sql`select count(*)::int as n from decisions where author_id = ${temp!.id}`
		)) as unknown as [{ n: number }];
		expect(left.n).toBe(0);
	});
});
