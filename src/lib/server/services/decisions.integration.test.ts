import { eq } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authors } from '$lib/server/db/schema';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import { createBook } from './books';
import { decisionLog, logDecision } from './decisions';
import { deleteListing, saveListing } from './listings';
import { comingUpFor } from './reminders';

describe.skipIf(!hasDatabase)('decision log (#26)', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let other: SessionAuthor;
	let lantern: string;
	let archive: string;
	const decision = (o: Partial<Parameters<typeof logDecision>[3]> = {}) => ({
		kind: 'pricing' as const,
		choice: 'Ebook at $4.99',
		rationale: null,
		commitsUntil: null,
		...o
	});

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		[me, other] = (await owner.db
			.insert(authors)
			.values([
				{ email: `dec-${tag}@example.test`, displayName: 'D' },
				{ email: `dec-other-${tag}@example.test`, displayName: 'E' }
			])
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName })) as [
			SessionAuthor,
			SessionAuthor
		];
		const book = (workingTitle: string) =>
			createBook(app.db, me, TitleInputSchema.parse({ ...EMPTY_TITLE_FORM, workingTitle }));
		lantern = await book('The Salt Lantern');
		archive = await book('The Glass Archive');
	});

	afterAll(async () => {
		for (const a of [me, other]) if (a) await owner.db.delete(authors).where(eq(authors.id, a.id));
		await app?.client.end();
		await owner?.client.end();
	});

	it('logs decisions about a book, a listing, and every book, newest first with their subject', async () => {
		await saveListing(app.db, me, lantern, 'kdp', 'ebook', null, {
			status: 'live',
			externalId: null,
			priceMinor: null,
			currency: null,
			enrolledInSelect: true,
			exclusivityStart: '2026-10-01',
			exclusivityEnd: '2026-12-30',
			wholesaleDiscountPct: null,
			returnable: null
		});
		expect(
			await logDecision(app.db, me, lantern, decision({ rationale: 'Matches the genre' }))
		).toBe(true);
		expect(
			await logDecision(
				app.db,
				me,
				null,
				decision({ kind: 'distribution', choice: 'Stay on Amazon for now' })
			)
		).toBe(true);

		const log = await decisionLog(app.db, me);
		expect(log.map((d) => [d.choice, d.subjectType, d.bookTitle, d.channelSlug])).toEqual([
			['Stay on Amazon for now', 'author', null, null],
			['Ebook at $4.99', 'title', 'The Salt Lantern', null],
			['Enrolled in KDP Select', 'listing', 'The Salt Lantern', 'kdp']
		]);
		expect(log[2]).toMatchObject({ commitsUntil: '2026-12-30', format: 'ebook', source: 'author' });
	});

	it("shows a book's own log, including its listings' decisions but not account-wide ones", async () => {
		const log = await decisionLog(app.db, me, lantern);
		expect(log.map((d) => d.choice)).toEqual(['Ebook at $4.99', 'Enrolled in KDP Select']);
		expect(await decisionLog(app.db, me, archive)).toEqual([]);
	});

	it('replaces the current decision of the same kind, keeping the old one as history', async () => {
		await logDecision(
			app.db,
			me,
			lantern,
			decision({ choice: 'Ebook at $3.99', commitsUntil: '2026-12-31' })
		);
		const pricing = (await decisionLog(app.db, me, lantern)).filter((d) => d.kind === 'pricing');
		expect(pricing.map((d) => [d.choice, d.supersededBy === null])).toEqual([
			['Ebook at $3.99', true],
			['Ebook at $4.99', false]
		]);
		expect(pricing[1]!.supersededBy).toBe(pricing[0]!.id);
		// Another book's pricing is its own subject, so nothing is replaced.
		await logDecision(app.db, me, archive, decision());
		expect((await decisionLog(app.db, me, archive))[0]!.supersededBy).toBeNull();
	});

	it('reminds the author before a logged commitment ends, linking back to the log', async () => {
		const today = '2026-12-28';
		const { items } = await comingUpFor(app.db, me, today, []);
		expect(items.filter((i) => i.label.startsWith('Commitment ends'))).toEqual([
			expect.objectContaining({
				kind: 'commitment',
				label: 'Commitment ends: Ebook at $3.99',
				subject: 'The Salt Lantern',
				daysUntil: 3,
				link: { kind: 'book_decisions', titleId: lantern }
			})
		]);
	});

	it("drops decisions whose listing is gone, and refuses another author's book", async () => {
		await deleteListing(app.db, me, lantern, 'kdp', 'ebook', null);
		expect((await decisionLog(app.db, me)).some((d) => d.subjectType === 'listing')).toBe(false);
		expect(await logDecision(app.db, other, lantern, decision())).toBe(false);
		expect(await decisionLog(app.db, other)).toEqual([]);
	});
});
