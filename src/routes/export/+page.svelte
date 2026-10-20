<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';

	const button =
		'inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90';
	const secondary =
		'inline-block rounded-md border border-border px-4 py-2 font-medium hover:bg-surface-2';
</script>

<PageHeader title="Export your data" />

<div class="mt-6 max-w-2xl space-y-4">
	<p>
		Everything you've put into Afterword is yours to take, any time: your books, pen names and
		series, listings, decisions, timelines and tasks, your own ideas, and your settings.
	</p>
	<div class="flex flex-wrap gap-3">
		<!-- eslint-disable svelte/no-navigation-without-resolve -- built on resolve() -->
		<a href={resolve('/export/json')} download class={button}>Download everything (JSON)</a>
		<a href={resolve('/export/zip')} download class={secondary}>Spreadsheets (CSV, zipped)</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>
	<p class="text-sm text-fg-muted">
		The JSON file is the complete copy, enough to rebuild your account. The zip holds the same data
		as one CSV per table, for opening in a spreadsheet, plus the JSON file.
	</p>
</div>
