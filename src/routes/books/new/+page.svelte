<script lang="ts">
	import BookForm from '$lib/components/BookForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let { data, form } = $props();
</script>

<PageHeader title="Add a book" />

<BookForm
	values={form?.values ?? data.initial}
	errors={form?.errors}
	options={data.options}
	submitLabel="Add book"
/>
