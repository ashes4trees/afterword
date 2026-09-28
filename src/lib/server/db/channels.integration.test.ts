import { eq, inArray, sql } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { CHANNELS } from '$lib/shared/channels';
import { authors, channelListings, channels, titles } from './schema';
import { withAuthor } from './tenant';
import type { Executor } from './types';

const pgError = (code: string) => ({ cause: { code } });

describe.skipIf(!hasDatabase)('channels and channel listings', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let a: string;
	let b: string;
	let bookA: string;
	let bookB: string;

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		[a, b] = (
			await owner.db
				.insert(authors)
				.values([
					{ email: `ch-a-${tag}@example.test`, displayName: 'A' },
					{ email: `ch-b-${tag}@example.test`, displayName: 'B' }
				])
				.returning({ id: authors.id })
		).map((r) => r.id) as [string, string];
		bookA = await withAuthor(app.db, a, async (tx) => {
			const [t] = await tx
				.insert(titles)
				.values({ authorId: a, workingTitle: 'A book' })
				.returning();
			return t!.id;
		});
		bookB = await withAuthor(app.db, b, async (tx) => {
			const [t] = await tx
				.insert(titles)
				.values({ authorId: b, workingTitle: 'B book' })
				.returning();
			return t!.id;
		});
	});

	afterAll(async () => {
		if (a && b) await owner.db.delete(authors).where(inArray(authors.id, [a, b]));
		await app?.client.end();
		await owner?.client.end();
	});

	const asA = <T>(fn: (tx: Executor) => Promise<T>) => withAuthor(app.db, a, fn);
	const listing = (fields: Partial<typeof channelListings.$inferInsert> = {}) => ({
		authorId: a,
		titleId: bookA,
		channelSlug: 'kdp',
		...fields
	});

	it('seeds exactly the channels defined in shared/channels.ts', async () => {
		const rows = await app.db.select().from(channels).orderBy(channels.slug);
		expect(rows).toEqual(
			[...CHANNELS]
				.map((c) => ({ slug: c.slug, displayName: c.displayName, capabilities: c.capabilities }))
				.sort((x, y) => x.slug.localeCompare(y.slug))
		);
	});

	it('the app can read channels but never change them', async () => {
		await expect(
			app.db.insert(channels).values({ slug: 'rogue', displayName: 'Rogue' })
		).rejects.toMatchObject(pgError('42501'));
		await app.db.update(channels).set({ displayName: 'Hacked' }).where(eq(channels.slug, 'kdp'));
		await app.db.delete(channels).where(eq(channels.slug, 'kobo'));
		const [kdp] = await app.db.select().from(channels).where(eq(channels.slug, 'kdp'));
		expect(kdp?.displayName).toBe('Amazon KDP');
		expect(await app.db.select().from(channels).where(eq(channels.slug, 'kobo'))).toHaveLength(1);
	});

	it('allows one default listing per book and channel, plus one per marketplace', async () => {
		await asA((tx) => tx.insert(channelListings).values(listing()));
		await asA((tx) =>
			tx
				.insert(channelListings)
				.values([listing({ marketplace: 'US' }), listing({ marketplace: 'GB' })])
		);
		await expect(asA((tx) => tx.insert(channelListings).values(listing()))).rejects.toMatchObject(
			pgError('23505')
		);
		await expect(
			asA((tx) => tx.insert(channelListings).values(listing({ marketplace: 'US' })))
		).rejects.toMatchObject(pgError('23505'));
	});

	it("rejects a listing for another author's book", async () => {
		await expect(
			asA((tx) => tx.insert(channelListings).values(listing({ titleId: bookB })))
		).rejects.toMatchObject(pgError('23503'));
	});

	it('rejects an unknown channel', async () => {
		await expect(
			asA((tx) => tx.insert(channelListings).values(listing({ channelSlug: 'smashwords' })))
		).rejects.toMatchObject(pgError('23503'));
	});

	it.each([
		['a price without a currency', { priceMinor: 499 }],
		['a currency without a price', { currency: 'USD' }],
		['a negative price', { priceMinor: -1, currency: 'USD' }],
		['a lowercase currency', { priceMinor: 499, currency: 'usd' }],
		['a three-letter marketplace', { marketplace: 'USA' }],
		[
			'exclusivity ending before it starts',
			{ exclusivityStart: '2027-03-01', exclusivityEnd: '2027-02-01' }
		],
		['a wholesale discount over 100', { wholesaleDiscountPct: 101 }]
	])('rejects %s', async (_label, fields) => {
		await expect(
			asA((tx) =>
				tx
					.insert(channelListings)
					.values(listing({ channelSlug: 'ingram', marketplace: 'CA', ...fields }))
			)
		).rejects.toMatchObject({ cause: { code: expect.stringMatching(/^(23514|22001)$/) } });
	});

	it('deleting a book deletes its listings', async () => {
		await asA((tx) => tx.delete(titles).where(eq(titles.id, bookA)));
		const [left] = (await owner.db.execute(
			sql`select count(*)::int as n from channel_listings where title_id = ${bookA}`
		)) as unknown as [{ n: number }];
		expect(left.n).toBe(0);
	});
});
