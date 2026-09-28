<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children, actions }: { title: string; children?: Snippet; actions?: Snippet } =
		$props();
</script>

<svelte:head><title>{title} · Afterword</title></svelte:head>

<header class="flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="font-display text-title">{title}</h1>
		{#if children}
			<p class="mt-1 text-fg-muted">{@render children()}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex gap-2">{@render actions()}</div>
	{/if}
</header>
