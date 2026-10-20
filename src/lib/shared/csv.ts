// CSV for spreadsheets (#17): RFC 4180 quoting, objects and arrays as JSON.

/** Text a spreadsheet would run as a formula gets a leading apostrophe. Numbers don't. */
const FORMULA = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
	if (value === null || value === undefined) return '';
	let text =
		typeof value === 'object' ? JSON.stringify(value) : String(value as string | number | boolean);
	if (typeof value === 'string' && FORMULA.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
	const lines = [columns.map(cell).join(',')];
	for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(','));
	return `${lines.join('\r\n')}\r\n`;
}
