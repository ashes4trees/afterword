import { localToday } from '$lib/shared/bookList';
import { parseRules } from './rules';

// Every rule in content/rules, bundled at build time and validated when this module first
// loads. hooks.server.ts imports it, so a bad rule stops the server from starting (#18).

const files = import.meta.glob('/content/rules/*.{yaml,yml}', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

export const RULES = parseRules(files, localToday());
