// Promo ideas (#84): phases and plain-language timing, shared by the server and the page.
import { z } from 'zod';

export const IDEA_PHASES = ['writing', 'prelaunch', 'launch', 'after'] as const;
export type IdeaPhase = (typeof IDEA_PHASES)[number];

export const PHASE_LABELS: Record<IdeaPhase, string> = {
	writing: 'While you write',
	prelaunch: 'Before launch',
	launch: 'Launch week',
	after: 'After launch'
};

const amount = (n: number, unit: 'day' | 'week') => `${n} ${unit}${n === 1 ? '' : 's'}`;

/** "Best 8 to 5 weeks before release", from a window in days relative to release. */
export function describeWindow(w: { from_days: number; to_days: number } | null): string {
	if (!w) return 'Anytime';
	const [from, to] = [w.from_days, w.to_days];
	const weeks = from % 7 === 0 && to % 7 === 0;
	const k = weeks ? 7 : 1;
	const unit = weeks ? 'week' : 'day';
	const n = (d: number) => Math.abs(d) / k;
	if (to < 0) {
		return from === to
			? `Best ${amount(n(from), unit)} before release`
			: n(to) === 1
				? `Best ${amount(n(from), unit)} to ${amount(1, unit)} before release`
				: `Best ${n(from)} to ${n(to)} ${unit}s before release`;
	}
	if (from > 0) return `Best ${n(from)} to ${n(to)} ${unit}s after release`;
	if (from === 0)
		return to === 0 ? 'On release day' : `From release day to ${amount(n(to), unit)} after`;
	if (to === 0) return `In the ${amount(n(from), unit)} before release`;
	return `From ${amount(n(from), unit)} before to ${amount(n(to), unit)} after release`;
}

/** The pack name for the author's own ideas (#91). Their tasks use the idea's id as step. */
export const MY_IDEAS_PACK = 'mine';

const SIDES = ['before', 'after'] as const;
type Side = (typeof SIDES)[number];

/** The My ideas form's fields, as strings, so a failed save can show them again. */
export type MyIdeaFormValues = {
	label: string;
	note: string;
	phase: string;
	fromWeeks: string;
	fromSide: string;
	toWeeks: string;
	toSide: string;
	repeatable: string;
	/** "on" to offer it to other authors, after the maintainer reviews it. */
	share: string;
};

export const EMPTY_MY_IDEA: MyIdeaFormValues = {
	label: '',
	note: '',
	phase: 'prelaunch',
	fromWeeks: '',
	fromSide: 'before',
	toWeeks: '',
	toSide: 'before',
	repeatable: '',
	share: ''
};

/** Whole weeks, or blank. */
const weeks = z
	.string()
	.trim()
	.regex(/^\d{0,3}$/, 'Use whole weeks, like 4.')
	.refine((w) => w === '' || Number(w) <= 104, 'Keep it within two years of release.');

/** Form values → a stored idea. Timing is optional: leave both weeks blank for Anytime. */
export const MyIdeaSchema = z
	.object({
		label: z
			.string()
			.trim()
			.min(1, 'Give your idea a name.')
			.max(120, 'Keep it under 120 characters.'),
		note: z
			.string()
			.trim()
			.max(280, 'Keep the note under 280 characters.')
			.transform((s) => s || null),
		phase: z.enum(IDEA_PHASES),
		fromWeeks: weeks,
		fromSide: z.enum(SIDES),
		toWeeks: weeks,
		toSide: z.enum(SIDES),
		repeatable: z.string().transform((v) => v === 'on'),
		share: z
			.string()
			.optional()
			.transform((v) => v === 'on')
	})
	.transform((v, ctx) => {
		const days = (n: number, side: Side) => (side === 'before' ? -n : n) * 7;
		const blank = v.fromWeeks === '' && v.toWeeks === '';
		if (!blank && (v.fromWeeks === '' || v.toWeeks === '')) {
			ctx.addIssue({
				code: 'custom',
				path: ['toWeeks'],
				message: 'Fill in both ends, or neither.'
			});
			return z.NEVER;
		}
		const window = blank
			? null
			: {
					from_days: days(Number(v.fromWeeks), v.fromSide),
					to_days: days(Number(v.toWeeks), v.toSide)
				};
		if (window && window.from_days > window.to_days) {
			ctx.addIssue({
				code: 'custom',
				path: ['toWeeks'],
				message: 'The end comes before the start.'
			});
			return z.NEVER;
		}
		return {
			label: v.label,
			note: v.note,
			phase: v.phase,
			window,
			repeatable: v.repeatable,
			shared: v.share
		};
	});
export type MyIdeaInput = z.output<typeof MyIdeaSchema>;

/** A stored idea → form values, for editing. */
export function myIdeaFormValues(idea: MyIdeaInput): MyIdeaFormValues {
	const end = (d: number) => ({
		weeks: String(Math.round(Math.abs(d) / 7)),
		side: d < 0 ? 'before' : 'after'
	});
	const from = idea.window && end(idea.window.from_days);
	const to = idea.window && end(idea.window.to_days);
	return {
		label: idea.label,
		note: idea.note ?? '',
		phase: idea.phase,
		fromWeeks: from?.weeks ?? '',
		fromSide: from?.side ?? 'before',
		toWeeks: to?.weeks ?? '',
		toSide: to?.side ?? 'before',
		repeatable: idea.repeatable ? 'on' : '',
		share: idea.shared ? 'on' : ''
	};
}
