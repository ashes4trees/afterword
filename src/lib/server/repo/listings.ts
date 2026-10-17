import { and, eq, isNull } from 'drizzle-orm';
import { channelListings } from '$lib/server/db/schema';
import type { Executor } from '$lib/server/db/types';
import type { BookFormat } from '$lib/shared/channels';
import type { ListingStatus } from '$lib/shared/listings';

// Channel listings (#10, #11). Call only with a transaction from withAuthor().

const listingColumns = {
	id: channelListings.id,
	titleId: channelListings.titleId,
	channelSlug: channelListings.channelSlug,
	format: channelListings.format,
	marketplace: channelListings.marketplace,
	status: channelListings.status,
	enrolledInSelect: channelListings.enrolledInSelect,
	exclusivityEnd: channelListings.exclusivityEnd,
	updatedAt: channelListings.updatedAt
};

export function listListings(tx: Executor, authorId: string) {
	return tx
		.select(listingColumns)
		.from(channelListings)
		.where(eq(channelListings.authorId, authorId));
}

const defaultListing = (authorId: string, titleId: string, channel: string, format: BookFormat) =>
	and(
		eq(channelListings.authorId, authorId),
		eq(channelListings.titleId, titleId),
		eq(channelListings.channelSlug, channel),
		eq(channelListings.format, format),
		isNull(channelListings.marketplace)
	);

export async function getDefaultListing(
	tx: Executor,
	authorId: string,
	titleId: string,
	channel: string,
	format: BookFormat
) {
	const [row] = await tx
		.select(listingColumns)
		.from(channelListings)
		.where(defaultListing(authorId, titleId, channel, format));
	return row;
}

/** Sets the status of a book's default listing for one format on a channel, creating it if needed. */
export async function setDefaultListingStatus(
	tx: Executor,
	authorId: string,
	titleId: string,
	channel: string,
	format: BookFormat,
	status: ListingStatus
) {
	await tx
		.insert(channelListings)
		.values({ authorId, titleId, channelSlug: channel, format, status })
		.onConflictDoUpdate({
			target: [
				channelListings.titleId,
				channelListings.channelSlug,
				channelListings.format,
				channelListings.marketplace
			],
			set: { status, updatedAt: new Date() }
		});
}

export async function deleteDefaultListing(
	tx: Executor,
	authorId: string,
	titleId: string,
	channel: string,
	format: BookFormat
) {
	const rows = await tx
		.delete(channelListings)
		.where(defaultListing(authorId, titleId, channel, format))
		.returning({ id: channelListings.id });
	return rows.length > 0;
}
