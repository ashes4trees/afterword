<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusPicker from '$lib/components/StatusPicker.svelte';

	let { data, form } = $props();
</script>

<PageHeader title="{data.book.workingTitle} on {data.channel.displayName}">
	<a href={resolve('/listings')} class="text-accent hover:underline">← All listings</a>
</PageHeader>

{#if form?.listingError}
	<p class="mt-4 text-sm text-danger" role="alert">{form.listingError}</p>
{/if}

<div class="mt-6 max-w-xl rounded-lg border border-border bg-surface p-4">
	<StatusPicker
		action="?"
		titleId={data.book.id}
		bookTitle={data.book.workingTitle}
		channel={data.channel}
		current={data.listing?.status ?? 'none'}
	/>
</div>
