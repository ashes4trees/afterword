<script lang="ts">
	import type { Snippet } from 'svelte';

	// An empty section explains what it's for, never just a blank panel (#5).
	let { title, children, action }: { title: string; children: Snippet; action?: Snippet } =
		$props();
</script>

<section
	class="mt-6 rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center"
>
	<h2 class="font-display text-heading">{title}</h2>
	<div class="mx-auto mt-2 max-w-prose text-fg-muted">{@render children()}</div>
	{#if action}
		<div class="mt-6">{@render action()}</div>
	{/if}
</section>
