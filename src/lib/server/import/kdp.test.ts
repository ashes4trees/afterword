import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildXlsx } from '$lib/server/testing/xlsx';
import { parseKdpReport } from './kdp';
import { ImportError, readWorkbook } from './xlsx';

// An anonymised copy of a real KDP report (Sep 1 to Oct 26, 2026): the same sheets,
// headers, cell types, and dates, with every title, name, ID, price, and figure replaced.
const fixture = readFileSync(new URL('./fixtures/kdp-report.xlsx', import.meta.url));
const report = parseKdpReport(readWorkbook(fixture));
const total = (metric: string, currency?: string) =>
	report.observations
		.filter((o) => o.metric === metric && (!currency || o.currency === currency))
		.reduce((s, o) => s + o.value, 0);

const EBOOK_HEADER = [
	'Royalty Date',
	'Title',
	'Author Name',
	'ASIN',
	'Marketplace',
	'Royalty Type',
	'Transaction Type',
	'Units Sold',
	'Units Refunded',
	'Net Units Sold',
	'Avg. List Price without tax',
	'Avg. Offer Price without tax',
	'Avg. File Size (MB)',
	'Avg. Delivery Cost',
	'Royalty',
	'Currency'
];
const ebookRow = (o: Partial<Record<string, string>> = {}) => {
	const v: Record<string, string> = {
		'Royalty Date': '2026-10-01',
		Title: 'Ember Road',
		'Author Name': 'A. Vale',
		ASIN: 'B0TEST0001',
		Marketplace: 'Amazon.com',
		'Royalty Type': '70%',
		'Transaction Type': 'Standard',
		'Units Sold': '1.0',
		'Units Refunded': '0.0',
		'Net Units Sold': '1.0',
		'Avg. List Price without tax': '4.99',
		'Avg. Offer Price without tax': '4.99',
		'Avg. File Size (MB)': '0.5',
		'Avg. Delivery Cost': '0.06',
		Royalty: '3.43',
		Currency: 'USD',
		...o
	};
	return EBOOK_HEADER.map((h) => v[h]!);
};
const parse = (sheets: Record<string, string[][]>) =>
	parseKdpReport(readWorkbook(buildXlsx(sheets)));
const error = (fn: () => unknown) => {
	try {
		fn();
	} catch (e) {
		if (e instanceof ImportError) return e.message;
		throw e;
	}
	return null;
};

describe('parseKdpReport on a real (anonymised) export', () => {
	it('reads royalties per currency, never converted, from the per-format sheets', () => {
		expect(total('royalty_minor', 'USD')).toBe(5262);
		expect(total('royalty_minor', 'GBP')).toBe(839);
		expect(total('royalty_minor', 'EUR')).toBe(722);
		expect(total('royalty_minor', 'AUD')).toBe(217);
	});

	it('reads net units, and KENP pages with the currency of their marketplace', () => {
		expect(total('units')).toBe(39);
		expect(total('kenp_pages')).toBe(13775);
		const pagesIn = (m: string) =>
			report.observations
				.filter((o) => o.metric === 'kenp_pages' && o.marketplace === m)
				.reduce((s, o) => s + o.value, 0);
		expect(pagesIn('US')).toBe(10478);
		expect(pagesIn('DE')).toBe(1538);
		expect(
			report.observations.find((o) => o.marketplace === 'DE' && o.metric === 'kenp_pages')?.currency
		).toBe('EUR');
	});

	it('says which days each metric covers, so a re-upload can replace them', () => {
		expect(report.coverage).toEqual({
			royalty_minor: { from: '2026-09-01', to: '2026-10-23' },
			units: { from: '2026-09-01', to: '2026-10-23' },
			kenp_pages: { from: '2026-09-01', to: '2026-10-26' }
		});
	});

	it('handles several marketplaces in one file, as country codes', () => {
		expect(new Set(report.observations.map((o) => o.marketplace))).toEqual(
			new Set(['US', 'GB', 'DE', 'AU', 'CA', 'MX'])
		);
	});

	it('lists the books it names, with their IDs and formats, to help match them', () => {
		expect(report.books.map((b) => [b.title, b.format]).sort()).toEqual([
			['Ember Road', 'ebook'],
			['The Salt Lantern', 'ebook'],
			['The Salt Lantern', 'paperback']
		]);
		expect(
			report.observations.every((o) => /^(B0FAKE\d{4}|97900000000\d\d)$/.test(o.externalId))
		).toBe(true);
	});
});

describe('parseKdpReport rules', () => {
	it('adds up rows for the same book, day, and marketplace, such as a Countdown Deal beside standard sales', () => {
		const r = parse({
			'eBook Royalty': [
				EBOOK_HEADER,
				ebookRow(),
				ebookRow({ 'Transaction Type': 'Kindle Countdown Deals', Royalty: '0.70' })
			]
		});
		expect(r.observations.filter((o) => o.metric === 'royalty_minor')).toEqual([
			expect.objectContaining({
				value: 413,
				periodStart: '2026-10-01',
				periodEnd: '2026-10-01',
				format: 'ebook'
			})
		]);
	});

	it('keeps refunds as negative royalties', () => {
		const r = parse({
			'eBook Royalty': [EBOOK_HEADER, ebookRow({ 'Net Units Sold': '-1.0', Royalty: '-3.43' })]
		});
		expect(r.observations.map((o) => o.value)).toEqual([-343, -1]);
	});

	it.each([
		[
			'a spreadsheet that is not a KDP report',
			{ Sheet1: [['Date', 'Sales']] },
			"doesn't look like a KDP royalty report"
		],
		[
			'a marketplace it does not know',
			{ 'eBook Royalty': [EBOOK_HEADER, ebookRow({ Marketplace: 'Amazon.moon' })] },
			'"Amazon.moon", a marketplace we don\'t recognise'
		],
		[
			'a missing column',
			{ 'eBook Royalty': [EBOOK_HEADER.filter((h) => h !== 'Royalty'), ebookRow()] },
			'has no "Royalty" column'
		],
		[
			'text where a number belongs',
			{ 'eBook Royalty': [EBOOK_HEADER, ebookRow({ Royalty: 'lots' })] },
			'Row 2 of "eBook Royalty" has "lots" for Royalty'
		],
		[
			'a bad date',
			{ 'eBook Royalty': [EBOOK_HEADER, ebookRow({ 'Royalty Date': 'October' })] },
			'has "October" as its date'
		]
	])('explains %s', (_label, sheets, message) => {
		expect(error(() => parse(sheets))).toContain(message);
	});
});

describe('readWorkbook safety', () => {
	it('refuses a file that is not a zip', () => {
		expect(
			error(() => readWorkbook(new TextEncoder().encode('Date,Sales\n2026-10-01,3')))
		).toContain("isn't a spreadsheet");
	});

	it('refuses XML with a DTD, so no entity tricks', () => {
		const bytes = buildXlsx({ S: [['x']] }, {});
		const evil = buildXlsx(
			{ S: [['x']] },
			{ 'xl/workbook.xml': '<!DOCTYPE x [<!ENTITY a "aaaa">]><workbook/>' }
		);
		expect(readWorkbook(bytes).get('S')).toEqual([['x']]);
		expect(error(() => readWorkbook(evil))).toContain("isn't a spreadsheet");
	});

	it('refuses an oversized upload', () => {
		expect(error(() => readWorkbook(new Uint8Array(11 * 1024 * 1024)))).toContain('too big');
	});
});
