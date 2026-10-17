import { z } from 'zod';
import { CHANNEL_SLUGS } from './channels';

// Author-tunable configuration (spec §2 invariant 4, §5). Stored sparse in
// authors.preferences: only the keys the author has set. Defaults resolve at read
// time, so changing a default here applies to every account that hasn't set that key.

const unique = <T>(xs: T[]) => new Set(xs).size === xs.length;

export const preferenceFields = {
	/** Target ad spend ÷ attributed sales. Above 1 is allowed: KU authors often accept it for read-through. */
	target_acos: z.number().gt(0).max(5),
	/** Days a campaign must run before it can be judged. */
	min_ad_eval_days: z.int().min(1).max(365),
	/** Spend a campaign must reach before it can be judged, in `currency` minor units. */
	min_ad_eval_spend_minor: z.int().min(0),
	/** ISO 4217 code for thresholds and display. Amounts are never converted. */
	currency: z.string().regex(/^[A-Z]{3}$/, 'expected an ISO 4217 code such as USD'),
	/** ISO 3166-1 alpha-2 countries the author sells in. */
	marketplaces: z
		.array(z.string().regex(/^[A-Z]{2}$/, 'expected a country code such as US'))
		.min(1)
		.refine(unique, 'duplicate marketplace'),
	/** Channels a new title gets listings for. */
	default_channels: z.array(z.enum(CHANNEL_SLUGS)).refine(unique, 'duplicate channel'),
	/** Stores left out of the listing matrix. At least one store always stays visible. */
	hidden_channels: z
		.array(z.enum(CHANNEL_SLUGS))
		.max(CHANNEL_SLUGS.length - 1, 'Keep at least one store visible')
		.refine(unique, 'duplicate channel'),
	/** Share of scheduled posts that are promotional, 0–1. */
	cadence_ratio: z.number().min(0).max(1)
};

export const PreferencesSchema = z.strictObject(preferenceFields);
export type Preferences = z.infer<typeof PreferencesSchema>;
export type PreferenceKey = keyof Preferences;

const PREFERENCE_KEYS = Object.keys(preferenceFields) as PreferenceKey[];

export const DEFAULT_PREFERENCES: Readonly<Preferences> = Object.freeze({
	target_acos: 0.7,
	min_ad_eval_days: 30,
	min_ad_eval_spend_minor: 5000,
	currency: 'USD',
	marketplaces: ['US'],
	default_channels: [],
	hidden_channels: [],
	cadence_ratio: 0.2
});

type PatchShape<S extends Record<string, z.ZodType>> = {
	[K in keyof S]: z.ZodOptional<z.ZodNullable<S[K]>>;
};

/** A write. Each key is a new value, `null` to reset it to the default, or absent to leave it. */
export const PreferencesPatchSchema = z.strictObject(
	Object.fromEntries(
		Object.entries(preferenceFields).map(([k, s]) => [k, s.nullable().optional()])
	) as PatchShape<typeof preferenceFields>
);
export type PreferencesPatch = z.infer<typeof PreferencesPatchSchema>;

/**
 * Stored jsonb → full preferences. Each key is validated on its own: a stored value
 * that no longer validates falls back to its default and is reported in `invalid`,
 * rather than discarding the author's other settings. Unknown keys are ignored.
 */
export function resolvePreferences(stored: unknown): {
	preferences: Preferences;
	invalid: PreferenceKey[];
} {
	const raw: Record<string, unknown> =
		typeof stored === 'object' && stored !== null && !Array.isArray(stored)
			? (stored as Record<string, unknown>)
			: {};
	const preferences = structuredClone(DEFAULT_PREFERENCES) as Record<string, unknown>;
	const invalid: PreferenceKey[] = [];

	for (const key of PREFERENCE_KEYS) {
		if (!(key in raw)) continue;
		const parsed = preferenceFields[key].safeParse(raw[key]);
		if (parsed.success) preferences[key] = parsed.data;
		else invalid.push(key);
	}

	return { preferences: preferences as Preferences, invalid };
}
