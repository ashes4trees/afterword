<script lang="ts">
	import BookTabs from '$lib/components/BookTabs.svelte';
	import DecisionForm from '$lib/components/DecisionForm.svelte';
	import DecisionLog from '$lib/components/DecisionLog.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let { data, form } = $props();
</script>

<PageHeader title={data.book.title} />
<BookTabs id={data.book.id} />

<p class="mt-4 text-fg-muted">
	The calls you've made about this book, newest first, like enrolling in KDP Select or changing
	price. A new decision replaces the old one, which stays as history.
</p>
<DecisionLog decisions={data.decisions} today={data.today} showBook={false} />
<DecisionForm error={form?.decisionError ?? null} />
