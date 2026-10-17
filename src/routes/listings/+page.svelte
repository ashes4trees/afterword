<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusIcon from '$lib/components/StatusIcon.svelte';
	import StatusPicker from '$lib/components/StatusPicker.svelte';
	import {
		bookFilterFields,
		isFiltered,
		matchesBook,
		parseBookFilter
	} from '$lib/shared/bookFilter';
	import { organizeBooks } from '$lib/shared/bookList';
	import { CHANNELS } from '$lib/shared/channels';
	import { formatDate } from '$lib/shared/dates';
	import {
		LISTING_STATUSES,
		STATUS_META,
		matrixCells,
		matrixChannels,
		selectObligation,
		statusCounts,
		type MatrixCell
	} from '$lib/shared/listings';
	import { withQuery } from '$lib/shared/query';
	import { STAGE_LABELS } from '$lib/shared/titles';

	let { data, form } = $props();

	const showAll = $derived(page.url.searchParams.get('stores') === 'all');
	const channels = $derived(
		matrixChannels([...CHANNELS], data.listings, data.defaultChannels, showAll)
	);
	const hiddenStores = $derived(CHANNELS.length - channels.length);

	const filter = $derived(parseBookFilter(page.url.searchParams));
	const visible = $derived(data.books.filter((b) => matchesBook(b, filter)));
	const groups = $derived(organizeBooks(visible, 'series', true));
	const hasSeries = $derived(data.books.some((b) => b.seriesId));
	const rows = $derived(
		groups.map((g) => ({
			...g,
			books: g.books.map((book) => ({ book, cells: matrixCells(book.id, channels, data.listings) }))
		}))
	);
	const counts = $derived(statusCounts(rows.flatMap((g) => g.books.flatMap((r) => r.cells))));

	const storesHref = $derived(
		withQuery(resolve('/listings'), page.url.searchParams, { stores: showAll ? null : 'all' })
	);
	const cellHref = (titleId: string, channel: string) =>
		resolve('/listings/[titleId]/[channel]', { titleId, channel });

	// Quick edit: with JavaScript, a cell opens this dialog instead of the listing page.
	let dialog: HTMLDialogElement | undefined = $state();
	let editing: { bookId: string; bookTitle: string; cell: MatrixCell } | null = $state(null);

	function open(e: MouseEvent, bookId: string, bookTitle: string, cell: MatrixCell) {
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		e.preventDefault();
		editing = { bookId, bookTitle, cell };
		dialog?.showModal();
	}

	const cellLabel = (bookTitle: string, cell: MatrixCell) =>
		`${bookTitle} on ${cell.channel.displayName}: ${STATUS_META[cell.status].label}`;
</script>

{#snippet obligations(cell: MatrixCell)}
	{@const select = selectObligation(cell.listing)}
	{#if select}
		<span class="block text-xs text-fg-muted">
			Select{select.until ? ` · until ${formatDate(select.until, 'short')}` : ''}
		</span>
	{/if}
	{#if cell.extraMarkets > 0}
		<span class="block text-xs text-fg-muted">
			+{cell.extraMarkets}
			{cell.extraMarkets === 1 ? 'market' : 'markets'}
		</span>
	{/if}
{/snippet}

{#snippet bookMeta(book: (typeof data.books)[number])}
	<span class="block text-xs text-fg-muted">
		{[STAGE_LABELS[book.stage], book.releaseDate && formatDate(book.releaseDate)]
			.filter(Boolean)
			.join(' · ')}
	</span>
{/snippet}

<PageHeader title="Listings">
	Every book on every store, so nothing slips.
	{#snippet actions()}
		{#if data.listings.length > 0}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- built on resolve() -->
			<a
				href={storesHref}
				class="rounded-md px-3 py-2 text-sm font-medium text-accent hover:bg-surface-2"
			>
				{showAll ? 'Show my stores' : `Show all stores${hiddenStores ? ` (+${hiddenStores})` : ''}`}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
	{/snippet}
</PageHeader>

{#if data.books.length === 0}
	<EmptyState title="No books yet">
		This grid shows every book against every store, so you can see at a glance that Book 3 is in
		preorder on KDP, live on Kobo, and not yet submitted to IngramSpark. Add a book to start.
		{#snippet action()}
			<a
				href={resolve('/books/new')}
				class="inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90"
				>Add a book</a
			>
		{/snippet}
	</EmptyState>
{:else}
	<FilterBar
		base={resolve('/listings')}
		fields={bookFilterFields(data.books)}
		shown={visible.length}
		total={data.books.length}
		noun={{ one: 'book', many: 'books' }}
		searchLabel="Search titles, series, tropes"
	/>

	{#if form?.listingError}
		<p class="mt-4 text-sm text-danger" role="alert">{form.listingError}</p>
	{/if}

	<!-- Legend, doubling as a count of what's in view. -->
	<ul class="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Status key">
		{#each ['none', ...LISTING_STATUSES] as const as status (status)}
			<li class="flex items-center gap-1.5 text-fg-muted">
				<StatusIcon {status} class="size-4" />
				{STATUS_META[status].label}
				<span class="tabular-nums">{counts[status]}</span>
			</li>
		{/each}
	</ul>

	{#if data.listings.length === 0}
		<p class="mt-4 text-sm text-fg-muted">Click any cell to start tracking a book on that store.</p>
	{/if}

	{#if visible.length === 0 && isFiltered(filter)}
		<EmptyState title="No books match">Nothing matches your search and filters.</EmptyState>
	{:else}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- cellHref uses resolve() -->

		<!-- Wide screens: the grid. Only this box scrolls sideways, never the page. -->
		<div class="mt-4 hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class="border-b border-border">
						<th
							scope="col"
							class="sticky left-0 z-10 min-w-56 bg-surface px-4 py-3 text-left font-medium"
						>
							Book
						</th>
						{#each channels as channel (channel.slug)}
							<th scope="col" class="min-w-32 px-3 py-3 text-left font-medium">
								{channel.displayName}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each rows as group (group.seriesId ?? 'standalone')}
						{#if hasSeries}
							<tr class="bg-surface-2">
								<th
									scope="colgroup"
									colspan={channels.length + 1}
									class="sticky left-0 px-4 py-2 text-left font-display text-base font-normal"
								>
									{group.seriesTitle ?? 'Standalones'}
								</th>
							</tr>
						{/if}
						{#each group.books as { book, cells } (book.id)}
							<tr class="border-t border-border">
								<th
									scope="row"
									class="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-normal"
								>
									<a
										href={resolve('/books/[id]', { id: book.id })}
										class="font-medium hover:underline"
									>
										{#if book.seriesPosition !== null}<span
												class="mr-1.5 text-fg-muted tabular-nums">{book.seriesPosition}</span
											>{/if}{book.workingTitle}
									</a>
									{@render bookMeta(book)}
								</th>
								{#each cells as cell (cell.channel.slug)}
									<td class="p-1">
										<a
											href={cellHref(book.id, cell.channel.slug)}
											onclick={(e) => open(e, book.id, book.workingTitle, cell)}
											aria-label={cellLabel(book.workingTitle, cell)}
											class="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-surface-2"
										>
											<StatusIcon status={cell.status} />
											<span>
												<span class={cell.status === 'none' ? 'text-fg-muted/70' : 'font-medium'}>
													{STATUS_META[cell.status].label}
												</span>
												{@render obligations(cell)}
											</span>
										</a>
									</td>
								{/each}
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Narrow screens: one card per book. -->
		<div class="mt-4 space-y-6 md:hidden">
			{#each rows as group (group.seriesId ?? 'standalone')}
				<section aria-label={group.seriesTitle ?? 'Standalones'}>
					{#if hasSeries}
						<h2 class="mb-2 font-display text-heading">{group.seriesTitle ?? 'Standalones'}</h2>
					{/if}
					<div class="space-y-3">
						{#each group.books as { book, cells } (book.id)}
							<article class="rounded-lg border border-border bg-surface">
								<header class="border-b border-border px-4 py-3">
									<a
										href={resolve('/books/[id]', { id: book.id })}
										class="font-medium hover:underline"
									>
										{#if book.seriesPosition !== null}<span
												class="mr-1.5 text-fg-muted tabular-nums">{book.seriesPosition}</span
											>{/if}{book.workingTitle}
									</a>
									{@render bookMeta(book)}
								</header>
								<ul class="divide-y divide-border">
									{#each cells as cell (cell.channel.slug)}
										<li>
											<a
												href={cellHref(book.id, cell.channel.slug)}
												onclick={(e) => open(e, book.id, book.workingTitle, cell)}
												aria-label={cellLabel(book.workingTitle, cell)}
												class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"
											>
												<span class="min-w-0 flex-1 truncate">{cell.channel.displayName}</span>
												<span class="text-right">
													<span class="flex items-center justify-end gap-1.5">
														<StatusIcon status={cell.status} class="size-4" />
														<span
															class={cell.status === 'none'
																? 'text-sm text-fg-muted/70'
																: 'text-sm font-medium'}
														>
															{STATUS_META[cell.status].label}
														</span>
													</span>
													{@render obligations(cell)}
												</span>
											</a>
										</li>
									{/each}
								</ul>
							</article>
						{/each}
					</div>
				</section>
			{/each}
		</div>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/if}
{/if}

<dialog
	bind:this={dialog}
	onclose={() => (editing = null)}
	onclick={(e) => e.target === dialog && dialog?.close()}
	class="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-0 text-fg backdrop:bg-black/50"
>
	{#if editing}
		<div class="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
			<div>
				<h2 class="font-display text-heading">{editing.bookTitle}</h2>
				<p class="text-sm text-fg-muted">{editing.cell.channel.displayName}</p>
			</div>
			<button
				type="button"
				onclick={() => dialog?.close()}
				aria-label="Close"
				class="-mr-2 rounded-md px-2 py-1 text-fg-muted hover:bg-surface-2 hover:text-fg">×</button
			>
		</div>
		<div class="px-5 py-4">
			<StatusPicker
				action="?"
				titleId={editing.bookId}
				bookTitle={editing.bookTitle}
				channel={editing.cell.channel}
				current={editing.cell.status}
				onDone={() => dialog?.close()}
			/>
		</div>
	{/if}
</dialog>
