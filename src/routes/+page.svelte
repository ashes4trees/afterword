<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { resolve } from '$app/paths';
</script>

<PageHeader title="Home" />

<EmptyState title="Nothing needs you yet">
	This page collects what needs your attention across every book: tasks coming due, exclusivity
	terms about to renew, and ad campaigns that have run long enough to judge.
	{#snippet action()}
		<a
			href={resolve('/books')}
			class="inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90"
		>
			Go to Books
		</a>
	{/snippet}
</EmptyState>
