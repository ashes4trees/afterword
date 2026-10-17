import { describe, expect, it } from 'vitest';
import {
	EMPTY_TITLE_FORM,
	TitleInputSchema,
	titleFormValues,
	type TitleFormValues
} from './titles';

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
			contentSex: null,
			contentViolence: null,
			contentLanguage: null,
			pageCount: null,
			wordCount: null,
			formats: ['ebook', 'paperback'],
			releaseDate: null,
			stage: 'metadata'
		});
	});

	it('reads formats as one of each, in the standard order', () => {
		const result = parse({ formats: 'audiobook,ebook,ebook' });
		expect(result.success && result.data.formats).toEqual(['ebook', 'audiobook']);
	});

	it.each([
		['no format', ''],
		['an unknown format', 'scroll']
	])('rejects %s', (_label, formats) => {
		const result = parse({ formats });
		expect(result.success).toBe(false);
		expect(result.error!.issues.map((i) => i.path[0])).toContain('formats');
	});

	it('defaults a blank stage to metadata', () => {
		const result = parse({ stage: '' });
		expect(result.success && result.data.stage).toBe('metadata');
	});

	it('parses numbers, dates, and a comma-separated trope list', () => {
		const result = parse({
			seriesTitle: 'Saga',
			seriesPosition: '2.5',
			contentSex: '0',
			contentViolence: '5',
			pageCount: '320',
			releaseDate: '2027-03-14',
			tropes: ' found family, Enemies to lovers ,, found Family '
		});
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.data).toMatchObject({
			seriesPosition: 2.5,
			contentSex: 0,
			contentViolence: 5,
			contentLanguage: null,
			pageCount: 320,
			releaseDate: '2027-03-14',
			tropes: ['found Family', 'Enemies to lovers']
		});
	});

	it.each([
		['a missing working title', { workingTitle: '  ' }, 'workingTitle'],
		['a position without a series', { seriesPosition: '1' }, 'seriesPosition'],
		[
			"a position that isn't a whole number or half",
			{ seriesTitle: 'S', seriesPosition: '1.25' },
			'seriesPosition'
		],
		['a fractional page count', { pageCount: '12.5' }, 'pageCount'],
		['a sex rating of 6', { contentSex: '6' }, 'contentSex'],
		['a fractional language rating', { contentLanguage: '2.5' }, 'contentLanguage'],
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

describe('titleFormValues', () => {
	it('keeps a trope that was typed but never added as a chip', () => {
		const form = new FormData();
		form.set('tropes', 'heist, slow burn');
		form.set('tropesDraft', 'found family');
		expect(titleFormValues(form).tropes).toBe('heist, slow burn, found family');
	});

	it('ignores an empty draft', () => {
		const form = new FormData();
		form.set('tropes', 'heist');
		form.set('tropesDraft', '  ');
		expect(titleFormValues(form).tropes).toBe('heist');
	});
});
