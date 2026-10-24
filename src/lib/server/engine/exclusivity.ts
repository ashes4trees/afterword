import { daysBetween } from '$lib/shared/dates';
import { formatMoney } from '$lib/shared/money';

// KDP Select vs wide vs wide + direct (#24), for one book's ebook, from the author's own
// numbers. Pure. It models monthly ebook income under each option and returns every
// assumption beside the result, so nothing is buried. Print and audio aren't affected by
// Select, so they're left out.
//
// Spec §9 Q1 (resolved 2026-10-24): one blended KENP rate per currency, stated as an
// assumption. Per-marketplace rates can come later if the blend proves misleading.

export type HistoryRow = {
	channel: string;
	format: string | null;
	metric: string;
	value: number;
	currency: string;
	periodStart: string;
};

export type ExclusivityInputs = {
	currency: string;
	/** Whole months of history to average over, as YYYY-MM-DD bounds. */
	from: string;
	to: string;
	months: number;
	/** The book's ebook history: royalties per store and KENP pages read. */
	history: HistoryRow[];
	/** Minor units per page read, in `currency`, with where it came from. */
	kenpRate: { value: number; basis: AssumptionBasis };
	/** The author's own monthly estimates, used instead of history when set. */
	estimates?: { wideMinor?: number; directMinor?: number };
	/** Share of KU income that would become ebook sales if the book left Select, 0–1. */
	kuReadersWhoBuy: { value: number; basis: AssumptionBasis };
	/** The current Select term, when enrolled. */
	commitment: { until: string } | null;
	today: string;
};

export type AssumptionBasis = 'history' | 'default' | 'author';

export type Assumption = {
	key: string;
	label: string;
	value: string;
	basis: AssumptionBasis;
	/** The author can change it to test their own belief (#25). */
	editable: boolean;
};

export type Scenario = {
	key: 'select' | 'wide' | 'wide_direct';
	label: string;
	monthlyMinor: number;
	parts: { label: string; minor: number }[];
	/** When the option could start, given the current Select term. */
	earliestStart: string;
};

export type ExclusivityModel = {
	currency: string;
	scenarios: Scenario[];
	assumptions: Assumption[];
	commitment: { until: string; daysLeft: number; note: string } | null;
	/** History in other currencies, left out rather than converted. */
	excluded: { currency: string; rows: number }[];
};

const AMAZON = 'kdp';
const DIRECT = 'direct';

export function modelExclusivity(input: ExclusivityInputs): ExclusivityModel {
	const { currency, months } = input;
	const inPeriod = input.history.filter(
		(r) =>
			r.periodStart >= input.from && r.periodStart <= input.to && (r.format ?? 'ebook') === 'ebook'
	);
	const rows = inPeriod.filter((r) => r.currency === currency);
	const monthly = (keep: (r: HistoryRow) => boolean) =>
		Math.round(rows.filter(keep).reduce((sum, r) => sum + r.value, 0) / months);

	const amazonSales = monthly((r) => r.channel === AMAZON && r.metric === 'royalty_minor');
	const kenpPages = monthly((r) => r.channel === AMAZON && r.metric === 'kenp_pages');
	const ku = Math.round(kenpPages * input.kenpRate.value);
	const wideHistory = monthly(
		(r) => r.channel !== AMAZON && r.channel !== DIRECT && r.metric === 'royalty_minor'
	);
	const directHistory = monthly((r) => r.channel === DIRECT && r.metric === 'royalty_minor');
	const wide = input.estimates?.wideMinor ?? wideHistory;
	const direct = input.estimates?.directMinor ?? directHistory;
	const kuConverted = Math.round(ku * input.kuReadersWhoBuy.value);
	const adSpend = monthly((r) => r.metric === 'ad_spend_minor');

	const committed =
		input.commitment && input.commitment.until >= input.today ? input.commitment : null;
	const afterTerm = committed
		? new Date(Date.parse(`${committed.until}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
		: input.today;

	const money = (m: number) => formatMoney(m, currency);
	const scenario = (
		key: Scenario['key'],
		label: string,
		parts: Scenario['parts'],
		earliestStart: string
	): Scenario => ({
		key,
		label,
		parts,
		monthlyMinor: parts.reduce((sum, p) => sum + p.minor, 0),
		earliestStart
	});
	const leaving = [
		{ label: 'Amazon ebook sales', minor: amazonSales },
		{ label: 'KU readers who buy instead', minor: kuConverted },
		{ label: 'Other stores', minor: wide }
	];

	const assumptions: Assumption[] = [
		{
			key: 'period',
			label: 'History averaged over',
			value: `${months} ${months === 1 ? 'month' : 'months'} (${input.from} to ${input.to})`,
			basis: 'history',
			editable: false
		},
		{
			key: 'kenp_rate',
			label: 'KU pays per page read',
			value: `${input.kenpRate.value.toFixed(2)} minor units (${money(Math.round(input.kenpRate.value * 1000))} per 1,000 pages), one blended rate for ${currency}`,
			basis: input.kenpRate.basis,
			editable: true
		},
		{
			key: 'amazon_sales',
			label: 'Amazon ebook sales stay the same under every option',
			value: `${money(amazonSales)} a month`,
			basis: 'history',
			editable: false
		},
		{
			key: 'ku_readers_who_buy',
			label: 'KU readers who would buy the ebook if it left Select',
			value: `${Math.round(input.kuReadersWhoBuy.value * 100)}% of KU income`,
			basis: input.kuReadersWhoBuy.basis,
			editable: true
		},
		{
			key: 'wide_monthly',
			label: 'Other stores earn',
			value: `${money(wide)} a month${input.estimates?.wideMinor === undefined && wideHistory === 0 ? ' (no history, so likely understated)' : ''}`,
			basis: input.estimates?.wideMinor !== undefined ? 'author' : 'history',
			editable: true
		},
		{
			key: 'direct_monthly',
			label: 'Your own store earns',
			value: `${money(direct)} a month${input.estimates?.directMinor === undefined && directHistory === 0 ? ' (no history, so likely understated)' : ''}`,
			basis: input.estimates?.directMinor !== undefined ? 'author' : 'history',
			editable: true
		},
		{
			key: 'ad_spend',
			label: "Ad spend stays the same under every option, so it doesn't change the comparison",
			value: `${money(adSpend)} a month`,
			basis: 'history',
			editable: false
		},
		{
			key: 'prices',
			label: 'Prices stay as they are',
			value: 'The comparison uses what you actually earned at your current prices',
			basis: 'history',
			editable: false
		},
		{
			key: 'scope',
			label: 'Only the ebook is compared',
			value: 'Select only covers ebooks; paperbacks and audiobooks are the same either way',
			basis: 'default',
			editable: false
		}
	];

	const excludedCounts = new Map<string, number>();
	for (const r of inPeriod.filter((r) => r.currency !== currency)) {
		excludedCounts.set(r.currency, (excludedCounts.get(r.currency) ?? 0) + 1);
	}

	return {
		currency,
		scenarios: [
			scenario(
				'select',
				'KDP Select',
				[
					{ label: 'Amazon ebook sales', minor: amazonSales },
					{ label: 'Kindle Unlimited pages read', minor: ku }
				],
				input.today
			),
			scenario('wide', 'Wide', leaving, afterTerm),
			scenario(
				'wide_direct',
				'Wide + your own store',
				[...leaving, { label: 'Your own store', minor: direct }],
				afterTerm
			)
		],
		assumptions,
		commitment: committed
			? {
					until: committed.until,
					daysLeft: daysBetween(input.today, committed.until),
					note: `You're in KDP Select until ${committed.until}. Leaving before then isn't possible, so wide can start the day after. Turn off auto-renew if you plan to leave.`
				}
			: null,
		excluded: [...excludedCounts].map(([c, n]) => ({ currency: c, rows: n }))
	};
}
