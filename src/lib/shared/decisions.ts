import { z } from 'zod';

// The decision log (#26): labels and the form for logging a decision by hand.

export const DECISION_KINDS = ['enrollment', 'pricing', 'distribution', 'promo', 'ads'] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

export const KIND_LABELS: Record<DecisionKind, string> = {
	enrollment: 'Exclusivity',
	pricing: 'Pricing',
	distribution: 'Where to sell',
	promo: 'Promotion',
	ads: 'Ads'
};

export const SOURCE_LABELS = { author: 'You', engine: 'Afterword', agent: 'Assistant' } as const;

/** A decision logged by hand: short, bounded text only (C2). */
export const DecisionInputSchema = z.object({
	kind: z.enum(DECISION_KINDS),
	choice: z
		.string()
		.trim()
		.min(1, 'Say what you decided.')
		.max(200, 'Keep it under 200 characters.'),
	rationale: z
		.string()
		.trim()
		.max(500, 'Keep the reason under 500 characters.')
		.transform((s) => s || null),
	commitsUntil: z.union([z.iso.date(), z.literal('')]).transform((s) => s || null)
});
export type DecisionInput = z.output<typeof DecisionInputSchema>;

/** "term_end" → "Term end", for showing a decision's assumptions. */
export const assumptionLabel = (key: string) =>
	key.charAt(0).toUpperCase() + key.slice(1).replaceAll('_', ' ');
