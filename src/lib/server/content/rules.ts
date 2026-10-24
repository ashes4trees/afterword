import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { CAMPAIGN_VERDICTS } from '$lib/shared/campaigns';
import { DEFAULT_PREFERENCES, type PreferenceKey } from '$lib/shared/preferences';

// Rule packs (spec §6.2, #18): decision rules as dated, versioned data. Pure: the loader
// in rulePacks.ts feeds it files, and tests feed it fixtures. The engine evaluates them
// (engine/rules.ts); nothing here decides anything.

/** Preferences a threshold may read: the numeric ones. */
const NUMERIC_PREFERENCES = (Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]).filter(
	(k) => typeof DEFAULT_PREFERENCES[k] === 'number'
);

export const VALUE_FORMATS = ['money', 'percent', 'days', 'number'] as const;
export type ValueFormat = (typeof VALUE_FORMATS)[number];

const name = z.string().regex(/^[a-z][a-z0-9_]*$/, 'use lowercase_snake_case');
const OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq'] as const;
export type Operator = (typeof OPERATORS)[number];

/** `[left, op, right]`: names of inputs, derived values, or thresholds, or a number. */
const Comparison = z.tuple([name, z.enum(OPERATORS), z.union([name, z.number()])]);

const Rule = z.strictObject({
	/** Dotted id, such as `ad.kill.underperforming`. The file is named after it. */
	id: z
		.string()
		.regex(/^[a-z0-9]+(\.[a-z0-9_]+)+$/, 'use a dotted id like ad.kill.underperforming'),
	applies_to: z.enum(['campaign']),
	version: z.int().positive(),
	as_of: z.iso.date('as_of must be a YYYY-MM-DD date'),
	/** Inputs the rule needs. `*_minor` are money, names with `days` are day counts. */
	requires: z.array(name).min(1),
	/** Values worked out from inputs. `ratio: [a, b]` is a ÷ b. */
	derive: z
		.record(
			name,
			z.strictObject({
				ratio: z.tuple([name, name]),
				format: z.enum(VALUE_FORMATS).default('number')
			})
		)
		.default({}),
	/** Limits, from the author's own setting (`config`) when they've chosen one. */
	thresholds: z
		.record(
			name,
			z.strictObject({
				config: z.enum(NUMERIC_PREFERENCES as [PreferenceKey, ...PreferenceKey[]]).optional(),
				default: z.number(),
				format: z.enum(VALUE_FORMATS).optional()
			})
		)
		.default({}),
	/** The verdict applies when every (`all`) or any (`any`) comparison holds. */
	when: z.union([
		z.strictObject({ all: z.array(Comparison).min(1) }),
		z.strictObject({ any: z.array(Comparison).min(1) })
	]),
	/** One of the campaign verdicts in spec §5, stored on campaign_reviews. */
	verdict: z.enum(CAMPAIGN_VERDICTS),
	/** Plain-language template with {name} placeholders. The fallback when AI is off. */
	explain: z.string().min(1).max(500)
});

export type RuleDef = z.infer<typeof Rule>;

/** How a value reads in an explanation, from its declaration or its name. */
export function valueFormat(rule: RuleDef, key: string): ValueFormat {
	const declared = rule.derive[key]?.format ?? rule.thresholds[key]?.format;
	if (declared) return declared;
	const source = rule.thresholds[key]?.config ?? key;
	if (source.endsWith('_minor')) return 'money';
	if (source.includes('days')) return 'days';
	return 'number';
}

export class RuleError extends Error {
	constructor(readonly problems: string[]) {
		super(`Invalid rules:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
		this.name = 'RuleError';
	}
}

/** Names a rule can refer to: inputs, derived values, and thresholds. */
const knownNames = (rule: RuleDef) =>
	new Set([...rule.requires, ...Object.keys(rule.derive), ...Object.keys(rule.thresholds)]);

function crossCheck(rule: RuleDef): string[] {
	const problems: string[] = [];
	const known = knownNames(rule);
	const inputs = new Set(rule.requires);
	if (inputs.size !== rule.requires.length) problems.push('requires lists a name twice');
	for (const k of Object.keys(rule.derive)) {
		if (inputs.has(k) || k in rule.thresholds) problems.push(`"${k}" is declared twice`);
		for (const operand of rule.derive[k]!.ratio) {
			if (!inputs.has(operand)) problems.push(`derive.${k}: "${operand}" is not in requires`);
		}
	}
	for (const k of Object.keys(rule.thresholds)) {
		if (inputs.has(k)) problems.push(`"${k}" is declared twice`);
	}
	const comparisons = 'all' in rule.when ? rule.when.all : rule.when.any;
	for (const [left, , right] of comparisons) {
		for (const operand of [left, right]) {
			if (typeof operand === 'string' && !known.has(operand)) {
				problems.push(`when: "${operand}" is not an input, derived value, or threshold`);
			}
		}
	}
	for (const [, placeholder] of rule.explain.matchAll(/\{([^}]*)\}/g)) {
		if (!known.has(placeholder!)) problems.push(`explain: unknown placeholder {${placeholder}}`);
	}
	return problems;
}

/**
 * Parses and validates every rule, keyed by file path such as
 * "/content/rules/ad.kill.underperforming.yaml". Collects every problem before throwing.
 */
export function parseRules(files: Record<string, string>, today: string): RuleDef[] {
	const problems: string[] = [];
	const rules: RuleDef[] = [];
	const seen = new Set<string>();
	for (const [path, text] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
		let raw: unknown;
		try {
			raw = parseYaml(text);
		} catch (e) {
			problems.push(`${path}: not valid YAML (${(e as Error).message.split('\n')[0]})`);
			continue;
		}
		const result = Rule.safeParse(raw);
		if (!result.success) {
			for (const issue of result.error.issues) {
				problems.push(`${path}: ${issue.path.join('.') || '(file)'}: ${issue.message}`);
			}
			continue;
		}
		const rule = result.data;
		problems.push(...crossCheck(rule).map((p) => `${path}: ${p}`));
		const file = /\/rules\/([^/]+)\.ya?ml$/.exec(path)?.[1];
		if (file !== rule.id) problems.push(`${path}: file name must match id "${rule.id}"`);
		if (rule.as_of > today) problems.push(`${path}: as_of ${rule.as_of} is in the future`);
		if (seen.has(rule.id)) problems.push(`${path}: duplicate id "${rule.id}"`);
		seen.add(rule.id);
		rules.push(rule);
	}
	if (problems.length > 0) throw new RuleError(problems);
	return rules;
}
