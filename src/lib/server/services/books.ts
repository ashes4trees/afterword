import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import type { SessionAuthor } from '$lib/server/repo/authors';
import * as works from '$lib/server/repo/works';
import type { TitleFormValues, TitleInput } from '$lib/shared/titles';

// Books (#9). "Book" in the UI, `titles` in the schema.

export function listBooks(db: Executor, author: SessionAuthor) {
	return withAuthor(db, author.id, (tx) => works.listTitles(tx, author.id));
}

export function getBook(db: Executor, author: SessionAuthor, id: string) {
	return withAuthor(db, author.id, (tx) => works.getTitle(tx, author.id, id));
}

/** Existing pen names and series, offered as suggestions in the book form. */
export function bookFormOptions(db: Executor, author: SessionAuthor) {
	return withAuthor(db, author.id, async (tx) => ({
		penNames: (await works.listPenNames(tx, author.id)).map((p) => p.name),
		series: (await works.listSeries(tx, author.id)).map((s) => ({
			title: s.title,
			penName: s.penName
		})),
		tropes: await works.listTropes(tx, author.id)
	}));
}

/**
 * Pen names and series arrive as names and are found or created. A book joining a
 * series that has a pen name takes that pen name unless the author entered one.
 */
async function resolve(
	tx: Executor,
	authorId: string,
	input: TitleInput
): Promise<works.TitleValues> {
	let penNameId = input.penName
		? (await works.findOrCreatePenName(tx, authorId, input.penName)).id
		: null;

	let seriesId: string | null = null;
	if (input.seriesTitle) {
		const existing = await works.findSeriesByTitle(tx, authorId, input.seriesTitle);
		const s = existing ?? (await works.createSeries(tx, authorId, input.seriesTitle, penNameId));
		seriesId = s.id;
		penNameId ??= s.penNameId;
	}

	return {
		workingTitle: input.workingTitle,
		penNameId,
		seriesId,
		seriesPosition: seriesId ? input.seriesPosition : null,
		genre: input.genre,
		subgenre: input.subgenre,
		tropes: input.tropes,
		contentSex: input.contentSex,
		contentViolence: input.contentViolence,
		contentLanguage: input.contentLanguage,
		pageCount: input.pageCount,
		wordCount: input.wordCount,
		formats: input.formats,
		releaseDate: input.releaseDate,
		stage: input.stage
	};
}

export function createBook(db: Executor, author: SessionAuthor, input: TitleInput) {
	return withAuthor(db, author.id, async (tx) =>
		works.insertTitle(tx, author.id, await resolve(tx, author.id, input))
	);
}

/** Returns false if the book doesn't exist for this author. */
export function updateBook(db: Executor, author: SessionAuthor, id: string, input: TitleInput) {
	return withAuthor(db, author.id, async (tx) =>
		works.updateTitle(tx, author.id, id, await resolve(tx, author.id, input))
	);
}

/** Returns false if the book doesn't exist for this author. */
export function deleteBook(db: Executor, author: SessionAuthor, id: string) {
	return withAuthor(db, author.id, (tx) => works.deleteTitle(tx, author.id, id));
}

/** A stored book as the edit form's string values. */
export function toFormValues(book: works.TitleRow): TitleFormValues {
	const str = (v: number | string | null) => (v === null ? '' : String(v));
	return {
		workingTitle: book.workingTitle,
		penName: book.penName ?? '',
		seriesTitle: book.seriesTitle ?? '',
		seriesPosition: str(book.seriesPosition),
		genre: book.genre ?? '',
		subgenre: book.subgenre ?? '',
		tropes: book.tropes.join(', '),
		contentSex: str(book.contentSex),
		contentViolence: str(book.contentViolence),
		contentLanguage: str(book.contentLanguage),
		pageCount: str(book.pageCount),
		wordCount: str(book.wordCount),
		formats: book.formats.join(','),
		releaseDate: book.releaseDate ?? '',
		stage: book.stage
	};
}
