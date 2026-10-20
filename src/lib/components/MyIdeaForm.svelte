<script lang="ts">
	import { enhance } from '$app/forms';
	import { IDEA_PHASES, PHASE_LABELS, type MyIdeaFormValues } from '$lib/shared/ideas';

	// Adds or edits one of the author's own ideas (#91). A short name and note only (C2).

	let {
		id = null,
		values,
		error = null
	}: { id?: string | null; values: MyIdeaFormValues; error?: string | null } = $props();

	const field = 'mt-1 block w-full rounded-md border border-border bg-surface px-2 py-1.5';
	const side = 'rounded-md border border-border bg-surface px-2 py-1.5';
	const prefix = $derived(id ?? 'new');
</script>

<form
	method="POST"
	action="?/saveMyIdea"
	class="mt-3 space-y-3 text-sm"
	use:enhance={({ formElement }) =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				if (!id) formElement.reset();
				formElement.closest('details')?.removeAttribute('open');
			}
		}}
>
	{#if id}<input type="hidden" name="id" value={id} />{/if}
	<label class="block">
		<span class="font-medium">Idea</span>
		<input name="label" required maxlength="120" defaultValue={values.label} class={field} />
	</label>
	<label class="block">
		<span class="font-medium">Note <span class="font-normal text-fg-muted">(optional)</span></span>
		<input
			name="note"
			maxlength="280"
			defaultValue={values.note}
			placeholder="What it's for, in a line"
			class={field}
		/>
	</label>
	<div class="flex flex-wrap gap-4">
		<label>
			<span class="font-medium">When</span>
			<select name="phase" value={values.phase} class={field}>
				{#each IDEA_PHASES as p (p)}<option value={p}>{PHASE_LABELS[p]}</option>{/each}
			</select>
		</label>
		<label class="flex items-center gap-2 self-end pb-1.5">
			<input
				type="checkbox"
				name="repeatable"
				checked={values.repeatable === 'on'}
				class="size-4 accent-(--color-accent)"
			/>
			Can repeat weekly
		</label>
	</div>
	<fieldset>
		<legend class="font-medium">
			Best timing <span class="font-normal text-fg-muted">(optional, in weeks)</span>
		</legend>
		<div class="mt-1 flex flex-wrap items-center gap-2">
			<span>From</span>
			<input
				name="fromWeeks"
				inputmode="numeric"
				aria-label="From how many weeks"
				defaultValue={values.fromWeeks}
				class="w-14 {side}"
			/>
			<select
				name="fromSide"
				value={values.fromSide}
				aria-label="Before or after release"
				class={side}
			>
				<option value="before">weeks before</option>
				<option value="after">weeks after</option>
			</select>
			<span>to</span>
			<input
				name="toWeeks"
				inputmode="numeric"
				aria-label="To how many weeks"
				defaultValue={values.toWeeks}
				class="w-14 {side}"
			/>
			<select name="toSide" value={values.toSide} aria-label="Before or after release" class={side}>
				<option value="before">weeks before</option>
				<option value="after">weeks after</option>
			</select>
			<span>release</span>
		</div>
	</fieldset>
	{#if error}<p id="{prefix}-error" class="text-danger" role="alert">{error}</p>{/if}
	<button type="submit" class="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">
		{id ? 'Save changes' : 'Save idea'}
	</button>
</form>
