import { valueFormat, type Operator, type RuleDef } from '$lib/server/content/rules';
import { formatMoney } from '$lib/shared/money';
import type { Preferences } from '$lib/shared/preferences';

// Evaluates rule packs (#18). Pure: callers pass a rule, its inputs, the author's
// settings, and a currency, and get a verdict with a deterministic explanation. The
// explanation is the fallback narration when AI is off (spec §6.2), never a prompt.

/**
 * Each threshold's value: the author's own setting when they've chosen one (`stored` holds
 * only the preferences they've set), otherwise the rule's default.
 */
export function resolveThresholds(
	rule: RuleDef,
	stored: Partial<Preferences>
): Record<string, number> {
	return Object.fromEntries(
		Object.entries(rule.thresholds).map(([key, t]) => {
			const own = t.config ? stored[t.config] : undefined;
			return [key, typeof own === 'number' ? own : t.default];
		})
	);
}

export type RuleResult = {
	ruleId: string;
	verdict: string;
	/** Whether the verdict applies. False when an input is missing. */
	applies: boolean;
	/** Required inputs that weren't given. */
	missing: string[];
	/** Every input, derived value, and threshold. Null when it can't be worked out. */
	values: Record<string, number | null>;
	/** The filled-in `explain` template, or null when inputs are missing. */
	explanation: string | null;
};

const compare = (a: number | null, op: Operator, b: number | null) => {
	if (a === null || b === null) return false;
	switch (op) {
		case 'gt':
			return a > b;
		case 'gte':
			return a >= b;
		case 'lt':
			return a < b;
		case 'lte':
			return a <= b;
		case 'eq':
			return a === b;
	}
};

/** A ratio: Infinity when only the denominator is zero, null when both are. */
const ratio = (a: number, b: number) => (b !== 0 ? a / b : a === 0 ? null : Infinity);

export function formatValue(value: number | null, format: string, currency: string): string {
	if (value === null || !Number.isFinite(value)) return '—';
	switch (format) {
		case 'money':
			return formatMoney(value, currency);
		case 'percent':
			return `${Math.round(value * 100)}%`;
		case 'days':
			return String(Math.round(value));
		default:
			return Number.isInteger(value) ? String(value) : value.toFixed(2);
	}
}

export function evaluateRule(
	rule: RuleDef,
	inputs: Partial<Record<string, number>>,
	stored: Partial<Preferences>,
	currency: string
): RuleResult {
	const missing = rule.requires.filter((k) => typeof inputs[k] !== 'number');
	const values: Record<string, number | null> = {};
	for (const k of rule.requires) values[k] = inputs[k] ?? null;
	for (const [k, d] of Object.entries(rule.derive)) {
		const [a, b] = d.ratio.map((n) => values[n] ?? null);
		values[k] = a === null || b === null ? null : ratio(a, b);
	}
	Object.assign(values, resolveThresholds(rule, stored));

	const base = { ruleId: rule.id, verdict: rule.verdict, missing, values };
	if (missing.length > 0) return { ...base, applies: false, explanation: null };

	const value = (operand: string | number) =>
		typeof operand === 'number' ? operand : (values[operand] ?? null);
	const holds = (c: [string, Operator, string | number]) => compare(value(c[0]), c[1], value(c[2]));
	const applies = 'all' in rule.when ? rule.when.all.every(holds) : rule.when.any.some(holds);
	const explanation = rule.explain
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/\{([^}]+)\}/g, (_, k: string) =>
			formatValue(values[k] ?? null, valueFormat(rule, k), currency)
		);
	return { ...base, applies, explanation };
}
