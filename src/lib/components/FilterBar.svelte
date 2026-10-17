<script lang="ts">
	// Search plus dropdown filters for a list page (#64). Every value lives in the URL,
	// so refresh, Back, and shared links keep it. Without JavaScript it's a plain GET
	// form with an Apply button; with JavaScript it updates as you type or choose.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { FilterField } from '$lib/shared/bookFilter';
	import { withQuery } from '$lib/shared/query';

	let {
		base,
		fields,
		shown,
		total,
		noun,
		searchLabel = 'Search'
	}: {
		/** The resolved path of the page being filtered. */
		base: string;
		fields: FilterField[];
		shown: number;
		total: number;
		noun: { one: string; many: string };
		searchLabel?: string;
	} = $props();

	const params = $derived(page.url.searchParams);
	const filterParams = $derived(['q', ...fields.map((f) => f.param)]);
	const active = $derived(filterParams.filter((p) => params.get(p)).length);
	const activeDropdowns = $derived(fields.filter((f) => params.get(f.param)).length);
	const clearHref = $derived(
		withQuery(base, params, Object.fromEntries(filterParams.map((p) => [p, null])))
	);
	/** Params owned by the page (sort, grouping) that a no-JavaScript submit must keep. */
	const kept = $derived([...params].filter(([key]) => !filterParams.includes(key)));

	let mounted = $state(false);
	let showFilters = $state(false);
	let q = $state(page.url.searchParams.get('q') ?? '');
	let timer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		mounted = true;
		showFilters = activeDropdowns > 0;
		return () => clearTimeout(timer);
	});

	// Keep the box in step when the URL changes some other way, such as Back or Clear.
	$effect(() => {
		const fromUrl = params.get('q') ?? '';
		if (document.activeElement?.id !== 'filter-search') q = fromUrl;
	});

	function apply(changes: Record<string, string | null>) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- base is resolved by the page
		goto(withQuery(base, page.url.searchParams, changes), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function onSearchInput() {
		clearTimeout(timer);
		timer = setTimeout(() => apply({ q: q.trim() || null }), 150);
	}

	const control =
		'block w-full rounded-md border border-border bg-surface px-3 py-2 text-fg placeholder:text-fg-muted/70';
</script>

<form
	method="GET"
	action={base}
	role="search"
	class="mt-6"
	onsubmit={(e) => mounted && e.preventDefault()}
>
	{#each kept as [key, value] (key)}
		<input type="hidden" name={key} {value} />
	{/each}

	<div class="flex flex-wrap items-end gap-3">
		<label class="min-w-48 flex-1">
			<span class="sr-only">{searchLabel}</span>
			<input
				id="filter-search"
				name="q"
				type="search"
				bind:value={q}
				oninput={onSearchInput}
				placeholder="{searchLabel}…"
				autocomplete="off"
				class={control}
			/>
		</label>

		{#if mounted && fields.length > 0}
			<button
				type="button"
				onclick={() => (showFilters = !showFilters)}
				aria-expanded={showFilters}
				aria-controls="filter-fields"
				class="rounded-md border border-border px-3 py-2 text-sm font-medium md:hidden"
			>
				Filters{activeDropdowns ? ` (${activeDropdowns})` : ''}
			</button>
		{/if}

		{#if fields.length > 0}
			<div
				id="filter-fields"
				class={[
					'w-full flex-wrap gap-3 md:flex md:w-auto',
					mounted && !showFilters ? 'hidden' : 'flex'
				]}
			>
				{#each fields as field (field.param)}
					<label class="min-w-36 flex-1 md:flex-none">
						<span class="mb-1 block text-sm text-fg-muted">{field.label}</span>
						<select
							name={field.param}
							value={params.get(field.param) ?? ''}
							onchange={(e) => apply({ [field.param]: e.currentTarget.value || null })}
							class={control}
						>
							<option value="">All</option>
							{#each field.options as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>
				{/each}
			</div>
		{/if}

		<noscript>
			<button type="submit" class="rounded-md border border-border px-3 py-2 text-sm font-medium">
				Apply
			</button>
		</noscript>
	</div>

	{#if active > 0}
		<p class="mt-3 text-sm text-fg-muted" aria-live="polite">
			Showing {shown} of {total}
			{total === 1 ? noun.one : noun.many}
			·
			<!-- eslint-disable svelte/no-navigation-without-resolve -- built on the resolved base -->
			<a
				href={clearHref}
				data-sveltekit-replacestate
				class="font-medium text-accent hover:underline">Clear filters</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</p>
	{/if}
</form>
