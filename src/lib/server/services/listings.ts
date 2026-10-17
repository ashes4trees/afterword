import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import { getPreferences, type SessionAuthor } from '$lib/server/repo/authors';
import * as listings from '$lib/server/repo/listings';
import * as works from '$lib/server/repo/works';
import type { ChannelSlug } from '$lib/shared/channels';
import type { ListingStatus } from '$lib/shared/listings';

// The listing matrix (#11): every book against every channel.

export async function listingMatrix(db: Executor, author: SessionAuthor) {
	const { default_channels } = await getPreferences(db, author.id);
	return withAuthor(db, author.id, async (tx) => ({
		books: await works.listTitles(tx, author.id),
		listings: await listings.listListings(tx, author.id),
		defaultChannels: default_channels as string[]
	}));
}

export function getListing(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	channel: ChannelSlug
) {
	return withAuthor(db, author.id, async (tx) => ({
		book: await works.getTitle(tx, author.id, titleId),
		listing: await listings.getDefaultListing(tx, author.id, titleId, channel)
	}));
}

/** Returns false if the book doesn't exist for this author. */
export function setListingStatus(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	channel: ChannelSlug,
	status: ListingStatus
) {
	return withAuthor(db, author.id, async (tx) => {
		if (!(await works.getTitle(tx, author.id, titleId))) return false;
		await listings.setDefaultListingStatus(tx, author.id, titleId, channel, status);
		return true;
	});
}

/** Returns false if there was no such listing. */
export function removeListing(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	channel: ChannelSlug
) {
	return withAuthor(db, author.id, (tx) =>
		listings.deleteDefaultListing(tx, author.id, titleId, channel)
	);
}
