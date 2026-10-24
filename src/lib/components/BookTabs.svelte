<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { id }: { id: string } = $props();

	// Compared by route id: resolve() can return relative paths during server rendering.
	const tabs = $derived([
		{ route: '/books/[id]', href: resolve('/books/[id]', { id }), label: 'Details' },
		{
			route: '/books/[id]/timeline',
			href: resolve('/books/[id]/timeline', { id }),
			label: 'Launch timeline'
		},
		{
			route: '/books/[id]/decisions',
			href: resolve('/books/[id]/decisions', { id }),
			label: 'Decisions'
		}
	]);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- every href is built with resolve() -->
<nav aria-label="Book sections" class="mt-4 flex gap-1 border-b border-border">
	{#each tabs as tab (tab.route)}
		<a
			href={tab.href}
			aria-current={page.route.id === tab.route ? 'page' : undefined}
			class="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-fg-muted hover:text-fg aria-[current=page]:border-accent aria-[current=page]:font-medium aria-[current=page]:text-fg"
		>
			{tab.label}
		</a>
	{/each}
</nav>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
