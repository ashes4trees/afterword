import type { BookFormat } from '$lib/shared/channels';
import type { Playbook } from './schema';

/**
 * Advice for each listing field (#12), from every step in the store's playbooks that names
 * the field: its pitfalls, and how current the advice is. Never written into components.
 */
export function fieldAdvice(
	channel: string,
	format: BookFormat,
	packs: Playbook[]
): Record<string, { gotchas: string[]; asOf: string }> {
	const advice: Record<string, { gotchas: string[]; asOf: string }> = {};
	for (const pack of packs.filter((p) => p.channel === channel)) {
		for (const step of pack.steps) {
			if (step.formats && !step.formats.includes(format)) continue;
			for (const field of step.fields) {
				const entry = (advice[field] ??= { gotchas: [], asOf: pack.as_of });
				entry.gotchas.push(...step.gotchas);
				if (pack.as_of > entry.asOf) entry.asOf = pack.as_of;
			}
		}
	}
	return advice;
}
