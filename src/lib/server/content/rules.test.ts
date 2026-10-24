import { describe, expect, it } from 'vitest';
import { parseRules, RuleError, valueFormat } from './rules';

const TODAY = '2026-10-24';
const PATH = '/content/rules/ad.kill.test.yaml';
const rule = (extra = '') => `
id: ad.kill.test
applies_to: campaign
version: 1
as_of: 2026-10-01
requires: [ad_spend_minor, ad_sales_minor, days_live]
derive:
  acos: { ratio: [ad_spend_minor, ad_sales_minor], format: percent }
thresholds:
  min_days: { config: min_ad_eval_days, default: 30 }
  acos_ceiling: { config: target_acos, default: 0.7, format: percent }
when:
  all:
    - [days_live, gte, min_days]
    - [acos, gt, acos_ceiling]
verdict: kill
explain: "Live {days_live} days, ACOS {acos} against {acos_ceiling}."
${extra}`;

const problems = (files: Record<string, string>) => {
	try {
		parseRules(files, TODAY);
		return [];
	} catch (e) {
		if (e instanceof RuleError) return e.problems;
		throw e;
	}
};

describe('parseRules', () => {
	it('parses a valid rule', () => {
		const [r] = parseRules({ [PATH]: rule() }, TODAY);
		expect(r).toMatchObject({ id: 'ad.kill.test', verdict: 'kill' });
		expect(valueFormat(r!, 'ad_spend_minor')).toBe('money');
		expect(valueFormat(r!, 'days_live')).toBe('days');
		expect(valueFormat(r!, 'min_days')).toBe('days');
		expect(valueFormat(r!, 'acos')).toBe('percent');
	});

	it.each([
		[
			'an unknown placeholder',
			rule().replace('{acos_ceiling}', '{ceiling}'),
			'unknown placeholder {ceiling}'
		],
		['an unknown name in when', rule().replace('[acos, gt', '[roas, gt'), '"roas" is not an input'],
		[
			'a ratio of something not required',
			rule().replace('ad_sales_minor], format', 'ad_clicks], format'),
			'"ad_clicks" is not in requires'
		],
		[
			'a non-numeric setting',
			rule().replace('config: target_acos', 'config: currency'),
			'thresholds.acos_ceiling.config'
		],
		[
			'a future as_of',
			rule().replace('as_of: 2026-10-01', 'as_of: 2027-01-01'),
			'is in the future'
		],
		[
			'a duplicate name',
			rule().replace('min_days:', 'days_live:').replaceAll('min_days', 'days_live'),
			'declared twice'
		]
	])('reports %s', (_label, text, message) => {
		expect(problems({ [PATH]: text }).join('\n')).toContain(message);
	});

	it('needs the file named after the id', () => {
		expect(problems({ '/content/rules/other.yaml': rule() }).join('\n')).toContain(
			'file name must match id'
		);
	});

	it('collects problems from every file before throwing', () => {
		expect(
			problems({
				'/content/rules/a.yaml': 'not: [valid',
				[PATH]: rule().replace('{acos}', '{nope}')
			})
		).toHaveLength(2);
	});
});

// The real rules in content/rules. Importing the loader validates them, so a bad rule
// fails CI here as well as stopping the server at boot.
describe('content/rules', () => {
	it('loads and validates every rule', async () => {
		const { RULES } = await import('./rulePacks');
		expect(RULES.map((r) => r.id)).toContain('ad.kill.underperforming');
	});
});
