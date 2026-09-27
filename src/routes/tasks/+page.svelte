<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
</script>

<PageHeader title="Tasks" />

<EmptyState title="No tasks yet">
	Each store's setup steps, turned into a checklist for each book, with the date the advice was last
	checked. Tasks appear once a book has listings.
</EmptyState>
