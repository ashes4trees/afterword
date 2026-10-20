// Which stores to tick for a new book (#41). Pure, so the add-book form can update the
// suggestion as the pen name changes. The author always confirms; nothing is created
// until they save. First match wins:
//   1. Their default stores, if they've chosen some (even none)
//   2. The stores of their latest book under the same pen name that has listings
//   3. The stores of their latest book with listings, under any pen name
//   4. Nothing

export type StoreHistory = {
	title: string;
	penName: string | null;
	/** ISO timestamp the book was added. */
	addedAt: string;
	/** Stores the book has listings on. */
	stores: string[];
}[];

export type StoreSuggestion = {
	stores: string[];
	source: { kind: 'default' } | { kind: 'book'; title: string } | null;
};

const same = (a: string | null, b: string | null) =>
	!!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export function suggestStores(input: {
	defaults: string[] | null;
	penName: string | null;
	history: StoreHistory;
}): StoreSuggestion {
	if (input.defaults) return { stores: input.defaults, source: { kind: 'default' } };
	const latest = (books: StoreHistory) =>
		books.filter((b) => b.stores.length > 0).sort((a, b) => b.addedAt.localeCompare(a.addedAt))[0];
	const match =
		(input.penName?.trim() &&
			latest(input.history.filter((b) => same(b.penName, input.penName)))) ||
		latest(input.history);
	return match
		? { stores: match.stores, source: { kind: 'book', title: match.title } }
		: { stores: [], source: null };
}

/** Where the suggestion came from, in the form's words. */
export function describeSuggestion(source: StoreSuggestion['source']): string | null {
	if (!source) return null;
	return source.kind === 'default' ? 'Your default stores' : `Same as “${source.title}”`;
}
