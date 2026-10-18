<script lang="ts">
	import { enhance } from '$app/forms';
	import BookForm from '$lib/components/BookForm.svelte';
	import BookTabs from '$lib/components/BookTabs.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { confirmDeleteBook } from '$lib/components/confirmDelete';

	let { data, form } = $props();
</script>

<PageHeader title={data.title} />
<BookTabs id={data.id} />

<!-- A fresh form per book, so moving between books never carries one book's state into another. -->
{#key data.id}
	<BookForm
		values={form?.values ?? data.values}
		errors={form?.errors}
		options={data.options}
		action="?/save"
		submitLabel="Save changes"
	/>
{/key}

<form
	method="POST"
	action="?/delete"
	class="mt-10 border-t border-border pt-6"
	use:enhance={({ cancel }) => {
		if (!confirmDeleteBook(data.title)) cancel();
	}}
>
	<button
		type="submit"
		class="rounded-md px-3 py-2 text-sm font-medium text-danger hover:bg-surface-2"
	>
		Delete this book
	</button>
</form>
