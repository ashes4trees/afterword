<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
</script>

<PageHeader title="Listings" />

<EmptyState title="No listings yet">
	One grid of every book against every store, so you can see at a glance that Book 3 is in preorder
	on KDP, live on Kobo, and not yet submitted to IngramSpark. Listings appear here once you add a
	book.
</EmptyState>
