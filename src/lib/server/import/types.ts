import type { BookFormat } from '$lib/shared/channels';
import type { ImportKind, Metric } from '$lib/shared/observations';

// The contract every report parser meets (#21, #22). A parser turns a workbook into
// observations and says which dates each metric covers, so an upload can replace what an
// earlier one said about the same days instead of double counting.

export type ParsedObservation = {
	/** The store's id for the book: ASIN or ISBN. */
	externalId: string;
	format: BookFormat | null;
	marketplace: string;
	currency: string;
	metric: Metric;
	value: number;
	periodStart: string;
	periodEnd: string;
};

export type ParsedReport = {
	kind: ImportKind;
	channel: string;
	observations: ParsedObservation[];
	/** For each metric in the file, the first and last day it covers. */
	coverage: Partial<Record<Metric, { from: string; to: string }>>;
	/** Books named in the file, to help match them. Shown to the author, never stored. */
	books: { externalId: string; title: string; format: BookFormat | null }[];
};
