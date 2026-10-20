import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
	it('quotes commas, quotes, and newlines, and writes objects as JSON', () => {
		expect(
			toCsv(
				['title', 'tropes', 'note', 'n'],
				[{ title: 'Salt, Lantern', tropes: ['found family'], note: 'say "hi"\nthere', n: null }]
			)
		).toBe('title,tropes,note,n\r\n"Salt, Lantern","[""found family""]","say ""hi""\nthere",\r\n');
	});

	it('defuses text a spreadsheet would run as a formula, but not negative numbers', () => {
		expect(toCsv(['a', 'b'], [{ a: '=SUM(A1)', b: -28 }])).toBe("a,b\r\n'=SUM(A1),-28\r\n");
	});
});
