import { fromMinor, toMinor } from './money';

// The Select vs wide page's assumption inputs (#25), kept in the URL so an author can
// try a belief and share or revisit it. Amounts are in the author's currency.

/** Assumption key → URL parameter. */
export const EDIT_PARAMS = {
	amazon_sales: 'amazon',
	kenp_pages: 'pages',
	kenp_rate: 'rate',
	ku_readers_who_buy: 'ku',
	wide_monthly: 'wide',
	direct_monthly: 'direct'
} as const;
export type EditParam = (typeof EDIT_PARAMS)[keyof typeof EDIT_PARAMS];

export type Edits = {
	amazonMinor?: number;
	kenpPages?: number;
	kenpRate?: number;
	kuReadersWhoBuy?: number;
	wideMinor?: number;
	directMinor?: number;
};

/** Reads the inputs that are filled in and valid; anything else is reported, not guessed. */
export function parseEdits(get: (name: EditParam) => string | null, currency: string) {
	const edits: Edits = {};
	const values: Partial<Record<EditParam, string>> = {};
	const problems: string[] = [];
	const read = (name: EditParam, apply: (text: string) => boolean, message: string) => {
		const text = get(name)?.trim();
		if (!text) return;
		values[name] = text;
		if (!apply(text)) problems.push(message);
	};
	const money = (text: string) => toMinor(text, currency);
	read(
		'amazon',
		(t) => (edits.amazonMinor = money(t) ?? undefined) !== undefined,
		'Amazon sales: use an amount like 300.00.'
	);
	read(
		'wide',
		(t) => (edits.wideMinor = money(t) ?? undefined) !== undefined,
		'Other stores: use an amount like 50.00.'
	);
	read(
		'direct',
		(t) => (edits.directMinor = money(t) ?? undefined) !== undefined,
		'Your own store: use an amount like 20.00.'
	);
	read(
		'pages',
		(t) =>
			/^\d{1,9}$/.test(t.replace(/,/g, '')) && (edits.kenpPages = Number(t.replace(/,/g, ''))) >= 0,
		'Pages read: use a whole number, like 40000.'
	);
	read(
		'rate',
		(t) => {
			const per1000 = money(t);
			if (per1000 === null || per1000 <= 0) return false;
			edits.kenpRate = per1000 / 1000;
			return true;
		},
		'KU rate: use an amount per 1,000 pages, like 4.50.'
	);
	read(
		'ku',
		(t) => {
			const pct = Number(t.replace(/%$/, ''));
			if (!Number.isFinite(pct) || pct < 0 || pct > 100) return false;
			edits.kuReadersWhoBuy = pct / 100;
			return true;
		},
		'KU readers who buy: use a percentage from 0 to 100.'
	);
	return { edits, values, problems };
}

/** The KU rate per 1,000 pages as the form shows it, from minor units per page. */
export const ratePer1000 = (minorPerPage: number, currency: string) =>
	fromMinor(Math.round(minorPerPage * 1000), currency);
