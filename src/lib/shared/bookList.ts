// Organizing the books list (#9 follow-up): grouping by series, sorting, and the small
// date helpers the list shows. Pure, so it's unit tested and runs on either side.

export type BookListItem = {
	id: string;
	workingTitle: string;
	penName: string | null;
	seriesId: string | null;
	seriesTitle: string | null;
	seriesPosition: number | null;
	releaseDate: string | null;
	createdAt: Date;
};

export const BOOK_SORTS = ['series', 'release', 'added'] as const;
export type BookSort = (typeof BOOK_SORTS)[number];

export const SORT_LABELS: Record<BookSort, string> = {
	series: 'Series order',
	release: 'Release date',
	added: 'Date added'
};

export type BookGroup<T extends BookListItem> = {
	/** Series id, or null for standalones (or for the single group when ungrouped). */
	seriesId: string | null;
	seriesTitle: string | null;
	penName: string | null;
	books: T[];
};

type Compare<T> = (a: T, b: T) => number;

const byTitle: Compare<BookListItem> = (a, b) => a.workingTitle.localeCompare(b.workingTitle);

/** Missing values sort last whichever way the rest is ordered. */
function nullsLast<V>(get: (b: BookListItem) => V | null, cmp: (a: V, b: V) => number) {
	return (a: BookListItem, b: BookListItem) => {
		const x = get(a);
		const y = get(b);
		if (x === null && y === null) return 0;
		if (x === null) return 1;
		if (y === null) return -1;
		return cmp(x, y);
	};
}

const byRelease = nullsLast(
	(b) => b.releaseDate,
	(x, y) => x.localeCompare(y)
);
const byNewest: Compare<BookListItem> = (a, b) => b.createdAt.getTime() - a.createdAt.getTime();
const byPosition = nullsLast(
	(b) => b.seriesPosition,
	(x, y) => x - y
);
const bySeriesTitle = nullsLast(
	(b) => b.seriesTitle,
	(x, y) => x.localeCompare(y)
);

const chain =
	<T>(...cmps: Compare<T>[]): Compare<T> =>
	(a, b) => {
		for (const cmp of cmps) {
			const r = cmp(a, b);
			if (r !== 0) return r;
		}
		return 0;
	};

const BOOK_ORDER: Record<BookSort, Compare<BookListItem>> = {
	// Reading order inside a series; standalones by release date.
	series: chain(bySeriesTitle, byPosition, byRelease, byTitle),
	release: chain(byRelease, byTitle),
	added: chain(byNewest, byTitle)
};

export function organizeBooks<T extends BookListItem>(
	books: T[],
	sort: BookSort,
	grouped: boolean
): BookGroup<T>[] {
	const order = BOOK_ORDER[sort];
	if (!grouped) {
		return books.length
			? [{ seriesId: null, seriesTitle: null, penName: null, books: [...books].sort(order) }]
			: [];
	}

	const groups = new Map<string | null, BookGroup<T>>();
	for (const book of books) {
		let group = groups.get(book.seriesId);
		if (!group) {
			group = { seriesId: book.seriesId, seriesTitle: book.seriesTitle, penName: null, books: [] };
			groups.set(book.seriesId, group);
		}
		group.books.push(book);
	}

	const series = [...groups.values()].filter((g) => g.seriesId !== null);
	for (const g of series) {
		// Reading order within a series unless another sort was asked for.
		g.books.sort(sort === 'series' ? chain(byPosition, byRelease, byTitle) : order);
		const penNames = new Set(g.books.map((b) => b.penName));
		g.penName = penNames.size === 1 ? g.books[0]!.penName : null;
	}
	// Series are ordered by their first book under the chosen sort, or by name.
	series.sort((a, b) =>
		sort === 'series'
			? a.seriesTitle!.localeCompare(b.seriesTitle!)
			: order([...a.books].sort(order)[0]!, [...b.books].sort(order)[0]!) ||
				a.seriesTitle!.localeCompare(b.seriesTitle!)
	);

	const standalone = groups.get(null);
	if (standalone) standalone.books.sort(order);
	return standalone ? [...series, standalone] : series;
}

/** The next whole position after the highest one in a series, e.g. 2.5 → 3. */
export function nextSeriesPosition(books: BookListItem[], seriesTitle: string): number {
	const key = seriesTitle.trim().toLowerCase();
	const positions = books
		.filter((b) => b.seriesTitle?.toLowerCase() === key && b.seriesPosition !== null)
		.map((b) => b.seriesPosition!);
	return positions.length ? Math.floor(Math.max(...positions)) + 1 : 1;
}

const DAY = 86_400_000;
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "in 9 days", "in 3 months", "today", or "Released", for a YYYY-MM-DD date. */
export function releaseCountdown(releaseDate: string, today: string): string {
	const days = Math.round(
		(Date.parse(`${releaseDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY
	);
	if (days < 0) return 'Released';
	if (days <= 13) return relative.format(days, 'day');
	if (days <= 60) return relative.format(Math.round(days / 7), 'week');
	return relative.format(Math.round(days / 30.44), 'month');
}

/** Today's calendar date where the code runs, as YYYY-MM-DD. */
export function localToday(now = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
