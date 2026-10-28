// Test-only: builds a minimal .xlsx from rows of text, in the shape KDP's export uses
// (inline strings), for parser error cases. App code must not import this.
import { zipFiles } from '$lib/server/zip';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const col = (i: number): string =>
	(i >= 26 ? col(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));

export function buildXlsx(sheets: Record<string, string[][]>, extra: Record<string, string> = {}) {
	const names = Object.keys(sheets);
	const files = [
		{
			name: 'xl/workbook.xml',
			data: `<?xml version="1.0"?><workbook xmlns:r="r"><sheets>${names
				.map((n, i) => `<sheet name="${esc(n)}" r:id="rId${i + 1}" sheetId="${i + 1}"/>`)
				.join('')}</sheets></workbook>`
		},
		{
			name: 'xl/_rels/workbook.xml.rels',
			data: `<?xml version="1.0"?><Relationships>${names
				.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`)
				.join('')}</Relationships>`
		},
		...names.map((n, i) => ({
			name: `xl/worksheets/sheet${i + 1}.xml`,
			data: `<?xml version="1.0"?><worksheet><sheetData>${sheets[n]!.map(
				(row, r) =>
					`<row r="${r + 1}">${row
						.map((v, c) => `<c r="${col(c)}${r + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`)
						.join('')}</row>`
			).join('')}</sheetData></worksheet>`
		})),
		...Object.entries(extra).map(([name, data]) => ({ name, data }))
	];
	return zipFiles(files);
}
