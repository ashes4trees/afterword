<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SetupSteps from '$lib/components/SetupSteps.svelte';
	import StatusIcon from '$lib/components/StatusIcon.svelte';
	import { guardUnsavedChanges } from '$lib/components/unsavedChanges';
	import { formatDate } from '$lib/shared/dates';
	import { LISTING_STATUSES, STATUS_META } from '$lib/shared/listings';
	import { COMMON_CURRENCIES } from '$lib/shared/money';

	let { data, form } = $props();

	const values = $derived(form && 'values' in form && form.values ? form.values : data.values);
	const errors = $derived<Record<string, string | undefined>>(
		form && 'errors' in form && form.errors ? form.errors : {}
	);
	// svelte-ignore state_referenced_locally
	let enrolled = $state(data.values.enrolled === 'on');
	let saving = $state(false);
	let formEl: HTMLFormElement | undefined = $state();
	const unsaved = guardUnsavedChanges(
		() => formEl,
		'You have unsaved changes to this listing. Leave without saving?'
	);

	const base = $derived(
		resolve('/listings/[titleId]/[channel]/[format]', {
			titleId: data.book.id,
			channel: data.channel.slug,
			format: data.format.slug
		})
	);
	const query = $derived(data.market ? `&market=${data.market}` : '');
	const currencies = $derived([
		...new Set([...COMMON_CURRENCIES, values.currency].filter(Boolean))
	]);

	const input = 'mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-fg';
	const label = 'text-sm font-medium';
</script>

{#snippet error(field: string)}
	{#if errors[field]}<p class="mt-1 text-sm text-danger">{errors[field]}</p>{/if}
{/snippet}

{#snippet advice(fields: string[])}
	{@const notes = fields.flatMap((f) => data.advice[f]?.gotchas ?? [])}
	{#if notes.length}
		<div class="mt-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
			<ul class="list-disc space-y-1 pl-4">
				{#each [...new Set(notes)] as note (note)}<li>{note}</li>{/each}
			</ul>
			<p class="mt-1 text-xs text-fg-muted">
				Advice last reviewed {formatDate(
					fields
						.map((f) => data.advice[f]?.asOf)
						.filter(Boolean)
						.sort()
						.at(-1)!
				)}.
			</p>
		</div>
	{/if}
{/snippet}

<PageHeader title="{data.book.title} · {data.format.label} on {data.channel.displayName}">
	<a href={resolve('/listings')} class="text-accent hover:underline">← All listings</a>
</PageHeader>

<!-- eslint-disable svelte/no-navigation-without-resolve -- links are built on resolve() -->
<nav
	aria-label="Marketplaces"
	class="mt-4 flex flex-wrap items-center gap-1 border-b border-border"
>
	<a
		href={base}
		aria-current={data.market === null ? 'page' : undefined}
		class="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-fg-muted hover:text-fg aria-[current=page]:border-accent aria-[current=page]:font-medium aria-[current=page]:text-fg"
		>All marketplaces</a
	>
	{#each data.markets as m (m.marketplace)}
		<a
			href="{base}?market={m.marketplace}"
			aria-current={data.market === m.marketplace ? 'page' : undefined}
			class="-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-fg-muted hover:text-fg aria-[current=page]:border-accent aria-[current=page]:font-medium aria-[current=page]:text-fg"
		>
			<StatusIcon status={m.status} class="size-3.5" />{m.marketplace}
		</a>
	{/each}
	<details class="relative px-3 py-2 text-sm">
		<summary class="cursor-pointer text-accent">+ Add a marketplace</summary>
		<form
			method="POST"
			action="?/addMarket"
			class="absolute z-20 mt-2 flex gap-2 rounded-md border border-border bg-surface p-3 shadow-lg"
		>
			<input
				name="market"
				required
				maxlength="2"
				placeholder="GB"
				aria-label="Two-letter country code"
				class="w-16 rounded-md border border-border bg-surface px-2 py-1 uppercase"
			/>
			<button type="submit" class="rounded-md border border-border px-2 py-1 hover:bg-surface-2"
				>Add</button
			>
		</form>
	</details>
</nav>
<!-- eslint-enable svelte/no-navigation-without-resolve -->

{#if form && 'marketError' in form}<p class="mt-2 text-sm text-danger">{form.marketError}</p>{/if}

<form
	bind:this={formEl}
	method="POST"
	action="?/save{query}"
	class="mt-6 max-w-2xl space-y-6"
	use:enhance={() => {
		saving = true;
		return async ({ update, result }) => {
			await update({ reset: false, invalidateAll: true });
			saving = false;
			if (result.type === 'success') await unsaved.markSaved();
		};
	}}
>
	{#if !data.listing}
		<p class="rounded-md bg-surface-2 px-4 py-3 text-sm">
			You're not tracking this {data.market ? `${data.market} ` : ''}listing yet. Saving starts
			tracking it.
		</p>
	{/if}

	<div class="grid gap-4 sm:grid-cols-2">
		<label>
			<span class={label}>Status</span>
			<select name="status" value={values.status} class={input}>
				{#each LISTING_STATUSES as s (s)}<option value={s}>{STATUS_META[s].label}</option>{/each}
			</select>
			{@render error('status')}
		</label>
		<label>
			<span class={label}
				>Store ID <span class="text-fg-muted">(ASIN, ISBN, or the store's own)</span></span
			>
			<input name="externalId" maxlength="64" value={values.externalId} class={input} />
			{@render error('externalId')}
			{@render advice(['external_id'])}
		</label>
		<div class="grid grid-cols-[1fr_auto] gap-3 sm:col-span-2">
			<label>
				<span class={label}>Price</span>
				<input
					name="price"
					inputmode="decimal"
					placeholder="4.99"
					value={values.price}
					class={input}
				/>
				{@render error('price')}
			</label>
			<label>
				<span class={label}>Currency</span>
				<select name="currency" value={values.currency} class={input}>
					{#each currencies as c (c)}<option value={c}>{c}</option>{/each}
				</select>
				{@render error('currency')}
			</label>
			<div class="col-span-2">{@render advice(['price_minor', 'currency'])}</div>
		</div>
	</div>

	{#if data.program}
		<fieldset class="rounded-lg border border-border bg-surface p-4">
			<legend class="px-1 font-display text-heading">{data.program.name}</legend>
			<label class="flex items-center gap-2">
				<input
					type="checkbox"
					name="enrolled"
					bind:checked={enrolled}
					class="size-4 accent-(--color-accent)"
				/>
				Enrolled
			</label>
			{#if enrolled}
				<div class="mt-3 grid gap-4 sm:grid-cols-2">
					<label>
						<span class={label}>Term started</span>
						<input
							type="date"
							name="exclusivityStart"
							value={values.exclusivityStart}
							class={input}
						/>
						{@render error('exclusivityStart')}
					</label>
					<label>
						<span class={label}>Term ends</span>
						<input type="date" name="exclusivityEnd" value={values.exclusivityEnd} class={input} />
						{@render error('exclusivityEnd')}
					</label>
				</div>
				<p class="mt-2 text-sm text-fg-muted">
					You'll be reminded before the term ends, so you can decide whether to stay in.
				</p>
			{/if}
			{#if data.enrollment}
				<p class="mt-3 text-sm text-fg-muted">
					Last decision: {data.enrollment.choice}{data.enrollment.commitsUntil
						? `, term ending ${formatDate(data.enrollment.commitsUntil)}`
						: ''}.
				</p>
			{/if}
			{@render advice(['enrolled_in_select', 'exclusivity_start', 'exclusivity_end'])}
		</fieldset>
	{/if}

	{#if data.printTerms}
		<fieldset class="rounded-lg border border-border bg-surface p-4">
			<legend class="px-1 font-display text-heading">Bookstore terms</legend>
			<div class="grid gap-4 sm:grid-cols-2">
				<label>
					<span class={label}>Wholesale discount (%)</span>
					<input
						name="wholesaleDiscountPct"
						type="number"
						min="0"
						max="100"
						inputmode="numeric"
						value={values.wholesaleDiscountPct}
						class={input}
					/>
					{@render error('wholesaleDiscountPct')}
					{@render advice(['wholesale_discount_pct'])}
				</label>
				<label>
					<span class={label}>Returnable</span>
					<select name="returnable" value={values.returnable} class={input}>
						<option value="">Not set</option>
						<option value="yes">Yes</option>
						<option value="no">No</option>
					</select>
					{@render advice(['returnable'])}
				</label>
			</div>
		</fieldset>
	{/if}

	<div class="flex items-center gap-3">
		<button
			type="submit"
			disabled={saving}
			class="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
		>
			{saving ? 'Saving…' : 'Save'}
		</button>
		{#if form && 'saved' in form}<p class="text-sm text-ok" role="status">Saved.</p>{/if}
	</div>
</form>

{#if form && 'stepError' in form}
	<p class="mt-10 text-sm text-danger" role="alert">{form.stepError}</p>
{/if}
{#if data.setup.steps.length}
	{#key `${data.book.id}/${data.channel.slug}/${data.format.slug}`}
		<SetupSteps
			steps={data.setup.steps}
			asOf={data.setup.asOf}
			store={data.channel.displayName}
			tracked={data.setup.steps.some((s) => s.id)}
		/>
	{/key}
{/if}

{#if data.listing}
	<form
		method="POST"
		action="?/remove{query}"
		class="mt-10 border-t border-border pt-6"
		use:enhance={({ cancel }) => {
			if (
				!confirm(
					`Stop tracking the ${data.format.label.toLowerCase()} of “${data.book.title}” on ${data.channel.displayName}${data.market ? ` (${data.market})` : ''}?`
				)
			)
				cancel();
		}}
	>
		<button
			type="submit"
			class="rounded-md px-3 py-2 text-sm font-medium text-danger hover:bg-surface-2"
		>
			Stop tracking this listing
		</button>
	</form>
{/if}
