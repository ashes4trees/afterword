import { STAGE_LABELS, TITLE_STAGES, type TitleStage } from './titles';

// Filtering a list of books by search text, pen name, series, and stage (#64). Shared by
// the books list and the listing matrix (#11). Pure, so it's unit tested.

export type FilterableBook = {
	workingTitle: string;
	penName: string | null;
	seriesTitle: string | null;
	genre: string | null;
	subgenre: string | null;
	tropes: string[];
	stage: TitleStage;
};

/** URL value meaning "has none", for the pen name and series filters. */
export const NONE = '~none';

export type BookFilter = {
	q: string;
	pen: string | null;
	series: string | null;
	stage: TitleStage | null;
};

export const FILTER_PARAMS = ['q', 'pen', 'series', 'stage'] as const;

export function parseBookFilter(params: URLSearchParams): BookFilter {
	const stage = params.get('stage');
	return {
		q: (params.get('q') ?? '').slice(0, 200),
		pen: params.get('pen') || null,
		series: params.get('series') || null,
		stage: (TITLE_STAGES as readonly string[]).includes(stage ?? '') ? (stage as TitleStage) : null
	};
}

export const isFiltered = (f: BookFilter) =>
	f.q.trim() !== '' || f.pen !== null || f.series !== null || f.stage !== null;

/** Lowercase with accents removed, so "Anaïs" matches "anais". */
export const fold = (s: string) =>
	s
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();

const sameName = (value: string | null, wanted: string) =>
	wanted === NONE ? value === null : value !== null && fold(value) === fold(wanted);

/** Every search word must appear somewhere in the book's details. */
export function matchesBook(book: FilterableBook, f: BookFilter): boolean {
	if (f.pen !== null && !sameName(book.penName, f.pen)) return false;
	if (f.series !== null && !sameName(book.seriesTitle, f.series)) return false;
	if (f.stage !== null && book.stage !== f.stage) return false;

	const words = fold(f.q).split(/\s+/).filter(Boolean);
	if (words.length === 0) return true;
	const haystack = fold(
		[book.workingTitle, book.seriesTitle, book.penName, book.genre, book.subgenre, ...book.tropes]
			.filter(Boolean)
			.join(' \u0000 ')
	);
	return words.every((w) => haystack.includes(w));
}

export type FilterOption = { value: string; label: string };
export type FilterField = {
	param: 'pen' | 'series' | 'stage';
	label: string;
	options: FilterOption[];
};

/**
 * The dropdowns worth showing for these books: only fields with more than one value to
 * choose between, and only values some book actually has.
 */
export function bookFilterFields(books: FilterableBook[]): FilterField[] {
	const distinct = (values: (string | null)[], noneLabel: string): FilterOption[] => {
		const names = new Map<string, string>();
		let hasNone = false;
		for (const v of values) {
			if (v === null) hasNone = true;
			else if (!names.has(fold(v))) names.set(fold(v), v);
		}
		const options = [...names.values()]
			.sort((a, b) => a.localeCompare(b))
			.map((v) => ({ value: v, label: v }));
		return hasNone ? [...options, { value: NONE, label: noneLabel }] : options;
	};

	const stages = TITLE_STAGES.filter((s) => books.some((b) => b.stage === s)).map((s) => ({
		value: s,
		label: STAGE_LABELS[s]
	}));

	const fields: FilterField[] = [
		{
			param: 'pen',
			label: 'Pen name',
			options: distinct(
				books.map((b) => b.penName),
				'No pen name'
			)
		},
		{
			param: 'series',
			label: 'Series',
			options: distinct(
				books.map((b) => b.seriesTitle),
				'Standalones'
			)
		},
		{ param: 'stage', label: 'Stage', options: stages }
	];
	return fields.filter((f) => f.options.length > 1);
}
