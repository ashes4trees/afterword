import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
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
	externalId: channelListings.externalId,
	enrolledInSelect: channelListings.enrolledInSelect,
	exclusivityStart: channelListings.exclusivityStart,
	exclusivityEnd: channelListings.exclusivityEnd,
	priceMinor: channelListings.priceMinor,
	currency: channelListings.currency,
	wholesaleDiscountPct: channelListings.wholesaleDiscountPct,
	returnable: channelListings.returnable,
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

/** One listing for a book, format, and store: the default (marketplace null) or one market. */
const oneListing = (
	authorId: string,
	titleId: string,
	channel: string,
	format: BookFormat,
	marketplace: string | null
) =>
	and(
		eq(channelListings.authorId, authorId),
		eq(channelListings.titleId, titleId),
		eq(channelListings.channelSlug, channel),
		eq(channelListings.format, format),
		marketplace === null
			? isNull(channelListings.marketplace)
			: eq(channelListings.marketplace, marketplace)
	);

export async function getListing(
	tx: Executor,
	authorId: string,
	titleId: string,
	channel: string,
	format: BookFormat,
	marketplace: string | null
) {
	const [row] = await tx
		.select(listingColumns)
		.from(channelListings)
		.where(oneListing(authorId, titleId, channel, format, marketplace));
	return row;
}

/** Marketplace-specific listings for a book, format, and store (not the default). */
export function listMarketListings(
	tx: Executor,
	authorId: string,
	titleId: string,
	channel: string,
	format: BookFormat
) {
	return tx
		.select({ marketplace: channelListings.marketplace, status: channelListings.status })
		.from(channelListings)
		.where(
			and(
				eq(channelListings.authorId, authorId),
				eq(channelListings.titleId, titleId),
				eq(channelListings.channelSlug, channel),
				eq(channelListings.format, format),
				isNotNull(channelListings.marketplace)
			)
		)
		.orderBy(asc(channelListings.marketplace));
}

export type ListingValues = Pick<
	typeof channelListings.$inferInsert,
	| 'status'
	| 'externalId'
	| 'priceMinor'
	| 'currency'
	| 'enrolledInSelect'
	| 'exclusivityStart'
	| 'exclusivityEnd'
	| 'wholesaleDiscountPct'
	| 'returnable'
>;

/** Creates or updates one listing, returning its id. */
export async function upsertListing(
	tx: Executor,
	authorId: string,
	titleId: string,
	channel: string,
	format: BookFormat,
	marketplace: string | null,
	values: Partial<ListingValues>
) {
	const [row] = await tx
		.insert(channelListings)
		.values({ authorId, titleId, channelSlug: channel, format, marketplace, ...values })
		.onConflictDoUpdate({
			target: [
				channelListings.titleId,
				channelListings.channelSlug,
				channelListings.format,
				channelListings.marketplace
			],
			set: { ...values, updatedAt: new Date() }
		})
		.returning({ id: channelListings.id });
	return row!.id;
}

export async function deleteListing(
	tx: Executor,
	authorId: string,
	titleId: string,
	channel: string,
	format: BookFormat,
	marketplace: string | null
) {
	const rows = await tx
		.delete(channelListings)
		.where(oneListing(authorId, titleId, channel, format, marketplace))
		.returning({ id: channelListings.id });
	return rows.length > 0;
}
