<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { formatDate } from '$lib/shared/dates';

	let { data, form } = $props();

	let uploading = $state(false);
	const summary = $derived(form && 'summary' in form ? form.summary : null);
	const METRIC_LABELS: Record<string, string> = {
		royalty_minor: 'Royalties',
		units: 'Units sold',
		kenp_pages: 'KENP pages read'
	};
	const STATUS: Record<string, string> = {
		parsed: 'Imported',
		failed: "Couldn't read",
		pending: 'Reading…'
	};
</script>

<PageHeader title="Reports" />

<p class="mt-1 max-w-2xl text-fg-muted">
	Upload the royalty reports you download from KDP. Afterword reads the file, keeps the numbers, and
	throws the file away. It never asks for your store logins.
</p>

<section
	class="mt-6 max-w-2xl rounded-lg border border-border bg-surface p-5"
	aria-labelledby="upload"
>
	<h2 id="upload" class="font-display text-heading">Upload a KDP report</h2>
	<p class="mt-1 text-sm text-fg-muted">
		In KDP, open Reports, pick the months you want, and download the report. Upload it here as it
		came. Uploading a newer report for the same days replaces those days, so nothing is counted
		twice.
	</p>
	<form
		method="POST"
		action="?/upload"
		enctype="multipart/form-data"
		class="mt-4 flex flex-wrap items-center gap-3"
		use:enhance={() => {
			uploading = true;
			return async ({ update }) => {
				await update();
				uploading = false;
			};
		}}
	>
		<input
			type="file"
			name="report"
			accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
			required
			class="text-sm"
		/>
		<button
			type="submit"
			disabled={uploading}
			class="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
			>{uploading ? 'Reading…' : 'Upload'}</button
		>
	</form>
	{#if form && 'uploadError' in form}
		<p class="mt-3 text-sm text-danger" role="alert">{form.uploadError}</p>
	{/if}

	{#if summary}
		<div class="mt-4 rounded-md bg-surface-2 p-4 text-sm" role="status">
			<p class="font-medium">Imported {summary.rows.toLocaleString('en')} numbers.</p>
			<ul class="mt-1 text-fg-muted">
				{#each Object.entries(summary.coverage) as [metric, range] (metric)}
					<li>
						{METRIC_LABELS[metric] ?? metric}: {formatDate(range!.from)} to {formatDate(range!.to)}
					</li>
				{/each}
			</ul>
			{#if summary.matched.length}
				<p class="mt-3">Matched to your books: {summary.matched.map((m) => m.title).join(', ')}.</p>
			{/if}
			{#if summary.unmatched.length}
				<p class="mt-3">Not matched yet:</p>
				<ul class="mt-1 list-disc pl-5">
					{#each summary.unmatched as u (u.externalId)}
						<li>{u.title} ({u.format ?? 'book'}, {u.externalId})</li>
					{/each}
				</ul>
				<p class="mt-2 text-fg-muted">
					To link one, add its ID as the Store ID on the book's KDP listing in
					<a href={resolve('/listings')} class="text-accent hover:underline">Listings</a>. Its
					numbers join the book straight away.
				</p>
			{/if}
		</div>
	{/if}
</section>

{#if data.imports.length}
	<section class="mt-8 max-w-2xl" aria-labelledby="history">
		<h2 id="history" class="font-display text-heading">Uploaded</h2>
		<ul class="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
			{#each data.imports as i (i.id)}
				<li class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
					<div class="min-w-0 flex-1">
						<p class="truncate font-medium">{i.filename}</p>
						<p class="text-fg-muted">
							{STATUS[i.status]} · {formatDate(i.createdAt.toISOString().slice(0, 10))}
							{#if i.status === 'parsed'}
								· {i.remaining === i.rowCount
									? `${i.rowCount} numbers`
									: i.remaining === 0
										? 'replaced by a newer upload'
										: `${i.remaining} of ${i.rowCount} numbers, the rest replaced by a newer upload`}
							{/if}
						</p>
						{#if i.error}<p class="text-danger">{i.error}</p>{/if}
					</div>
					<form
						method="POST"
						action="?/delete"
						use:enhance={({ cancel }) => {
							if (!confirm(`Delete “${i.filename}” and the numbers it brought in?`)) cancel();
						}}
					>
						<input type="hidden" name="id" value={i.id} />
						<button type="submit" class="text-fg-muted hover:text-fg hover:underline">Delete</button
						>
					</form>
				</li>
			{/each}
		</ul>
	</section>
{/if}
