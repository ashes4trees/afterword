import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import { getPreferences, updatePreferences, type SessionAuthor } from '$lib/server/repo/authors';
import * as importsRepo from '$lib/server/repo/imports';
import * as listings from '$lib/server/repo/listings';
import * as works from '$lib/server/repo/works';
import { listingSetup, syncTitleTasks } from './tasks';
import { PLAYBOOKS } from '$lib/server/content/playbooks';
import { fieldAdvice } from '$lib/server/content/advice';
import type { Playbook } from '$lib/server/content/schema';
import * as decisionsRepo from '$lib/server/repo/decisions';
import {
	exclusiveProgram,
	hasPrintTerms,
	sellsFormat,
	type BookFormat,
	type ChannelSlug
} from '$lib/shared/channels';
import type { ListingInput } from '$lib/shared/listingForm';
import type { ListingStatus } from '$lib/shared/listings';

// The listing matrix (#11): every book against every channel.

export async function listingMatrix(db: Executor, author: SessionAuthor) {
	const { hidden_channels } = await getPreferences(db, author.id);
	return withAuthor(db, author.id, async (tx) => ({
		books: await works.listTitles(tx, author.id),
		listings: await listings.listListings(tx, author.id),
		hiddenChannels: hidden_channels as string[]
	}));
}

export function getListing(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	channel: ChannelSlug,
	format: BookFormat
) {
	return withAuthor(db, author.id, async (tx) => ({
		book: await works.getTitle(tx, author.id, titleId),
		listing: await listings.getDefaultListing(tx, author.id, titleId, channel, format)
	}));
}

/**
 * Returns false if the book doesn't exist for this author. Throws if the store doesn't
 * sell the format; callers check that first so they can explain it.
 */
export function setListingStatus(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	channel: ChannelSlug,
	format: BookFormat,
	status: ListingStatus
) {
	if (!sellsFormat(channel, format)) throw new Error(`${channel} doesn't sell ${format}`);
	return withAuthor(db, author.id, async (tx) => {
		if (!(await works.getTitle(tx, author.id, titleId))) return false;
		await listings.setDefaultListingStatus(tx, author.id, titleId, channel, format, status);
		await syncTitleTasks(tx, author.id, titleId);
		return true;
	});
}

/** Returns false if there was no such listing. */
export function removeListing(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	channel: ChannelSlug,
	format: BookFormat
) {
	return withAuthor(db, author.id, async (tx) => {
		const removed = await listings.deleteDefaultListing(tx, author.id, titleId, channel, format);
		if (removed) await syncTitleTasks(tx, author.id, titleId);
		return removed;
	});
}

/** Saves which stores the matrix leaves out. Throws a ZodError if every store is hidden. */
export async function setHiddenChannels(
	db: Executor,
	author: SessionAuthor,
	hidden: ChannelSlug[]
) {
	await updatePreferences(db, author.id, { hidden_channels: hidden });
}

// ---------------------------------------------------------------- listing editor (#12)

/** Everything the listing editor shows for one book, format, store, and market. */
export async function listingEditor(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	channel: ChannelSlug,
	format: BookFormat,
	market: string | null,
	packs: Playbook[] = PLAYBOOKS
) {
	const { currency } = await getPreferences(db, author.id);
	return withAuthor(db, author.id, async (tx) => {
		const book = await works.getTitle(tx, author.id, titleId);
		if (!book) return null;
		const listing = await listings.getListing(tx, author.id, titleId, channel, format, market);
		// Setup steps belong to the store's default listing, on every marketplace tab.
		const main = market
			? await listings.getListing(tx, author.id, titleId, channel, format, null)
			: listing;
		const setup = await listingSetup(
			tx,
			author.id,
			book,
			main ? { channel, format, externalId: main.externalId } : null,
			channel,
			format,
			packs
		);
		const program = exclusiveProgram(channel, format);
		const enrollment =
			listing && program
				? await decisionsRepo.currentDecision(tx, author.id, 'listing', listing.id, 'enrollment')
				: undefined;
		return {
			book: { id: book.id, title: book.workingTitle },
			listing: listing ?? null,
			markets: await listings.listMarketListings(tx, author.id, titleId, channel, format),
			program,
			printTerms: hasPrintTerms(channel, format),
			enrollment: enrollment
				? {
						choice: enrollment.choice,
						commitsUntil: enrollment.commitsUntil,
						decidedAt: enrollment.decidedAt
					}
				: null,
			advice: fieldAdvice(channel, format, packs),
			setup,
			defaultCurrency: currency
		};
	});
}

/**
 * Saves a listing, creating it if needed. Joining or leaving an exclusivity program, or
 * changing when its term ends, records a decision (superseding the last one) whose
 * commits_until drives a reminder before the term renews. False if the book is gone.
 */
export function saveListing(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	channel: ChannelSlug,
	format: BookFormat,
	market: string | null,
	input: ListingInput
) {
	if (!sellsFormat(channel, format)) throw new Error(`${channel} doesn't sell ${format}`);
	return withAuthor(db, author.id, async (tx) => {
		if (!(await works.getTitle(tx, author.id, titleId))) return false;
		const before = await listings.getListing(tx, author.id, titleId, channel, format, market);
		const id = await listings.upsertListing(tx, author.id, titleId, channel, format, market, input);

		const program = exclusiveProgram(channel, format);
		const wasEnrolled = before?.enrolledInSelect ?? false;
		const changed =
			wasEnrolled !== input.enrolledInSelect ||
			(input.enrolledInSelect && before?.exclusivityEnd !== input.exclusivityEnd);
		if (program && changed && (wasEnrolled || input.enrolledInSelect)) {
			await decisionsRepo.recordDecision(tx, author.id, {
				subjectType: 'listing',
				subjectId: id,
				kind: 'enrollment',
				choice: input.enrolledInSelect ? `Enrolled in ${program.name}` : `Left ${program.name}`,
				commitsUntil: input.enrolledInSelect ? input.exclusivityEnd : null,
				assumptions: input.enrolledInSelect
					? { term_start: input.exclusivityStart, term_end: input.exclusivityEnd }
					: {},
				source: 'author'
			});
		}
		// A store ID entered after an import links that import's rows to this book (#21).
		if (input.externalId)
			await importsRepo.linkObservations(tx, author.id, titleId, input.externalId.trim());
		await syncTitleTasks(tx, author.id, titleId);
		return true;
	});
}

/** Starts tracking one more marketplace for a listing. False if the book is gone. */
export function addMarketListing(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	channel: ChannelSlug,
	format: BookFormat,
	market: string
) {
	if (!sellsFormat(channel, format)) throw new Error(`${channel} doesn't sell ${format}`);
	return withAuthor(db, author.id, async (tx) => {
		if (!(await works.getTitle(tx, author.id, titleId))) return false;
		const existing = await listings.getListing(tx, author.id, titleId, channel, format, market);
		if (!existing) {
			await listings.upsertListing(tx, author.id, titleId, channel, format, market, {});
		}
		return true;
	});
}

/** Stops tracking one listing (the default or one market). False if there was none. */
export function deleteListing(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	channel: ChannelSlug,
	format: BookFormat,
	market: string | null
) {
	return withAuthor(db, author.id, async (tx) => {
		const removed = await listings.deleteListing(tx, author.id, titleId, channel, format, market);
		if (removed) await syncTitleTasks(tx, author.id, titleId);
		return removed;
	});
}
