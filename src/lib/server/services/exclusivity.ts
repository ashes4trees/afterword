import { EXCLUSIVITY_DEFAULTS, type ExclusivityDefaults } from '$lib/server/content/assumptions';
import { withAuthor } from '$lib/server/db/tenant';
import type { Executor } from '$lib/server/db/types';
import {
	modelExclusivity,
	type ExclusivityModel,
	type Scenario
} from '$lib/server/engine/exclusivity';
import { getPreferences, type SessionAuthor } from '$lib/server/repo/authors';
import * as decisionsRepo from '$lib/server/repo/decisions';
import * as importsRepo from '$lib/server/repo/imports';
import * as works from '$lib/server/repo/works';

// KDP Select vs wide for one book (#25): the author's history, the dated defaults, and
// any assumption they've changed, through the pure model (#24). No recommendation is made
// without the arithmetic beside it.

/** Assumptions the author has changed on the page, in the units the model uses. */
export type ExclusivityEdits = {
	kenpRate?: number;
	kuReadersWhoBuy?: number;
	amazonMinor?: number;
	kenpPages?: number;
	wideMinor?: number;
	directMinor?: number;
};

/** The whole months of history to average: the last N before this month. */
export function historyWindow(today: string, months: number) {
	const [y, m] = today.split('-').map(Number) as [number, number];
	const first = new Date(Date.UTC(y, m - 1 - months, 1));
	const last = new Date(Date.UTC(y, m - 1, 0));
	return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

export function selectVsWide(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	today: string,
	edits: ExclusivityEdits = {},
	defaults: ExclusivityDefaults = EXCLUSIVITY_DEFAULTS
) {
	return withAuthor(db, author.id, async (tx) => {
		const book = await works.getTitle(tx, author.id, titleId);
		if (!book) return null;
		const { currency } = await getPreferences(tx, author.id);
		const months = defaults.history_months;
		const { from, to } = historyWindow(today, months);
		const rows = await importsRepo.listObservations(tx, author.id, titleId);
		const commitment = (await decisionsRepo.listCurrentListingCommitments(tx, author.id)).find(
			(c) => c.titleId === titleId && c.channelSlug === 'kdp' && c.format === 'ebook'
		);
		const defaultRate = defaults.kenp_rate_per_page_minor[currency];
		const model: ExclusivityModel = modelExclusivity({
			currency,
			from,
			to,
			months,
			history: rows
				.filter((r) => !r.campaignId)
				.map((r) => ({
					channel: r.channelSlug,
					format: r.format,
					metric: r.metric,
					value: r.value,
					currency: r.currency,
					periodStart: r.periodStart
				})),
			kenpRate: {
				value: edits.kenpRate ?? defaultRate ?? 0,
				basis: edits.kenpRate !== undefined ? 'author' : 'default'
			},
			kuReadersWhoBuy: {
				value: edits.kuReadersWhoBuy ?? defaults.ku_readers_who_buy,
				basis: edits.kuReadersWhoBuy !== undefined ? 'author' : 'default'
			},
			estimates: {
				amazonMinor: edits.amazonMinor,
				kenpPages: edits.kenpPages,
				wideMinor: edits.wideMinor,
				directMinor: edits.directMinor
			},
			commitment: commitment ? { until: commitment.commitsUntil! } : null,
			today
		});
		return {
			book: { id: book.id, title: book.workingTitle },
			model,
			hasHistory: rows.some((r) => !r.campaignId && r.periodStart >= from && r.periodStart <= to),
			/** No default KENP rate for this currency, and the author hasn't entered one. */
			needsRate: edits.kenpRate === undefined && defaultRate === undefined,
			defaultsAsOf: defaults.as_of
		};
	});
}

const CHOICES: Record<Scenario['key'], string> = {
	select: 'Stay in (or enroll in) KDP Select',
	wide: 'Go wide',
	wide_direct: 'Go wide and sell direct'
};

/**
 * Records the author's choice as a decision on the book, with the assumptions and monthly
 * figures it rested on, and the Select term end as the commitment when staying in.
 */
export async function chooseOption(
	db: Executor,
	author: SessionAuthor,
	titleId: string,
	option: Scenario['key'],
	rationale: string | null,
	today: string,
	edits: ExclusivityEdits = {}
) {
	const result = await selectVsWide(db, author, titleId, today, edits);
	if (!result) return false;
	const { model } = result;
	return withAuthor(db, author.id, async (tx) => {
		await decisionsRepo.recordDecision(tx, author.id, {
			subjectType: 'title',
			subjectId: titleId,
			kind: 'distribution',
			choice: CHOICES[option],
			rationale,
			assumptions: {
				...Object.fromEntries(model.scenarios.map((s) => [`${s.key}_total_minor`, s.monthlyMinor])),
				currency: model.currency,
				...Object.fromEntries(model.assumptions.map((a) => [a.key, a.value]))
			},
			commitsUntil: option === 'select' ? (model.commitment?.until ?? null) : null,
			source: 'author'
		});
		return true;
	});
}
