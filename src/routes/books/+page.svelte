<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { STAGE_LABELS } from '$lib/shared/titles';

	let { data } = $props();

	// Dates are calendar dates, so format in UTC to avoid shifting a day.
	const formatDate = (d: string) =>
		new Date(`${d}T00:00:00Z`).toLocaleDateString('en', { timeZone: 'UTC', dateStyle: 'medium' });

	const addButton =
		'inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90';
</script>

<PageHeader title="Books">
	{#snippet actions()}
		{#if data.books.length > 0}
			<a href={resolve('/books/new')} class={addButton}>Add book</a>
		{/if}
	{/snippet}
</PageHeader>

{#if data.books.length === 0}
	<EmptyState title="No books yet">
		Each book you're publishing or have published lives here, with its pen name, series, and stage
		from metadata to backlist. We ask about your book, not for your book: genre, tropes, and page
		count, never the manuscript.
		{#snippet action()}
			<a href={resolve('/books/new')} class={addButton}>Add your first book</a>
		{/snippet}
	</EmptyState>
{:else}
	<ul
		class="mt-6 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface"
	>
		{#each data.books as book (book.id)}
			<li>
				<a
					href={resolve('/books/[id]', { id: book.id })}
					class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2"
				>
					<div class="min-w-0 flex-1">
						<p class="truncate font-medium">{book.workingTitle}</p>
						<p class="truncate text-sm text-fg-muted">
							{[
								book.penName,
								book.seriesTitle &&
									(book.seriesPosition
										? `${book.seriesTitle} #${book.seriesPosition}`
										: book.seriesTitle),
								book.genre
							]
								.filter(Boolean)
								.join(' · ') || 'No details yet'}
						</p>
					</div>
					<div class="flex items-center gap-3 text-sm">
						{#if book.releaseDate}
							<span class="text-fg-muted">{formatDate(book.releaseDate)}</span>
						{/if}
						<span class="rounded-full bg-surface-2 px-2.5 py-0.5 font-medium">
							{STAGE_LABELS[book.stage]}
						</span>
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}
