<script lang="ts">
	import { resolve } from '$app/paths';
	import CampaignForm from '$lib/components/CampaignForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let { data, form } = $props();
</script>

<PageHeader title="Add a campaign">
	<a href={resolve('/ads')} class="text-accent hover:underline">← All campaigns</a>
</PageHeader>

{#if data.books.length === 0}
	<p class="mt-6 rounded-md bg-surface-2 px-4 py-3 text-sm">
		Campaigns belong to a book.
		<a href={resolve('/books/new')} class="font-medium text-accent hover:underline">Add a book</a> first.
	</p>
{:else}
	<CampaignForm
		values={form?.values ?? data.values}
		errors={form?.errors}
		books={data.books}
		submitLabel="Add campaign"
	/>
{/if}
