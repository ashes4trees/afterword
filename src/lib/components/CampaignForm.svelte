<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		CAMPAIGN_STATUSES,
		CAMPAIGN_TYPES,
		STATUS_LABELS,
		TARGETING_KINDS,
		TARGETING_LABELS,
		TYPE_LABELS
	} from '$lib/shared/campaigns';
	import { CHANNELS } from '$lib/shared/channels';
	import { COMMON_CURRENCIES } from '$lib/shared/money';
	import { guardUnsavedChanges } from './unsavedChanges';

	// Adds or edits an ad campaign (#122).

	type Values = Record<string, string>;
	let {
		values,
		books,
		errors = {},
		submitLabel
	}: {
		values: Values;
		books: { id: string; title: string }[];
		errors?: Record<string, string[] | undefined>;
		submitLabel: string;
	} = $props();

	let formEl: HTMLFormElement | undefined = $state();
	let saving = $state(false);
	const unsaved = guardUnsavedChanges(
		() => formEl,
		'You have unsaved changes to this campaign. Leave without saving?'
	);

	const input = 'mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-fg';
	const label = 'text-sm font-medium';
	const currencies = $derived([
		...new Set([...COMMON_CURRENCIES, values.currency].filter(Boolean))
	]);
</script>

{#snippet error(field: string)}
	{#if errors[field]?.[0]}<p class="mt-1 text-sm text-danger">{errors[field]![0]}</p>{/if}
{/snippet}

<form
	bind:this={formEl}
	method="POST"
	action="?/save"
	class="mt-6 grid max-w-2xl gap-4 sm:grid-cols-2"
	use:enhance={() => {
		saving = true;
		return async ({ update, result }) => {
			await update({ reset: false });
			saving = false;
			if (result.type === 'success') await unsaved.markSaved();
		};
	}}
>
	<label class="sm:col-span-2">
		<span class={label}>Campaign name</span>
		<input name="name" required maxlength="200" defaultValue={values.name} class={input} />
		{@render error('name')}
	</label>
	<label>
		<span class={label}>Book</span>
		<select name="titleId" value={values.titleId} class={input}>
			{#each books as b (b.id)}<option value={b.id}>{b.title}</option>{/each}
		</select>
		{@render error('titleId')}
	</label>
	<label>
		<span class={label}>Status</span>
		<select name="status" value={values.status} class={input}>
			{#each CAMPAIGN_STATUSES as s (s)}<option value={s}>{STATUS_LABELS[s]}</option>{/each}
		</select>
	</label>
	<label>
		<span class={label}>Store</span>
		<select name="channelSlug" value={values.channelSlug} class={input}>
			{#each CHANNELS as c (c.slug)}<option value={c.slug}>{c.displayName}</option>{/each}
		</select>
	</label>
	<label>
		<span class={label}
			>Marketplace <span class="font-normal text-fg-muted">(country code)</span></span
		>
		<input
			name="marketplace"
			required
			maxlength="2"
			defaultValue={values.marketplace}
			class="{input} uppercase"
		/>
		{@render error('marketplace')}
	</label>
	<label>
		<span class={label}>Type</span>
		<select name="campaignType" value={values.campaignType} class={input}>
			{#each CAMPAIGN_TYPES as t (t)}<option value={t}>{TYPE_LABELS[t]}</option>{/each}
		</select>
	</label>
	<label>
		<span class={label}>Targeting</span>
		<select name="targetingKind" value={values.targetingKind} class={input}>
			{#each TARGETING_KINDS as t (t)}<option value={t}>{TARGETING_LABELS[t]}</option>{/each}
		</select>
	</label>
	<div class="grid grid-cols-[1fr_auto] gap-3 sm:col-span-2">
		<label>
			<span class={label}
				>Daily budget <span class="font-normal text-fg-muted">(optional)</span></span
			>
			<input
				name="budget"
				inputmode="decimal"
				placeholder="5.00"
				defaultValue={values.budget}
				class={input}
			/>
			{@render error('budget')}
		</label>
		<label>
			<span class={label}>Currency</span>
			<select name="currency" value={values.currency} class={input}>
				{#each currencies as c (c)}<option value={c}>{c}</option>{/each}
			</select>
		</label>
	</div>
	<label>
		<span class={label}>Started</span>
		<input type="date" name="startedAt" required defaultValue={values.startedAt} class={input} />
		{@render error('startedAt')}
	</label>
	<label>
		<span class={label}>Ended <span class="font-normal text-fg-muted">(optional)</span></span>
		<input type="date" name="endedAt" defaultValue={values.endedAt} class={input} />
		{@render error('endedAt')}
	</label>
	<div class="sm:col-span-2">
		<button
			type="submit"
			disabled={saving}
			class="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
			>{saving ? 'Saving…' : submitLabel}</button
		>
	</div>
</form>
