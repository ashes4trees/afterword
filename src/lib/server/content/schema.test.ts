import { describe, expect, it } from 'vitest';
import { PlaybookError, parsePlaybooks } from './schema';

const TODAY = '2026-10-17';

// The spec §6.1 example, trimmed.
const ingram = `
channel: ingram
pack: print-setup
title: IngramSpark print setup
version: 3
as_of: 2026-09-14
sources:
  - https://www.ingramspark.com/
steps:
  - id: isbn
    label: Assign an ISBN
  - id: wholesale-discount
    label: Set wholesale discount
    detail: Bookstores generally expect 53–55%.
    fields: [wholesale_discount_pct]
    gotchas:
      - Changing this after listing propagates slowly to retailers.
    preconditions: [isbn, isbn_assigned]
`;

const launch = `
pack: launch-timeline
title: Launch timeline
version: 1
as_of: 2026-10-17
sources:
  - url: https://example.com/launch
    title: A launch guide
steps:
  - id: cover-reveal
    label: Cover reveal
    due: { anchor: release_date, offset_days: -60 }
    milestone: true
  - id: audio-arcs
    label: Send audiobook review codes
    formats: [audiobook]
    due: { anchor: release_date, offset_days: -14 }
`;

const parse = (files: Record<string, string>) => parsePlaybooks(files, TODAY);
const problems = (files: Record<string, string>) => {
	try {
		parse(files);
	} catch (e) {
		if (e instanceof PlaybookError) return e.problems;
		throw e;
	}
	return [];
};

describe('parsePlaybooks', () => {
	it('reads channel packs and title-scoped packs, filling defaults', () => {
		const [ingramPack, launchPack] = parse({
			'/content/playbooks/ingram/print-setup.yaml': ingram,
			'/content/playbooks/title/launch-timeline.yaml': launch
		});
		expect(ingramPack).toMatchObject({ channel: 'ingram', version: 3, as_of: '2026-09-14' });
		expect(ingramPack!.sources).toEqual([{ url: 'https://www.ingramspark.com/' }]);
		expect(ingramPack!.steps[0]).toMatchObject({ fields: [], gotchas: [], milestone: false });
		expect(launchPack!.channel).toBeUndefined();
		expect(launchPack!.steps[0]!.due).toEqual({ anchor: 'release_date', offset_days: -60 });
		expect(launchPack!.steps[1]!.formats).toEqual(['audiobook']);
	});

	it('returns nothing for no packs', () => {
		expect(parse({})).toEqual([]);
	});

	it.each([
		['a missing as_of', ingram.replace('as_of: 2026-09-14\n', ''), /as_of/],
		['an as_of in the future', ingram.replace('2026-09-14', '2027-01-01'), /in the future/],
		['no sources', ingram.replace(/sources:\n {2}- .*\n/, 'sources: []\n'), /at least one source/],
		['an unknown channel', ingram.replace('channel: ingram', 'channel: smashwords'), /channel/],
		['an unknown field', ingram.replace('[wholesale_discount_pct]', '[blurb]'), /fields/],
		[
			'an unknown precondition',
			ingram.replace('[isbn, isbn_assigned]', '[cover_done]'),
			/cover_done/
		],
		[
			'a duplicate step id',
			ingram.replace('id: wholesale-discount', 'id: isbn'),
			/duplicate step id/
		],
		['an unexpected key', ingram.replace('version: 3', 'version: 3\nnotes: hi'), /notes/],
		[
			'four links on a step',
			ingram.replace(
				'    label: Assign an ISBN',
				'    label: Assign an ISBN\n    links:\n' +
					[1, 2, 3, 4]
						.map((n) => `      - { label: L${n}, url: https://example.com/${n} }`)
						.join('\n')
			),
			/at most three links/
		],
		[
			'a non-https link',
			ingram.replace(
				'    label: Assign an ISBN',
				'    label: Assign an ISBN\n    links:\n      - { label: L, url: http://example.com }'
			),
			/https/
		],
		['invalid YAML', 'pack: [unclosed', /not valid YAML/]
	])('rejects %s', (_label, text, message) => {
		expect(problems({ '/content/playbooks/ingram/print-setup.yaml': text }).join('\n')).toMatch(
			message
		);
	});

	it('rejects a milestone without a due date', () => {
		const text = launch.replace('    due: { anchor: release_date, offset_days: -60 }\n', '');
		expect(problems({ '/content/playbooks/title/launch-timeline.yaml': text }).join()).toMatch(
			/milestone needs a due date/
		);
	});

	it('checks the folder and file name match the pack', () => {
		expect(problems({ '/content/playbooks/kdp/print-setup.yaml': ingram })).toEqual([
			'/content/playbooks/kdp/print-setup.yaml: belongs in content/playbooks/ingram/'
		]);
		expect(problems({ '/content/playbooks/ingram/other.yaml': ingram })).toEqual([
			'/content/playbooks/ingram/other.yaml: file name must match pack "print-setup"'
		]);
		expect(problems({ '/content/playbooks/ingram/launch-timeline.yaml': launch })[0]).toMatch(
			/belongs in content\/playbooks\/title\//
		);
	});

	it('reports every bad file, not just the first', () => {
		const found = problems({
			'/content/playbooks/ingram/print-setup.yaml': ingram.replace('as_of: 2026-09-14\n', ''),
			'/content/playbooks/title/launch-timeline.yaml': 'pack: [unclosed'
		});
		expect(found).toHaveLength(2);
	});
});
