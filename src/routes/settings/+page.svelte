<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { safeReturnPath } from '$lib/shared/returnTo';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { guardUnsavedChanges } from '$lib/components/unsavedChanges';
	import {
		LEAD_DAY_CHOICES,
		REMINDER_KINDS,
		REMINDER_KIND_LABELS,
		type ReminderKind
	} from '$lib/shared/reminders';

	let { data, form } = $props();

	// Keep ?return= on the form action so Save sends the author back where they came from.
	const returnPath = $derived(safeReturnPath(page.url.searchParams.get('return')));
	const returnQuery = $derived(returnPath ? `&return=${encodeURIComponent(returnPath)}` : '');

	const dayLabel = (d: number) =>
		d === 0 ? 'On the day' : d === 1 ? '1 day before' : `${d} days before`;
	// Offer the usual choices plus anything already saved that isn't one of them.
	const choices = (saved: number[]) =>
		[...new Set([0, ...LEAD_DAY_CHOICES, ...saved])].sort((a, b) => b - a);

	let custom = $state(
		Object.fromEntries(REMINDER_KINDS.map((k) => [k, k in data.reminders.by_kind])) as Record<
			ReminderKind,
			boolean
		>
	);
	let formEl: HTMLFormElement | undefined = $state();
	let saving = $state(false);
	guardUnsavedChanges(() => formEl, 'You have unsaved settings. Leave without saving?');
</script>

{#snippet checkboxes(name: string, saved: number[])}
	<div class="mt-2 flex flex-wrap gap-x-5 gap-y-2">
		{#each choices(saved) as d (d)}
			<label class="flex items-center gap-2">
				<input
					type="checkbox"
					{name}
					value={d}
					checked={saved.includes(d)}
					class="size-4 accent-(--color-accent)"
				/>
				{dayLabel(d)}
			</label>
		{/each}
	</div>
{/snippet}

<PageHeader title="Settings" />

<form
	bind:this={formEl}
	method="POST"
	action="?/reminders{returnQuery}"
	class="mt-6 max-w-2xl space-y-6 rounded-lg border border-border bg-surface p-5"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update({ reset: false, invalidateAll: true });
			saving = false;
		};
	}}
>
	<div>
		<h2 class="font-display text-heading">Reminders</h2>
		<p class="mt-1 text-sm text-fg-muted">
			Pick when you'd like a heads-up. Reminders show in Coming up on your home page, and by email
			once that's set up.
		</p>
	</div>

	<fieldset>
		<legend class="font-medium">Remind me</legend>
		{@render checkboxes('days', data.reminders.lead_days)}
		<p class="mt-2 text-sm text-fg-muted">Untick everything to turn reminders off.</p>
	</fieldset>

	{#each REMINDER_KINDS as kind (kind)}
		<fieldset class="border-t border-border pt-5">
			<legend class="font-medium">{REMINDER_KIND_LABELS[kind]}</legend>
			<div class="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
				<label class="flex items-center gap-2">
					<input
						type="radio"
						name="mode:{kind}"
						value="default"
						checked={!custom[kind]}
						onchange={() => (custom[kind] = false)}
						class="accent-(--color-accent)"
					/>
					Same as above
				</label>
				<label class="flex items-center gap-2">
					<input
						type="radio"
						name="mode:{kind}"
						value="custom"
						checked={custom[kind]}
						onchange={() => (custom[kind] = true)}
						class="accent-(--color-accent)"
					/>
					Choose different times
				</label>
			</div>
			{#if custom[kind]}
				{@render checkboxes(
					`days:${kind}`,
					data.reminders.by_kind[kind] ?? data.reminders.lead_days
				)}
			{/if}
		</fieldset>
	{/each}

	{#if form?.remindersError}
		<p class="text-sm text-danger" role="alert">{form.remindersError}</p>
	{:else if form?.remindersSaved}
		<p class="text-sm text-ok" role="status">Saved.</p>
	{/if}

	<button
		type="submit"
		disabled={saving}
		class="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
	>
		{saving ? 'Saving…' : 'Save'}
	</button>
</form>
