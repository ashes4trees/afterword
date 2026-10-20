<script lang="ts">
	import BookForm from '$lib/components/BookForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StorePicker from '$lib/components/StorePicker.svelte';

	let { data, form } = $props();
</script>

<PageHeader title="Add a book" />

<BookForm
	values={form?.values ?? data.initial}
	errors={form?.errors}
	options={data.options}
	submitLabel="Add book"
>
	{#snippet extra({ penName })}
		<StorePicker
			{penName}
			defaults={data.stores.defaults}
			history={data.stores.history}
			chosen={form?.stores ?? null}
		/>
	{/snippet}
</BookForm>
