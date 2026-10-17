import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { BOOK_FORMATS, CHANNEL_SLUGS } from '$lib/shared/channels';

// Playbook packs (spec §6.1, #13): dated, sourced advice as data. Pure: the loader in
// playbooks.ts feeds it files, and tests feed it fixtures.

export { IDEA_PHASES, type IdeaPhase } from '$lib/shared/ideas';
import { IDEA_PHASES } from '$lib/shared/ideas';

/** Conditions a step can wait on besides other steps. Evaluated by task generation (#16). */
export const PLAYBOOK_FACTS = ['isbn_assigned', 'release_date_set'] as const;

/** Listing settings a step can point at, so the editor (#12) can show the advice beside them. */
export const LISTING_FIELDS = [
	'external_id',
	'price_minor',
	'currency',
	'enrolled_in_select',
	'exclusivity_start',
	'exclusivity_end',
	'wholesale_discount_pct',
	'returnable'
] as const;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase words joined by hyphens');

const Source = z
	.union([z.url(), z.strictObject({ url: z.url(), title: z.string().min(1).max(200) })])
	.transform((s) => (typeof s === 'string' ? { url: s } : s));

const Step = z.strictObject({
	id: slug,
	label: z.string().min(1).max(120),
	detail: z.string().max(2000).optional(),
	/** Which formats the step applies to; omit for all. */
	formats: z.array(z.enum(BOOK_FORMATS)).min(1).optional(),
	fields: z.array(z.enum(LISTING_FIELDS)).default([]),
	gotchas: z.array(z.string().min(1).max(500)).default([]),
	/** Tools authors commonly use for this step, shown as "Popular options". At most three. */
	links: z
		.array(
			z.strictObject({
				label: z.string().min(1).max(40),
				url: z.url({ protocol: /^https$/, error: 'links must be https URLs' })
			})
		)
		.max(3, 'at most three links per step')
		.default([]),
	/** Other step ids in this pack, or PLAYBOOK_FACTS. */
	preconditions: z.array(z.string()).default([]),
	/** When the step is due, relative to a date on the book. */
	due: z
		.strictObject({
			anchor: z.enum(['release_date']),
			offset_days: z.int().min(-730).max(730)
		})
		.optional(),
	/** Worth a reminder (#46). Timeline steps need a due date; ideas a window. */
	milestone: z.boolean().default(false),
	/** Ideas packs only (#84): which part of the journey the idea belongs to. */
	phase: z.enum(IDEA_PHASES).optional(),
	/** Ideas packs only: when it tends to work best, relative to a date on the book. */
	window: z
		.strictObject({
			anchor: z.enum(['release_date']),
			from_days: z.int().min(-730).max(730),
			to_days: z.int().min(-730).max(730)
		})
		.refine((w) => w.from_days <= w.to_days, 'from_days must not be after to_days')
		.optional(),
	/** Ideas packs only: can be added to a timeline more than once, such as weekly teasers. */
	repeatable: z.boolean().default(false)
});

const Pack = z
	.strictObject({
		pack: slug,
		/** A title-scoped pack (such as the launch timeline) has no channel. */
		channel: z.enum(CHANNEL_SLUGS).optional(),
		/**
		 * A timeline generates tasks for every book. An ideas pack (#84) is a library the
		 * author picks from; nothing is added until they choose to.
		 */
		kind: z.enum(['timeline', 'ideas']).default('timeline'),
		title: z.string().min(1).max(120),
		version: z.int().positive(),
		as_of: z.iso.date('as_of must be a YYYY-MM-DD date'),
		sources: z.array(Source).min(1, 'at least one source is required'),
		steps: z.array(Step).min(1)
	})
	.superRefine((pack, ctx) => {
		const ids = new Set<string>();
		if (pack.kind === 'ideas' && pack.channel) {
			ctx.addIssue({ code: 'custom', path: ['channel'], message: 'ideas packs are title-scoped' });
		}
		pack.steps.forEach((step, i) => {
			if (ids.has(step.id)) {
				ctx.addIssue({
					code: 'custom',
					path: ['steps', i, 'id'],
					message: `duplicate step id "${step.id}"`
				});
			}
			ids.add(step.id);
			const ideas = pack.kind === 'ideas';
			const problem = (key: string, message: string) =>
				ctx.addIssue({ code: 'custom', path: ['steps', i, key], message });
			if (step.milestone && !(ideas ? step.window : step.due)) {
				problem(
					'milestone',
					ideas ? 'a milestone idea needs a window' : 'a milestone needs a due date'
				);
			}
			if (ideas && !step.phase) problem('phase', 'every idea needs a phase');
			if (ideas && step.due) problem('due', 'ideas use a window, not a due date');
			if (!ideas && (step.phase || step.window || step.repeatable)) {
				problem('phase', 'phase, window, and repeatable are only for ideas packs');
			}
		});
		pack.steps.forEach((step, i) =>
			step.preconditions.forEach((p, j) => {
				if (!ids.has(p) && !(PLAYBOOK_FACTS as readonly string[]).includes(p)) {
					ctx.addIssue({
						code: 'custom',
						path: ['steps', i, 'preconditions', j],
						message: `"${p}" is neither a step in this pack nor a known fact`
					});
				}
			})
		);
	});

export type Playbook = z.infer<typeof Pack>;
export type PlaybookStep = Playbook['steps'][number];

export class PlaybookError extends Error {
	constructor(readonly problems: string[]) {
		super(`Invalid playbooks:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
		this.name = 'PlaybookError';
	}
}

/**
 * Parses and validates every pack, keyed by file path such as
 * "/content/playbooks/ingram/print-setup.yaml". Collects every problem before throwing,
 * so one bad file doesn't hide the others.
 */
export function parsePlaybooks(files: Record<string, string>, today: string): Playbook[] {
	const problems: string[] = [];
	const packs: Playbook[] = [];
	const seen = new Map<string, string>();

	for (const [path, text] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
		let raw: unknown;
		try {
			raw = parseYaml(text);
		} catch (e) {
			problems.push(`${path}: not valid YAML (${(e as Error).message.split('\n')[0]})`);
			continue;
		}
		const result = Pack.safeParse(raw);
		if (!result.success) {
			for (const issue of result.error.issues) {
				problems.push(`${path}: ${issue.path.join('.') || '(file)'}: ${issue.message}`);
			}
			continue;
		}
		const pack = result.data;

		const [, dir, file] = /\/playbooks\/([^/]+)\/([^/]+)\.ya?ml$/.exec(path) ?? [];
		const expectedDir = pack.channel ?? 'title';
		if (dir !== expectedDir) {
			problems.push(`${path}: belongs in content/playbooks/${expectedDir}/`);
		}
		if (file !== pack.pack) problems.push(`${path}: file name must match pack "${pack.pack}"`);
		if (pack.as_of > today) problems.push(`${path}: as_of ${pack.as_of} is in the future`);

		const key = `${expectedDir}/${pack.pack}`;
		if (seen.has(key)) problems.push(`${path}: duplicate of ${seen.get(key)}`);
		seen.set(key, path);
		packs.push(pack);
	}

	if (problems.length > 0) throw new PlaybookError(problems);
	return packs;
}
