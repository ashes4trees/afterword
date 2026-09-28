<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		CONTENT_RATINGS,
		STAGE_LABELS,
		TITLE_STAGES,
		type TitleFormValues
	} from '$lib/shared/titles';

	type Options = { penNames: string[]; series: { title: string; penName: string | null }[] };

	let {
		values,
		errors = {},
		options,
		action,
		submitLabel
	}: {
		values: TitleFormValues;
		errors?: Partial<Record<keyof TitleFormValues, string[]>>;
		options: Options;
		action?: string;
		submitLabel: string;
	} = $props();

	// svelte-ignore state_referenced_locally
	let penName = $state(values.penName);
	// svelte-ignore state_referenced_locally
	let seriesTitle = $state(values.seriesTitle);
	let saving = $state(false);

	const series = $derived(
		options.series.find((s) => s.title.toLowerCase() === seriesTitle.trim().toLowerCase())
	);
	const seriesPenNote = $derived.by(() => {
		if (!series?.penName) return null;
		if (!penName.trim()) return `Will use this series' pen name, ${series.penName}.`;
		if (penName.trim().toLowerCase() !== series.penName.toLowerCase()) {
			return `This series is under ${series.penName}. The book will be listed under ${penName.trim()} instead.`;
		}
		return null;
	});

	const input =
		'mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-fg placeholder:text-fg-muted/70';
</script>

{#snippet error(field: keyof TitleFormValues)}
	{#if errors[field]?.length}
		<p id="{field}-error" class="mt-1 text-sm text-danger">{errors[field]![0]}</p>
	{/if}
{/snippet}

{#snippet hint(text: string)}
	<p class="mt-1 text-sm text-fg-muted">{text}</p>
{/snippet}

<form
	method="POST"
	{action}
	class="mt-6 space-y-8"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<p class="rounded-md bg-surface-2 px-4 py-3 text-sm text-fg-muted">
		We ask about your book, not for your book. There's nowhere to paste a manuscript, blurb, or
		excerpt, on purpose.
	</p>

	<fieldset class="grid gap-4 sm:grid-cols-2">
		<legend class="mb-2 font-display text-heading">The book</legend>

		<label class="sm:col-span-2">
			<span class="text-sm font-medium">Working title</span>
			<input
				name="workingTitle"
				required
				maxlength="200"
				value={values.workingTitle}
				aria-invalid={!!errors.workingTitle}
				aria-describedby={errors.workingTitle ? 'workingTitle-error' : undefined}
				class={input}
			/>
			{@render error('workingTitle')}
		</label>

		<label>
			<span class="text-sm font-medium">Pen name <span class="text-fg-muted">(optional)</span></span
			>
			<input
				name="penName"
				list="pen-names"
				maxlength="120"
				bind:value={penName}
				autocomplete="off"
				class={input}
			/>
			<datalist id="pen-names">
				{#each options.penNames as name (name)}<option value={name}></option>{/each}
			</datalist>
			{@render hint('Only if you publish under more than one name.')}
			{@render error('penName')}
		</label>

		<label>
			<span class="text-sm font-medium">Stage</span>
			<select name="stage" value={values.stage || 'metadata'} class={input}>
				{#each TITLE_STAGES as stage (stage)}
					<option value={stage}>{STAGE_LABELS[stage]}</option>
				{/each}
			</select>
			{@render error('stage')}
		</label>

		<label>
			<span class="text-sm font-medium">Series <span class="text-fg-muted">(optional)</span></span>
			<input
				name="seriesTitle"
				list="series-titles"
				maxlength="200"
				bind:value={seriesTitle}
				autocomplete="off"
				class={input}
			/>
			<datalist id="series-titles">
				{#each options.series as s (s.title)}<option value={s.title}></option>{/each}
			</datalist>
			{#if seriesPenNote}
				<p class="mt-1 text-sm text-warn">{seriesPenNote}</p>
			{:else}
				{@render hint('Pick an existing series or type a new one.')}
			{/if}
			{@render error('seriesTitle')}
		</label>

		<label>
			<span class="text-sm font-medium">Position in series</span>
			<input
				name="seriesPosition"
				type="number"
				step="0.01"
				min="0.01"
				inputmode="decimal"
				value={values.seriesPosition}
				disabled={!seriesTitle.trim()}
				class="{input} disabled:opacity-50"
			/>
			{@render hint('Use 2.5 for a novella between books 2 and 3.')}
			{@render error('seriesPosition')}
		</label>

		<label>
			<span class="text-sm font-medium">Release date</span>
			<input name="releaseDate" type="date" value={values.releaseDate} class={input} />
			{@render hint('Planned or actual. The launch timeline counts from it.')}
			{@render error('releaseDate')}
		</label>
	</fieldset>

	<fieldset class="grid gap-4 sm:grid-cols-2">
		<legend class="mb-2 font-display text-heading">Positioning</legend>

		<label>
			<span class="text-sm font-medium">Genre</span>
			<input name="genre" maxlength="60" value={values.genre} class={input} />
			{@render error('genre')}
		</label>

		<label>
			<span class="text-sm font-medium">Subgenre</span>
			<input name="subgenre" maxlength="60" value={values.subgenre} class={input} />
			{@render error('subgenre')}
		</label>

		<label class="sm:col-span-2">
			<span class="text-sm font-medium">Tropes</span>
			<input
				name="tropes"
				value={values.tropes}
				placeholder="enemies to lovers, found family"
				class={input}
			/>
			{@render hint('Separate with commas. Up to 20.')}
			{@render error('tropes')}
		</label>
	</fieldset>

	<details
		open={CONTENT_RATINGS.some((r) => values[r.field] !== '')}
		class="rounded-lg border border-border bg-surface px-4 py-3"
	>
		<summary class="cursor-pointer font-display text-heading">
			Content intensity <span class="font-sans text-sm text-fg-muted">(optional)</span>
		</summary>
		<p class="mt-2 text-sm text-fg-muted">
			Rate only what matters for your genre. Leave the rest as not rated.
		</p>
		<div class="mt-4 grid gap-4 sm:grid-cols-3">
			{#each CONTENT_RATINGS as r (r.field)}
				<label>
					<span class="text-sm font-medium">{r.label}</span>
					<select name={r.field} value={values[r.field]} class={input}>
						<option value="">Not rated</option>
						{#each r.levels as label, level (level)}
							<option value={String(level)}>{level} · {label}</option>
						{/each}
					</select>
					{@render error(r.field)}
				</label>
			{/each}
		</div>
	</details>

	<fieldset class="grid gap-4 sm:grid-cols-2">
		<legend class="mb-2 font-display text-heading">Size</legend>

		<label>
			<span class="text-sm font-medium">Page count</span>
			<input
				name="pageCount"
				type="number"
				min="1"
				inputmode="numeric"
				value={values.pageCount}
				class={input}
			/>
			{@render error('pageCount')}
		</label>

		<label>
			<span class="text-sm font-medium">Word count</span>
			<input
				name="wordCount"
				type="number"
				min="1"
				inputmode="numeric"
				value={values.wordCount}
				class={input}
			/>
			{@render error('wordCount')}
		</label>
	</fieldset>

	<div class="flex items-center gap-3">
		<button
			type="submit"
			disabled={saving}
			class="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
		>
			{saving ? 'Saving…' : submitLabel}
		</button>
	</div>
</form>
