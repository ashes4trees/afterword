import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Invariant 1 (spec §2, §4): engine/ is pure. No database, no network, no
		// framework runtime. This is what keeps AI optional and rules testable offline.
		files: ['src/lib/server/engine/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							regex: '(^|/)server/(db|repo|services|agent)(/|$)',
							message: 'engine/ must stay pure: no persistence, services, or agent imports.'
						},
						{
							regex: '^(\\.\\./)+(db|repo|services|agent)(/|$)',
							message: 'engine/ must stay pure: no persistence, services, or agent imports.'
						},
						{
							regex: '^(drizzle-orm|postgres|pg)(/|$)',
							message: 'engine/ must not touch the database.'
						},
						{
							regex:
								'^(node:)?(http|https|http2|net|tls|dgram)$|^(undici|axios|node-fetch|ky|got|@anthropic-ai/sdk)(/|$)',
							message: 'engine/ must not make network calls.'
						},
						{
							regex: '^\\$(app|env)/',
							message:
								'engine/ must not depend on SvelteKit runtime or environment; take inputs as arguments.'
						}
					]
				}
			],
			'no-restricted-globals': [
				'error',
				{ name: 'fetch', message: 'engine/ must not make network calls.' },
				{ name: 'XMLHttpRequest', message: 'engine/ must not make network calls.' },
				{ name: 'WebSocket', message: 'engine/ must not make network calls.' }
			]
		}
	}
);
