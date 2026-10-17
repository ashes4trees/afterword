<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { confirmDeleteBook } from '$lib/components/confirmDelete';
	import {
		BOOK_SORTS,
		SORT_LABELS,
		localToday,
		organizeBooks,
		releaseCountdown,
		type BookSort
	} from '$lib/shared/bookList';
	import {
		FILTER_PARAMS,
		bookFilterFields,
		isFiltered,
		matchesBook,
		parseBookFilter
	} from '$lib/shared/bookFilter';
	import { withQuery } from '$lib/shared/query';
	import { STAGE_LABELS } from '$lib/shared/titles';

	let { data, form } = $props();

	// View settings live in the URL, so refresh and back keep them.
	const sort = $derived<BookSort>(
		(BOOK_SORTS as readonly string[]).includes(page.url.searchParams.get('sort') ?? '')
			? (page.url.searchParams.get('sort') as BookSort)
			: 'series'
	);
	const grouped = $derived(page.url.searchParams.get('group') !== 'none');
	const filter = $derived(parseBookFilter(page.url.searchParams));
	const visible = $derived(data.books.filter((b) => matchesBook(b, filter)));
	const fields = $derived(bookFilterFields(data.books));
	const groups = $derived(organizeBooks(visible, sort, grouped));
	const hasSeries = $derived(data.books.some((b) => b.seriesId));
	const today = localToday();

	// Sort and grouping links keep any search and filters, and vice versa.
	function viewHref(change: { sort?: BookSort; grouped?: boolean }) {
		const s = change.sort ?? sort;
		const g = change.grouped ?? grouped;
		return withQuery(resolve('/books'), page.url.searchParams, {
			sort: s === 'series' ? null : s,
			group: g ? null : 'none'
		});
	}

	const clearFiltersHref = $derived(
		withQuery(
			resolve('/books'),
			page.url.searchParams,
			Object.fromEntries(FILTER_PARAMS.map((p) => [p, null]))
		)
	);

	const addToSeriesHref = (seriesTitle: string) =>
		`${resolve('/books/new')}?series=${encodeURIComponent(seriesTitle)}`;

	// Dates are calendar dates, so format in UTC to avoid shifting a day.
	const formatDate = (d: string) =>
		new Date(`${d}T00:00:00Z`).toLocaleDateString('en', { timeZone: 'UTC', dateStyle: 'medium' });

	const addButton =
		'inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90';
	const segment =
		'rounded-md px-3 py-1.5 text-sm text-fg-muted hover:text-fg aria-[current=true]:bg-surface aria-[current=true]:font-medium aria-[current=true]:text-fg aria-[current=true]:shadow-sm';
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
	<FilterBar
		base={resolve('/books')}
		{fields}
		shown={visible.length}
		total={data.books.length}
		noun={{ one: 'book', many: 'books' }}
		searchLabel="Search titles, series, tropes"
	/>

	<!-- Always present so screen readers announce the message when it appears. -->
	<p role="status" class="text-sm">
		{#if form?.deleted}
			<span class="mt-4 block">Deleted “{form.deleted}”.</span>
		{:else if form?.deleteError}
			<span class="mt-4 block text-danger">{form.deleteError}</span>
		{/if}
	</p>

	<!-- eslint-disable svelte/no-navigation-without-resolve -- viewHref and addToSeriesHref build on resolve() -->
	<div class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
		<nav aria-label="Sort books" class="flex items-center gap-2">
			<span class="text-sm text-fg-muted">Sort</span>
			<div class="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
				{#each BOOK_SORTS as s (s)}
					<a
						href={viewHref({ sort: s })}
						aria-current={sort === s}
						data-sveltekit-noscroll
						data-sveltekit-replacestate
						class={segment}>{SORT_LABELS[s]}</a
					>
				{/each}
			</div>
		</nav>
		{#if hasSeries}
			<nav aria-label="Group books" class="flex items-center gap-2">
				<span class="text-sm text-fg-muted">Group</span>
				<div class="flex gap-1 rounded-lg bg-surface-2 p-1">
					<a
						href={viewHref({ grouped: true })}
						aria-current={grouped}
						data-sveltekit-noscroll
						data-sveltekit-replacestate
						class={segment}>By series</a
					>
					<a
						href={viewHref({ grouped: false })}
						aria-current={!grouped}
						data-sveltekit-noscroll
						data-sveltekit-replacestate
						class={segment}>None</a
					>
				</div>
			</nav>
		{/if}
	</div>

	{#each groups as group (group.seriesId ?? 'standalone')}
		<section class="mt-8" aria-label={group.seriesTitle ?? (grouped ? 'Standalones' : 'All books')}>
			{#if grouped && hasSeries}
				<header class="mb-3 flex flex-wrap items-end justify-between gap-2">
					<div>
						<h2 class="font-display text-heading">{group.seriesTitle ?? 'Standalones'}</h2>
						<p class="text-sm text-fg-muted">
							{[
								group.penName,
								`${group.books.length} ${group.books.length === 1 ? 'book' : 'books'}`
							]
								.filter(Boolean)
								.join(' · ')}
						</p>
					</div>
					{#if group.seriesTitle}
						<a
							href={addToSeriesHref(group.seriesTitle)}
							class="rounded-md px-2 py-1 text-sm font-medium text-accent hover:bg-surface-2"
						>
							+ Add book to this series
						</a>
					{/if}
				</header>
			{/if}

			<ul class="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
				{#each group.books as book (book.id)}
					<li class="flex items-stretch hover:bg-surface-2">
						<a
							href={resolve('/books/[id]', { id: book.id })}
							class="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 py-3 pl-4"
						>
							{#if grouped && book.seriesPosition !== null}
								<span
									class="w-10 shrink-0 text-center font-display text-heading text-fg-muted"
									aria-label="Book {book.seriesPosition}"
								>
									{book.seriesPosition}
								</span>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">{book.workingTitle}</p>
								<p class="truncate text-sm text-fg-muted">
									{[
										!grouped || !hasSeries ? book.penName : null,
										!grouped &&
											book.seriesTitle &&
											(book.seriesPosition
												? `${book.seriesTitle} #${book.seriesPosition}`
												: book.seriesTitle),
										book.genre,
										book.subgenre
									]
										.filter(Boolean)
										.join(' · ') || 'No details yet'}
								</p>
							</div>
							<div class="flex items-center gap-3 text-sm">
								{#if book.releaseDate}
									<span class="text-right">
										<span class="block text-fg-muted">{formatDate(book.releaseDate)}</span>
										<span class="block text-xs text-fg-muted">
											{releaseCountdown(book.releaseDate, today)}
										</span>
									</span>
								{:else}
									<span class="text-fg-muted">No release date</span>
								{/if}
								<span class="rounded-full bg-surface-2 px-2.5 py-0.5 font-medium">
									{STAGE_LABELS[book.stage]}
								</span>
							</div>
						</a>
						<form
							method="POST"
							action="?/delete"
							class="flex"
							use:enhance={({ cancel }) => {
								if (!confirmDeleteBook(book.workingTitle)) return cancel();
								return async ({ update }) => update({ reset: false });
							}}
						>
							<input type="hidden" name="id" value={book.id} />
							<input type="hidden" name="title" value={book.workingTitle} />
							<button
								type="submit"
								aria-label="Delete {book.workingTitle}"
								title="Delete"
								class="px-3 text-fg-muted hover:text-danger focus-visible:text-danger"
							>
								<svg
									viewBox="0 0 24 24"
									class="size-5"
									fill="none"
									stroke="currentColor"
									stroke-width="1.75"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path
										d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
									/>
								</svg>
							</button>
						</form>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		{#if isFiltered(filter)}
			<EmptyState title="No books match">
				Nothing matches your search and filters.
				{#snippet action()}
					<a href={clearFiltersHref} class={addButton}>Clear filters</a>
				{/snippet}
			</EmptyState>
		{/if}
	{/each}
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{/if}
