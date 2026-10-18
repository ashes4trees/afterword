import { describe, expect, it } from 'vitest';
import { CHANNELS, hasPrintTerms, exclusiveProgram } from '$lib/shared/channels';

// The real packs in content/playbooks. Importing the loader validates them, so a bad pack
// fails CI here as well as stopping the server at boot.
describe('content/playbooks', () => {
	it('loads and validates every pack', async () => {
		const { PLAYBOOKS } = await import('./playbooks');
		expect(Array.isArray(PLAYBOOKS)).toBe(true);
	});

	it('only gives store steps formats the store sells, and fields the editor shows', async () => {
		const { PLAYBOOKS } = await import('./playbooks');
		const problems: string[] = [];
		for (const pack of PLAYBOOKS.filter((p) => p.channel)) {
			const channel = CHANNELS.find((c) => c.slug === pack.channel)!;
			for (const step of pack.steps) {
				const formats = step.formats ?? [...channel.capabilities.formats];
				for (const format of formats) {
					const where = `${pack.channel}/${pack.pack} ${step.id} (${format})`;
					if (!(channel.capabilities.formats as readonly string[]).includes(format)) {
						problems.push(`${where}: store doesn't sell this format`);
						continue;
					}
					for (const field of step.fields) {
						const shown =
							field.startsWith('exclusivity') || field === 'enrolled_in_select'
								? !!exclusiveProgram(channel.slug, format)
								: field === 'wholesale_discount_pct' || field === 'returnable'
									? hasPrintTerms(channel.slug, format)
									: true;
						if (!shown) problems.push(`${where}: the editor has no ${field} field here`);
					}
				}
			}
		}
		expect(problems).toEqual([]);
	});

	it('gives the advice, never its pedigree (brand voice)', async () => {
		const { PLAYBOOKS } = await import('./playbooks');
		const pedigree = /\b(guides?|sources?|experts?|authors?) (say|suggest|recommend)/i;
		const text = PLAYBOOKS.flatMap((p) =>
			p.steps.flatMap((s) => [s.label, s.detail ?? '', ...s.gotchas])
		);
		expect(text.filter((t) => pedigree.test(t))).toEqual([]);
	});
});
