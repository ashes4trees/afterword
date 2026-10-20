<script lang="ts">
	import { CHANNELS } from '$lib/shared/channels';
	import {
		describeSuggestion,
		suggestStores,
		type StoreHistory
	} from '$lib/shared/storeSuggestion';

	// Stores for a new book (#41), ticked from the author's history until they change one.
	// Nothing is created until they save the book.

	let {
		penName,
		defaults,
		history,
		chosen = null
	}: {
		penName: string;
		defaults: string[] | null;
		history: StoreHistory;
		/** Their own choice, kept after a failed save. */
		chosen?: string[] | null;
	} = $props();

	const suggestion = $derived(suggestStores({ defaults, penName: penName || null, history }));
	// svelte-ignore state_referenced_locally
	let manual = $state<string[] | null>(chosen);
	const selected = $derived(manual ?? suggestion.stores);
	const hint = $derived(manual ? null : describeSuggestion(suggestion.source));

	function toggle(slug: string, on: boolean) {
		manual = CHANNELS.map((c) => c.slug).filter((s) => (s === slug ? on : selected.includes(s)));
	}
</script>

<fieldset class="rounded-lg border border-border bg-surface p-4">
	<legend class="px-1 font-display text-heading">Stores</legend>
	<p class="text-sm text-fg-muted">
		Where you plan to sell it. Each one gets a "Not started" listing for the formats it sells, and
		you can change them any time on Listings.
		{#if hint}<span class="font-medium text-fg">{hint}.</span>{/if}
	</p>
	<div class="mt-3 grid gap-2 sm:grid-cols-2">
		{#each CHANNELS as c (c.slug)}
			<label class="flex items-center gap-2">
				<input
					type="checkbox"
					name="stores"
					value={c.slug}
					checked={selected.includes(c.slug)}
					onchange={(e) => toggle(c.slug, e.currentTarget.checked)}
					class="size-4 accent-(--color-accent)"
				/>
				{c.displayName}
			</label>
		{/each}
	</div>
	<label class="mt-3 flex items-center gap-2 text-sm">
		<input type="checkbox" name="saveDefaultStores" class="size-4 accent-(--color-accent)" />
		Start every new book with these stores
	</label>
</fieldset>
