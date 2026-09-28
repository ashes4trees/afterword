<script lang="ts">
	import { enhance } from '$app/forms';
	import BookForm from '$lib/components/BookForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let { data, form } = $props();
</script>

<PageHeader title={data.title} />

<BookForm
	values={form?.values ?? data.values}
	errors={form?.errors}
	options={data.options}
	action="?/save"
	submitLabel="Save changes"
/>

<form
	method="POST"
	action="?/delete"
	class="mt-10 border-t border-border pt-6"
	use:enhance={({ cancel }) => {
		if (!confirm(`Delete “${data.title}”? This can't be undone.`)) cancel();
	}}
>
	<button
		type="submit"
		class="rounded-md px-3 py-2 text-sm font-medium text-danger hover:bg-surface-2"
	>
		Delete this book
	</button>
</form>
