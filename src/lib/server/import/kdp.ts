import type { BookFormat } from '$lib/shared/channels';
import { currencyDigits } from '$lib/shared/money';
import type { Metric } from '$lib/shared/observations';
import { AMAZON_MARKETPLACES } from './marketplaces';
import type { ParsedObservation, ParsedReport } from './types';
import { ImportError } from './xlsx';

// The KDP royalty report (#21): the .xlsx from KDP Reports, with a sheet per format and a
// KENP sheet. Pure. "Combined Sales" repeats the per-format sheets, so it's skipped to
// avoid double counting; the Summary and order sheets aren't royalties.

const WRONG_FILE =
	"This doesn't look like a KDP royalty report. In KDP, open Reports, choose the months you want, and download the report as it comes.";

type Sheet = string[][];

const ROYALTY_SHEETS: { name: string; format: BookFormat; id: string[] }[] = [
	{ name: 'eBook Royalty', format: 'ebook', id: ['ASIN'] },
	{ name: 'Paperback Royalty', format: 'paperback', id: ['ISBN', 'ASIN'] },
	{ name: 'Hardcover Royalty', format: 'hardcover', id: ['ISBN', 'ASIN'] }
];

/** Column positions by header, failing clearly when a column KDP always includes is gone. */
function columns(sheet: Sheet, sheetName: string, wanted: string[]) {
	const header = (sheet[0] ?? []).map((h) => h.trim());
	const at: Record<string, number> = {};
	for (const name of wanted) {
		const i = header.indexOf(name);
		if (i < 0) {
			throw new ImportError(
				`The "${sheetName}" sheet has no "${name}" column. KDP may have changed the report; please tell us so we can update the import.`
			);
		}
		at[name] = i;
	}
	return at;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseKdpReport(sheets: Map<string, Sheet>): ParsedReport {
	const present = ROYALTY_SHEETS.filter((s) => sheets.has(s.name));
	if (present.length === 0 && !sheets.has('KENP')) throw new ImportError(WRONG_FILE);

	const totals = new Map<string, ParsedObservation>();
	const books = new Map<string, { externalId: string; title: string; format: BookFormat | null }>();
	const coverage: ParsedReport['coverage'] = {};
	const cover = (metric: Metric, day: string) => {
		const c = coverage[metric];
		coverage[metric] = c
			? { from: day < c.from ? day : c.from, to: day > c.to ? day : c.to }
			: { from: day, to: day };
	};
	const add = (o: Omit<ParsedObservation, 'periodEnd'>) => {
		const key = [o.externalId, o.format, o.marketplace, o.currency, o.metric, o.periodStart].join(
			'|'
		);
		const existing = totals.get(key);
		if (existing) existing.value += o.value;
		else totals.set(key, { ...o, periodEnd: o.periodStart });
		cover(o.metric, o.periodStart);
	};
	const place = (name: string, sheetName: string, row: number) => {
		const m = AMAZON_MARKETPLACES[name.trim()];
		if (!m)
			throw new ImportError(
				`Row ${row} of "${sheetName}" is for "${name}", a marketplace we don't recognise yet.`
			);
		return m;
	};
	const number = (text: string, sheetName: string, row: number, column: string) => {
		const n = Number(text);
		if (text.trim() === '' || !Number.isFinite(n)) {
			throw new ImportError(
				`Row ${row} of "${sheetName}" has "${text}" for ${column}, where a number belongs.`
			);
		}
		return n;
	};

	for (const spec of present) {
		const sheet = sheets.get(spec.name)!;
		const idColumn =
			spec.id.find((c) => (sheet[0] ?? []).map((h) => h.trim()).includes(c)) ?? spec.id[0]!;
		const at = columns(sheet, spec.name, [
			'Royalty Date',
			'Title',
			idColumn,
			'Marketplace',
			'Net Units Sold',
			'Royalty',
			'Currency'
		]);
		sheet.slice(1).forEach((r, i) => {
			const row = i + 2;
			const day = r[at['Royalty Date']!]?.trim() ?? '';
			if (!day) return;
			if (!DATE.test(day))
				throw new ImportError(`Row ${row} of "${spec.name}" has "${day}" as its date.`);
			const externalId = r[at[idColumn]!]?.trim() ?? '';
			const currency = r[at.Currency!]?.trim() ?? '';
			if (!/^[A-Z]{3}$/.test(currency))
				throw new ImportError(`Row ${row} of "${spec.name}" has no currency.`);
			const { country } = place(r[at.Marketplace!] ?? '', spec.name, row);
			const royalty = number(r[at.Royalty!] ?? '', spec.name, row, 'Royalty');
			const units = number(r[at['Net Units Sold']!] ?? '', spec.name, row, 'Net Units Sold');
			const base = {
				externalId,
				format: spec.format,
				marketplace: country,
				currency,
				periodStart: day
			};
			add({
				...base,
				metric: 'royalty_minor',
				value: Math.round(royalty * 10 ** currencyDigits(currency))
			});
			add({ ...base, metric: 'units', value: Math.round(units) });
			books.set(externalId, { externalId, title: r[at.Title!]?.trim() ?? '', format: spec.format });
		});
	}

	const kenp = sheets.get('KENP');
	if (kenp) {
		const header = (kenp[0] ?? []).map((h) => h.trim());
		const pagesColumn =
			header.find((h) => /^Total .*Pages Read/i.test(h)) ??
			header.find((h) => /Pages Read$/i.test(h));
		if (!pagesColumn)
			throw new ImportError(
				'The "KENP" sheet has no pages-read column. KDP may have changed the report; please tell us so we can update the import.'
			);
		const at = columns(kenp, 'KENP', ['Date', 'Title', 'eBook ASIN', 'Marketplace', pagesColumn]);
		kenp.slice(1).forEach((r, i) => {
			const row = i + 2;
			const day = r[at.Date!]?.trim() ?? '';
			if (!day) return;
			if (!DATE.test(day)) throw new ImportError(`Row ${row} of "KENP" has "${day}" as its date.`);
			const externalId = r[at['eBook ASIN']!]?.trim() ?? '';
			const { country, currency } = place(r[at.Marketplace!] ?? '', 'KENP', row);
			const pages = number(r[at[pagesColumn]!] ?? '', 'KENP', row, pagesColumn);
			add({
				externalId,
				format: 'ebook',
				marketplace: country,
				currency,
				metric: 'kenp_pages',
				value: Math.round(pages),
				periodStart: day
			});
			if (!books.has(externalId))
				books.set(externalId, { externalId, title: r[at.Title!]?.trim() ?? '', format: 'ebook' });
		});
	}

	return {
		kind: 'kdp_report',
		channel: 'kdp',
		observations: [...totals.values()],
		coverage,
		books: [...books.values()]
	};
}
