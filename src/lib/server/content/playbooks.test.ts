import { describe, expect, it } from 'vitest';

// The real packs in content/playbooks. Importing the loader validates them, so a bad pack
// fails CI here as well as stopping the server at boot.
describe('content/playbooks', () => {
	it('loads and validates every pack', async () => {
		const { PLAYBOOKS } = await import('./playbooks');
		expect(Array.isArray(PLAYBOOKS)).toBe(true);
	});
});
