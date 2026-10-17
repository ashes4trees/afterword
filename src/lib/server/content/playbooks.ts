import { localToday } from '$lib/shared/bookList';
import { parsePlaybooks } from './schema';

// Every pack in content/playbooks, bundled at build time so the server never reads the
// filesystem for them. Validated when this module first loads; hooks.server.ts imports it
// so a bad pack stops the server from starting rather than surfacing on some later page.

const files = import.meta.glob('/content/playbooks/**/*.{yaml,yml}', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

export const PLAYBOOKS = parsePlaybooks(files, localToday());
