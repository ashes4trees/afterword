<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children?: Snippet } = $props();
</script>

<svelte:head><title>{title} · Afterword</title></svelte:head>

<header>
	<h1 class="font-display text-title">{title}</h1>
	{#if children}
		<p class="mt-1 text-fg-muted">{@render children()}</p>
	{/if}
</header>
