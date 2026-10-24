import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { localToday } from '$lib/shared/bookList';

// Defaults for the Select vs wide comparison (#25), as dated, sourced data: never
// constants in code. Validated when this module loads; hooks.server.ts imports it.

const Schema = z.strictObject({
	version: z.int().positive(),
	as_of: z.iso.date(),
	sources: z.array(z.strictObject({ url: z.url(), title: z.string().min(1) })).min(1),
	history_months: z.int().min(1).max(12),
	kenp_rate_per_page_minor: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().positive()),
	ku_readers_who_buy: z.number().min(0).max(1)
});
export type ExclusivityDefaults = z.infer<typeof Schema>;

export function parseExclusivityDefaults(text: string, today: string): ExclusivityDefaults {
	const parsed = Schema.parse(parseYaml(text));
	if (parsed.as_of > today)
		throw new Error(`exclusivity defaults: as_of ${parsed.as_of} is in the future`);
	return parsed;
}

const files = import.meta.glob('/content/assumptions/exclusivity.yaml', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

export const EXCLUSIVITY_DEFAULTS = parseExclusivityDefaults(
	Object.values(files)[0] ?? '',
	localToday()
);
