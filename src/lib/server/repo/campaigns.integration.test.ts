import { eq } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authors } from '$lib/server/db/schema';
import { withAuthor } from '$lib/server/db/tenant';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { createBook, deleteBook } from '$lib/server/services/books';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import { insertCampaign, insertReview, listCampaigns, listReviews } from './campaigns';

describe.skipIf(!hasDatabase)('campaigns and reviews (#19)', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let other: SessionAuthor;
	let book: string;
	let campaign: string;

	const campaignValues = (titleId: string) => ({
		titleId,
		channelSlug: 'kdp',
		marketplace: 'US',
		name: 'Salt Lantern auto',
		campaignType: 'sponsored_products' as const,
		targetingKind: 'auto' as const,
		dailyBudgetMinor: 500,
		currency: 'USD',
		startedAt: '2026-09-01'
	});

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		[me, other] = (await owner.db
			.insert(authors)
			.values([
				{ email: `ads-${tag}@example.test`, displayName: 'A' },
				{ email: `ads-other-${tag}@example.test`, displayName: 'B' }
			])
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName })) as [
			SessionAuthor,
			SessionAuthor
		];
		book = await createBook(
			app.db,
			me,
			TitleInputSchema.parse({ ...EMPTY_TITLE_FORM, workingTitle: 'The Salt Lantern' })
		);
		campaign = await withAuthor(app.db, me.id, (tx) =>
			insertCampaign(tx, me.id, campaignValues(book))
		);
	});

	afterAll(async () => {
		for (const a of [me, other]) if (a) await owner.db.delete(authors).where(eq(authors.id, a.id));
		await app?.client.end();
		await owner?.client.end();
	});

	it('records a verdict with its rule and inputs, complete without narration', async () => {
		const inputs = { days_live: 35, ad_spend_minor: 12000, acos: 1.33, acos_ceiling: 0.7 };
		await withAuthor(app.db, me.id, (tx) =>
			insertReview(tx, me.id, {
				campaignId: campaign,
				verdict: 'kill',
				ruleId: 'ad.kill.underperforming',
				ruleVersion: 1,
				inputs,
				explanation:
					'Live 35 days, $120.00 spent, $90.00 attributed, ACOS 133% against your 70% target.'
			})
		);
		const [review] = await withAuthor(app.db, me.id, (tx) => listReviews(tx, me.id, campaign));
		expect(review).toMatchObject({
			verdict: 'kill',
			ruleId: 'ad.kill.underperforming',
			inputs,
			narration: null,
			narrationModel: null
		});
	});

	it('refuses narration without the model that wrote it', async () => {
		await expect(
			withAuthor(app.db, me.id, (tx) =>
				insertReview(tx, me.id, {
					campaignId: campaign,
					verdict: 'keep',
					ruleId: 'ad.keep',
					ruleVersion: 1,
					inputs: {},
					explanation: 'Fine.',
					narration: 'Looks healthy.'
				})
			)
		).rejects.toMatchObject({ cause: { code: '23514' } });
	});

	it('keeps campaigns private to their author', async () => {
		expect(await withAuthor(app.db, other.id, (tx) => listCampaigns(tx, other.id))).toEqual([]);
		await expect(
			withAuthor(app.db, other.id, (tx) => insertCampaign(tx, other.id, campaignValues(book)))
		).rejects.toThrow();
	});

	it('removes campaigns and their reviews with the book', async () => {
		expect(await deleteBook(app.db, me, book)).toBe(true);
		expect(await withAuthor(app.db, me.id, (tx) => listCampaigns(tx, me.id))).toEqual([]);
	});
});
