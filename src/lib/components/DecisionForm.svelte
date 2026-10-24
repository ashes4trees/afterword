<script lang="ts">
	import { enhance } from '$app/forms';
	import { DECISION_KINDS, KIND_LABELS } from '$lib/shared/decisions';

	// Logs a decision by hand (#26). Logging one of the same kind for the same book
	// replaces the current one, which stays in the log as history.

	let {
		books = null,
		error = null
	}: { books?: { id: string; title: string }[] | null; error?: string | null } = $props();

	const field = 'mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2';
</script>

<details class="mt-6 rounded-lg border border-dashed border-border px-4 py-3" open={!!error}>
	<summary class="cursor-pointer text-sm font-medium text-accent">+ Log a decision</summary>
	<form
		method="POST"
		action="?/log"
		class="mt-3 grid gap-3 text-sm sm:grid-cols-2"
		use:enhance={({ formElement }) =>
			async ({ result, update }) => {
				await update({ reset: false });
				if (result.type === 'success') {
					formElement.reset();
					formElement.closest('details')?.removeAttribute('open');
				}
			}}
	>
		<label class="sm:col-span-2">
			<span class="font-medium">What did you decide?</span>
			<input
				name="choice"
				required
				maxlength="200"
				placeholder="Going wide with the ebook"
				class={field}
			/>
		</label>
		{#if books}
			<label>
				<span class="font-medium">About</span>
				<select name="titleId" class={field}>
					<option value="">All your books</option>
					{#each books as b (b.id)}<option value={b.id}>{b.title}</option>{/each}
				</select>
			</label>
		{/if}
		<label>
			<span class="font-medium">Kind</span>
			<select name="kind" class={field}>
				{#each DECISION_KINDS as k (k)}<option value={k}>{KIND_LABELS[k]}</option>{/each}
			</select>
		</label>
		<label class="sm:col-span-2">
			<span class="font-medium">Why <span class="font-normal text-fg-muted">(optional)</span></span>
			<input
				name="rationale"
				maxlength="500"
				placeholder="Kobo readers in my genre, and KU reads dropped"
				class={field}
			/>
		</label>
		<label>
			<span class="font-medium"
				>Committed until <span class="font-normal text-fg-muted">(optional)</span></span
			>
			<input type="date" name="commitsUntil" class={field} />
		</label>
		{#if error}<p class="text-danger sm:col-span-2" role="alert">{error}</p>{/if}
		<div class="sm:col-span-2">
			<button
				type="submit"
				class="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90"
				>Log it</button
			>
		</div>
	</form>
</details>
