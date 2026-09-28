import { describe, expect, it } from 'vitest';
import { EMPTY_TITLE_FORM, TitleInputSchema, type TitleFormValues } from './titles';

const parse = (fields: Partial<TitleFormValues>) =>
	TitleInputSchema.safeParse({ ...EMPTY_TITLE_FORM, workingTitle: 'Book', ...fields });

describe('TitleInputSchema', () => {
	it('turns blank form fields into nulls', () => {
		const result = parse({});
		expect(result.success && result.data).toEqual({
			workingTitle: 'Book',
			penName: null,
			seriesTitle: null,
			seriesPosition: null,
			genre: null,
			subgenre: null,
			tropes: [],
			heatLevel: null,
			pageCount: null,
			wordCount: null,
			releaseDate: null,
			stage: 'metadata'
		});
	});

	it('defaults a blank stage to metadata', () => {
		const result = parse({ stage: '' });
		expect(result.success && result.data.stage).toBe('metadata');
	});

	it('parses numbers, dates, and a comma-separated trope list', () => {
		const result = parse({
			seriesTitle: 'Saga',
			seriesPosition: '2.5',
			heatLevel: '0',
			pageCount: '320',
			releaseDate: '2027-03-14',
			tropes: ' found family, Enemies to lovers ,, found Family '
		});
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data).toMatchObject({
			seriesPosition: 2.5,
			heatLevel: 0,
			pageCount: 320,
			releaseDate: '2027-03-14',
			tropes: ['found Family', 'Enemies to lovers']
		});
	});

	it.each([
		['a missing working title', { workingTitle: '  ' }, 'workingTitle'],
		['a position without a series', { seriesPosition: '1' }, 'seriesPosition'],
		[
			'a position with three decimals',
			{ seriesTitle: 'S', seriesPosition: '1.125' },
			'seriesPosition'
		],
		['a fractional page count', { pageCount: '12.5' }, 'pageCount'],
		['a heat level of 6', { heatLevel: '6' }, 'heatLevel'],
		['an impossible date', { releaseDate: '2027-02-30' }, 'releaseDate'],
		['a genre over 60 characters', { genre: 'x'.repeat(61) }, 'genre'],
		['21 tropes', { tropes: Array.from({ length: 21 }, (_, i) => `t${i}`).join(',') }, 'tropes'],
		['an unknown stage', { stage: 'drafting' }, 'stage']
	])('rejects %s', (_label, fields, path) => {
		const result = parse(fields);
		expect(result.success).toBe(false);
		expect(result.error!.issues.map((i) => i.path[0])).toContain(path);
	});
});
