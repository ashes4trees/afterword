<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
</script>

<PageHeader title="Books" />

<EmptyState title="No books yet">
	Each book you're publishing or have published lives here, with its pen name, series, and stage
	from metadata to backlist. We ask about your book, not for your book: genre, tropes, and page
	count, never the manuscript.
</EmptyState>
