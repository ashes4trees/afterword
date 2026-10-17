import { inArray } from 'drizzle-orm';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authors } from '$lib/server/db/schema';
import type { SessionAuthor } from '$lib/server/repo/authors';
import { connect, connectOwner, hasDatabase, type TestDb } from '$lib/server/testing/db';
import { CHANNEL_SLUGS } from '$lib/shared/channels';
import { EMPTY_TITLE_FORM, TitleInputSchema } from '$lib/shared/titles';
import { createBook } from './books';
import {
	getListing,
	listingMatrix,
	removeListing,
	setHiddenChannels,
	setListingStatus
} from './listings';

describe.skipIf(!hasDatabase)('listings service', () => {
	const tag = crypto.randomUUID();
	let owner: { client: postgres.Sql; db: TestDb };
	let app: { client: postgres.Sql; db: TestDb };
	let me: SessionAuthor;
	let other: SessionAuthor;
	let book: string;

	beforeAll(async () => {
		owner = connectOwner();
		app = connect();
		[me, other] = (await owner.db
			.insert(authors)
			.values([
				{ email: `lst-me-${tag}@example.test`, displayName: 'Me' },
				{ email: `lst-other-${tag}@example.test`, displayName: 'Other' }
			])
			.returning({ id: authors.id, email: authors.email, displayName: authors.displayName })) as [
			SessionAuthor,
			SessionAuthor
		];
		book = await createBook(
			app.db,
			me,
			TitleInputSchema.parse({ ...EMPTY_TITLE_FORM, workingTitle: 'Matrix book' })
		);
	});

	afterAll(async () => {
		if (me && other) await owner.db.delete(authors).where(inArray(authors.id, [me.id, other.id]));
		await app?.client.end();
		await owner?.client.end();
	});

	it('creates a listing on first status, then updates the same row', async () => {
		expect(await setListingStatus(app.db, me, book, 'kdp', 'ebook', 'metadata_draft')).toBe(true);
		const first = (await getListing(app.db, me, book, 'kdp', 'ebook')).listing;
		expect(first?.status).toBe('metadata_draft');

		await setListingStatus(app.db, me, book, 'kdp', 'ebook', 'live');
		const { listings } = await listingMatrix(app.db, me);
		expect(listings).toHaveLength(1);
		expect(listings[0]).toMatchObject({ id: first!.id, status: 'live', channelSlug: 'kdp' });
	});

	it("can't touch another author's book", async () => {
		expect(await setListingStatus(app.db, other, book, 'kobo', 'ebook', 'live')).toBe(false);
		expect(await removeListing(app.db, other, book, 'kdp', 'ebook')).toBe(false);
		expect((await listingMatrix(app.db, other)).listings).toEqual([]);
		expect((await getListing(app.db, me, book, 'kdp', 'ebook')).listing?.status).toBe('live');
	});

	it('tracks formats separately and refuses formats a store does not sell', async () => {
		await setListingStatus(app.db, me, book, 'kdp', 'paperback', 'in_review');
		expect((await getListing(app.db, me, book, 'kdp', 'ebook')).listing?.status).toBe('live');
		expect((await getListing(app.db, me, book, 'kdp', 'paperback')).listing?.status).toBe(
			'in_review'
		);
		expect(() => setListingStatus(app.db, me, book, 'acx', 'ebook', 'live')).toThrow(
			/doesn't sell/
		);
		await removeListing(app.db, me, book, 'kdp', 'paperback');
	});

	it('removes a listing', async () => {
		expect(await removeListing(app.db, me, book, 'kdp', 'ebook')).toBe(true);
		expect((await getListing(app.db, me, book, 'kdp', 'ebook')).listing).toBeUndefined();
		expect(await removeListing(app.db, me, book, 'kdp', 'ebook')).toBe(false);
	});

	it('saves which stores are hidden, per author', async () => {
		expect((await listingMatrix(app.db, me)).hiddenChannels).toEqual([]);
		await setHiddenChannels(app.db, me, ['kobo', 'apple']);
		expect((await listingMatrix(app.db, me)).hiddenChannels).toEqual(['kobo', 'apple']);
		expect((await listingMatrix(app.db, other)).hiddenChannels).toEqual([]);
		await setHiddenChannels(app.db, me, []);
		expect((await listingMatrix(app.db, me)).hiddenChannels).toEqual([]);
	});

	it('refuses to hide every store', async () => {
		await expect(setHiddenChannels(app.db, me, [...CHANNEL_SLUGS])).rejects.toThrow();
	});
});
