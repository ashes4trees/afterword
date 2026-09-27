/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	test: {
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			// Where a bug costs an author money (spec §3): the pure engine and the report parsers.
			include: ['src/lib/server/engine/**', 'src/lib/server/import/**'],
			exclude: ['**/*.test.ts']
		}
	}
});
