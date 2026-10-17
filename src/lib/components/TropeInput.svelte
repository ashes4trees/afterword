<script lang="ts">
	// Tropes as removable chips, with suggestions from the author's other books. Submits
	// a comma-separated `tropes` field, plus `tropesDraft` for anything typed but not yet
	// added, so nothing typed is lost and the form still works without JavaScript.
	let {
		value,
		suggestions,
		invalid = false,
		describedBy,
		max = 20,
		maxLength = 60
	}: {
		value: string;
		suggestions: string[];
		invalid?: boolean;
		describedBy?: string;
		max?: number;
		maxLength?: number;
	} = $props();

	const split = (v: string) =>
		v
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);

	// svelte-ignore state_referenced_locally
	let chips = $state(split(value));
	let draft = $state('');

	const chosen = $derived(new Set(chips.map((t) => t.toLowerCase())));
	const available = $derived(suggestions.filter((s) => !chosen.has(s.toLowerCase())));
	const full = $derived(chips.length >= max);

	function add(text: string) {
		for (const raw of split(text)) {
			if (chips.length >= max) break;
			const key = raw.toLowerCase();
			if (chosen.has(key)) continue;
			// Reuse the author's existing spelling so one trope never splits into two.
			chips.push(suggestions.find((s) => s.toLowerCase() === key) ?? raw.slice(0, maxLength));
		}
		draft = '';
	}

	function onkeydown(e: KeyboardEvent) {
		if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
			e.preventDefault();
			add(draft);
		} else if (e.key === 'Backspace' && !draft && chips.length > 0) {
			chips.pop();
		}
	}

	function oninput(e: Event) {
		// Picking from the suggestion list replaces the text in one step rather than
		// typing it; add the chip straight away.
		const type = (e as InputEvent).inputType;
		if (type !== 'insertText' && type !== 'deleteContentBackward' && suggestions.includes(draft)) {
			add(draft);
		} else if (draft.includes(',')) {
			add(draft);
		}
	}

	const chipClass =
		'inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pr-1 pl-2.5 text-sm';
</script>

<input type="hidden" name="tropes" value={chips.join(', ')} />

<div
	class={[
		'mt-1 flex flex-wrap items-center gap-1.5 rounded-md border bg-surface px-2 py-1.5',
		invalid ? 'border-danger' : 'border-border'
	]}
>
	{#if chips.length > 0}
		<ul class="contents" aria-label="Tropes added">
			{#each chips as trope, i (trope.toLowerCase())}
				<li class={chipClass}>
					{trope}
					<button
						type="button"
						onclick={() => chips.splice(i, 1)}
						aria-label="Remove {trope}"
						class="rounded-full px-1 text-fg-muted hover:bg-border hover:text-fg"
					>
						×
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	<input
		id="tropes-input"
		name="tropesDraft"
		list="trope-suggestions"
		bind:value={draft}
		{onkeydown}
		{oninput}
		onblur={() => draft.trim() && add(draft)}
		disabled={full}
		maxlength={maxLength}
		autocomplete="off"
		aria-invalid={invalid}
		aria-describedby={describedBy}
		placeholder={full ? 'Limit reached' : chips.length ? 'Add another' : 'enemies to lovers'}
		class="min-w-32 flex-1 bg-transparent px-1 py-0.5 text-fg outline-none placeholder:text-fg-muted/70"
	/>
	<datalist id="trope-suggestions">
		{#each available as s (s)}<option value={s}></option>{/each}
	</datalist>
</div>
