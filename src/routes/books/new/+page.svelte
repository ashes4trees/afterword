<script lang="ts">
	import BookForm from '$lib/components/BookForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { EMPTY_TITLE_FORM } from '$lib/shared/titles';

	let { data, form } = $props();
</script>

<PageHeader title="Add a book" />

<BookForm
	values={form?.values ?? EMPTY_TITLE_FORM}
	errors={form?.errors}
	options={data.options}
	submitLabel="Add book"
/>
