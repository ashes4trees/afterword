import { z } from 'zod';

// Book metadata as the author enters it (#9). Product facts only, never prose (C2):
// every text field is short and bounded, matching the varchar limits in schema.ts.

export const TITLE_STAGES = [
	'metadata',
	'uploaded',
	'preorder',
	'launch',
	'post_launch',
	'backlist'
] as const;
export type TitleStage = (typeof TITLE_STAGES)[number];

export const STAGE_LABELS: Record<TitleStage, string> = {
	metadata: 'Metadata',
	uploaded: 'Uploaded',
	preorder: 'Preorder',
	launch: 'Launch',
	post_launch: 'Post-launch',
	backlist: 'Backlist'
};

/** Index is the stored heat_level. Null means heat doesn't apply to the book. */
export const HEAT_LABELS = ['None', 'Sweet', 'Mild', 'Warm', 'Steamy', 'Explicit'] as const;

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blankToNull, schema.nullable());
const shortText = (max: number, label: string) =>
	z.string().trim().max(max, `${label} must be ${max} characters or fewer`);
const count = (label: string, max: number) =>
	z.coerce
		.number({ error: `${label} must be a number` })
		.int(`${label} must be a whole number`)
		.positive(`${label} must be more than 0`)
		.max(max, `${label} looks too large`);

export const TitleInputSchema = z
	.object({
		workingTitle: shortText(200, 'Working title').min(1, 'Give the book a working title'),
		penName: optional(shortText(120, 'Pen name')),
		seriesTitle: optional(shortText(200, 'Series')),
		seriesPosition: optional(
			z.coerce
				.number({ error: 'Position must be a number' })
				.positive('Position must be more than 0')
				.max(999.99, 'Position looks too large')
				.refine((n) => Number.isInteger(n * 100), 'Use at most two decimal places')
		),
		genre: optional(shortText(60, 'Genre')),
		subgenre: optional(shortText(60, 'Subgenre')),
		tropes: z.preprocess(
			(v) =>
				typeof v === 'string'
					? v
							.split(',')
							.map((t) => t.trim())
							.filter(Boolean)
					: v,
			z
				.array(shortText(60, 'Each trope'))
				.max(20, 'Up to 20 tropes')
				.transform((ts) => [...new Map(ts.map((t) => [t.toLowerCase(), t])).values()])
		),
		heatLevel: optional(z.coerce.number().int().min(0).max(5)),
		pageCount: optional(count('Page count', 10_000)),
		wordCount: optional(count('Word count', 2_000_000)),
		releaseDate: optional(z.iso.date('Use a full date')),
		stage: z.preprocess((v) => (v === '' ? undefined : v), z.enum(TITLE_STAGES).default('metadata'))
	})
	.refine((t) => t.seriesPosition === null || t.seriesTitle !== null, {
		path: ['seriesPosition'],
		message: 'Choose a series before giving a position'
	});

export type TitleInput = z.infer<typeof TitleInputSchema>;

/** The form's raw string values, used to refill it after a failed submit. */
export type TitleFormValues = Record<keyof TitleInput, string>;

export function titleFormValues(form: FormData): TitleFormValues {
	const get = (k: string) => String(form.get(k) ?? '');
	return {
		workingTitle: get('workingTitle'),
		penName: get('penName'),
		seriesTitle: get('seriesTitle'),
		seriesPosition: get('seriesPosition'),
		genre: get('genre'),
		subgenre: get('subgenre'),
		tropes: get('tropes'),
		heatLevel: get('heatLevel'),
		pageCount: get('pageCount'),
		wordCount: get('wordCount'),
		releaseDate: get('releaseDate'),
		stage: get('stage')
	};
}

export const EMPTY_TITLE_FORM: TitleFormValues = {
	workingTitle: '',
	penName: '',
	seriesTitle: '',
	seriesPosition: '',
	genre: '',
	subgenre: '',
	tropes: '',
	heatLevel: '',
	pageCount: '',
	wordCount: '',
	releaseDate: '',
	stage: 'metadata'
};
