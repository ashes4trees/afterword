<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { BACKUP_RETENTION_DAYS } from '$lib/shared/account';
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
	const adsValues = $derived(form?.adsValues ?? data.ads.values);
	const adsField = 'mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2';
	let formEl: HTMLFormElement | undefined = $state();
	let saving = $state(false);
	const unsaved = guardUnsavedChanges(
		() => formEl,
		'You have unsaved settings. Leave without saving?'
	);
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
		return async ({ update, result }) => {
			await update({ reset: false, invalidateAll: true });
			saving = false;
			if (result.type === 'success') await unsaved.markSaved();
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

<section
	class="mt-6 max-w-2xl rounded-lg border border-border bg-surface p-5"
	aria-labelledby="ads-settings"
>
	<h2 id="ads-settings" class="font-display text-heading">Ads</h2>
	<p class="mt-1 text-sm text-fg-muted">
		What a campaign has to beat, and when it has run long enough to judge. Leave a field blank to
		use the default.
	</p>
	<form
		method="POST"
		action="?/ads"
		class="mt-4 grid gap-4 text-sm sm:grid-cols-3"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
	>
		<label>
			<span class="font-medium">Target ACOS (%)</span>
			<input
				name="targetAcos"
				inputmode="decimal"
				placeholder={data.ads.defaults.targetAcos}
				defaultValue={adsValues.targetAcos}
				class={adsField}
			/>
			<span class="mt-1 block text-xs text-fg-muted"
				>Over 100% is fine if KU read-through pays for it.</span
			>
		</label>
		<label>
			<span class="font-medium">Judge after (days)</span>
			<input
				name="evalDays"
				inputmode="numeric"
				placeholder={data.ads.defaults.evalDays}
				defaultValue={adsValues.evalDays}
				class={adsField}
			/>
		</label>
		<label>
			<span class="font-medium">…and spending ({data.ads.currency})</span>
			<input
				name="evalSpend"
				inputmode="decimal"
				placeholder={data.ads.defaults.evalSpend}
				defaultValue={adsValues.evalSpend}
				class={adsField}
			/>
		</label>
		{#if form?.adsError}
			<p class="text-danger sm:col-span-3" role="alert">{form.adsError}</p>
		{:else if form?.adsSaved}
			<p class="text-ok sm:col-span-3" role="status">Saved.</p>
		{/if}
		<div class="sm:col-span-3">
			<button type="submit" class="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2"
				>Save</button
			>
		</div>
	</form>
</section>

<section class="mt-6 max-w-2xl rounded-lg border border-border bg-surface p-5">
	<h2 class="font-display text-heading">Stores for new books</h2>
	{#if data.defaultStores}
		<p class="mt-1 text-sm">
			New books start with {data.defaultStores.length
				? data.defaultStores.join(', ')
				: 'no stores ticked'}.
		</p>
		<form method="POST" action="?/clearDefaultStores" use:enhance class="mt-3">
			<button
				type="submit"
				class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
			>
				Suggest stores from my latest book instead
			</button>
		</form>
	{:else}
		<p class="mt-1 text-sm text-fg-muted">
			New books start with the stores of your latest book under the same pen name. To always start
			with the same stores, tick "Start every new book with these stores" when you add a book.
		</p>
	{/if}
</section>

<section
	class="mt-6 mb-10 max-w-2xl rounded-lg border border-danger/40 bg-surface p-5"
	aria-labelledby="delete-account"
>
	<h2 id="delete-account" class="font-display text-heading">Delete your account</h2>
	<p class="mt-1 text-sm">
		This deletes your account and everything in it: books, listings, decisions, timelines, and your
		own ideas. It can't be undone.
	</p>
	<p class="mt-2 text-sm">
		Consider
		<a href={resolve('/export')} class="font-medium text-accent hover:underline"
			>downloading your data</a
		> first.
	</p>
	<p class="mt-2 text-sm text-fg-muted">
		Deleted data stays in nightly backups until they rotate out, within {BACKUP_RETENTION_DAYS} days.
	</p>
	<form
		method="POST"
		action="?/deleteAccount"
		class="mt-4 space-y-2"
		use:enhance={({ cancel }) => {
			if (!confirm('Delete your account and everything in it? This cannot be undone.')) cancel();
		}}
	>
		<label class="block text-sm">
			<span class="font-medium">Type your email, {data.email}, to confirm</span>
			<input
				name="confirmEmail"
				type="email"
				required
				autocomplete="off"
				class="mt-1 block w-full max-w-sm rounded-md border border-border bg-surface px-3 py-2"
			/>
		</label>
		{#if form?.deleteError}
			<p class="text-sm text-danger" role="alert">{form.deleteError}</p>
		{/if}
		<button
			type="submit"
			class="rounded-md bg-danger px-4 py-2 font-medium text-bg hover:opacity-90"
		>
			Delete my account
		</button>
	</form>
</section>
