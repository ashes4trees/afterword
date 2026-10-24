<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import CampaignForm from '$lib/components/CampaignForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import VerdictBadge from '$lib/components/VerdictBadge.svelte';
	import { REVIEW_INPUTS } from '$lib/shared/campaigns';
	import { formatDate } from '$lib/shared/dates';
	import { formatMoney } from '$lib/shared/money';

	let { data, form } = $props();

	const c = $derived(data.campaign);
	const money = (m: number) => formatMoney(m, c.currency);
	const latest = $derived(data.reviews[0] ?? null);
	const acos = (spend: number, sales: number) =>
		sales > 0 ? `${Math.round((spend / sales) * 100)}%` : spend > 0 ? 'no sales' : '—';
	const results = $derived(form && 'resultsValues' in form ? form.resultsValues : null);
	const inputs = (r: { inputs: unknown }) => r.inputs as Record<string, number | null>;
	const field = 'mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2';
	const keep =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<PageHeader title={c.name}>
	<a href={resolve('/ads')} class="text-accent hover:underline">← All campaigns</a>
</PageHeader>
<p class="mt-1 text-fg-muted">{data.bookTitle}</p>

<section
	class="mt-6 max-w-2xl rounded-lg border border-border bg-surface p-5"
	aria-labelledby="verdict"
>
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 id="verdict" class="font-display text-heading">Verdict</h2>
		<form method="POST" action="?/review" use:enhance={keep}>
			<button
				type="submit"
				class="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90"
				>Review now</button
			>
		</form>
	</div>
	{#if latest}
		<p class="mt-3 flex flex-wrap items-center gap-2">
			<VerdictBadge verdict={latest.verdict} />
			<span class="text-sm text-fg-muted"
				>as of {formatDate(latest.evaluatedAt.toISOString().slice(0, 10))}</span
			>
		</p>
		<p class="mt-2">{latest.explanation}</p>
		<details class="mt-2 text-sm">
			<summary class="cursor-pointer text-accent">The numbers behind it</summary>
			<dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-fg-muted">
				{#each REVIEW_INPUTS.filter((i) => i.key in inputs(latest)) as i (i.key)}
					{@const v = inputs(latest)[i.key]}
					<dt>{i.label}</dt>
					<dd>
						{v === null || v === undefined || !Number.isFinite(v)
							? '—'
							: i.format === 'money'
								? money(v)
								: i.format === 'percent'
									? `${Math.round(v * 100)}%`
									: v}
					</dd>
				{/each}
			</dl>
			<p class="mt-2 text-xs text-fg-muted">Rule {latest.ruleId}, version {latest.ruleVersion}.</p>
		</details>
	{:else}
		<p class="mt-3 text-sm text-fg-muted">
			Not reviewed yet. Record what it has spent and sold, then Review now. The verdict uses your
			target ACOS and evaluation window from Settings.
		</p>
	{/if}
</section>

<section class="mt-6 max-w-2xl" aria-labelledby="results">
	<h2 id="results" class="font-display text-heading">Results</h2>
	{#if data.results.length}
		<table class="mt-3 w-full text-left text-sm">
			<thead class="text-fg-muted">
				<tr>
					<th class="py-1 font-medium">Period</th>
					<th class="py-1 text-right font-medium">Spent</th>
					<th class="py-1 text-right font-medium">Sales</th>
					<th class="py-1 text-right font-medium">ACOS</th>
					<th class="py-1"><span class="sr-only">Remove</span></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border">
				{#each data.results as r (r.periodStart + r.periodEnd)}
					<tr>
						<td class="py-2"
							>{formatDate(r.periodStart, 'short')} – {formatDate(r.periodEnd, 'short')}</td
						>
						<td class="py-2 text-right">{money(r.spendMinor)}</td>
						<td class="py-2 text-right">{money(r.salesMinor)}</td>
						<td class="py-2 text-right">{acos(r.spendMinor, r.salesMinor)}</td>
						<td class="py-2 text-right">
							<form method="POST" action="?/deleteResults" use:enhance={keep}>
								<input type="hidden" name="periodStart" value={r.periodStart} />
								<input type="hidden" name="periodEnd" value={r.periodEnd} />
								<button type="submit" class="text-fg-muted hover:text-fg hover:underline"
									>Remove</button
								>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="mt-2 text-sm text-fg-muted">
			Nothing recorded yet. Copy the spend and sales from your ads dashboard, a week or a month at a
			time.
		</p>
	{/if}

	<details class="mt-4 rounded-lg border border-dashed border-border px-4 py-3" open={!!results}>
		<summary class="cursor-pointer text-sm font-medium text-accent">+ Record results</summary>
		<form
			method="POST"
			action="?/results"
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
			<label>
				<span class="font-medium">From</span>
				<input
					type="date"
					name="periodStart"
					required
					defaultValue={results?.periodStart ?? c.startedAt}
					class={field}
				/>
			</label>
			<label>
				<span class="font-medium">To</span>
				<input
					type="date"
					name="periodEnd"
					required
					defaultValue={results?.periodEnd ?? data.today}
					class={field}
				/>
			</label>
			<label>
				<span class="font-medium">Spent ({c.currency})</span>
				<input
					name="spend"
					inputmode="decimal"
					required
					placeholder="45.20"
					defaultValue={results?.spend ?? ''}
					class={field}
				/>
			</label>
			<label>
				<span class="font-medium">Sales ({c.currency})</span>
				<input
					name="sales"
					inputmode="decimal"
					required
					placeholder="62.00"
					defaultValue={results?.sales ?? ''}
					class={field}
				/>
			</label>
			<label>
				<span class="font-medium"
					>Impressions <span class="font-normal text-fg-muted">(optional)</span></span
				>
				<input
					name="impressions"
					inputmode="numeric"
					defaultValue={results?.impressions ?? ''}
					class={field}
				/>
			</label>
			<label>
				<span class="font-medium"
					>Clicks <span class="font-normal text-fg-muted">(optional)</span></span
				>
				<input
					name="clicks"
					inputmode="numeric"
					defaultValue={results?.clicks ?? ''}
					class={field}
				/>
			</label>
			<p class="text-xs text-fg-muted sm:col-span-2">
				Recording the same dates again replaces them.
			</p>
			{#if form && 'resultsError' in form}
				<p class="text-danger sm:col-span-2" role="alert">{form.resultsError}</p>
			{/if}
			<div class="sm:col-span-2">
				<button type="submit" class="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2"
					>Record</button
				>
			</div>
		</form>
	</details>
</section>

{#if data.reviews.length > 1}
	<section class="mt-6 max-w-2xl" aria-labelledby="history">
		<h2 id="history" class="font-display text-heading">Earlier reviews</h2>
		<ul class="mt-3 space-y-2">
			{#each data.reviews.slice(1) as r (r.id)}
				<li class="rounded-md border border-border bg-surface px-3 py-2 text-sm opacity-80">
					<p class="flex flex-wrap items-center gap-2">
						<VerdictBadge verdict={r.verdict} />
						<span class="text-fg-muted">{formatDate(r.evaluatedAt.toISOString().slice(0, 10))}</span
						>
					</p>
					<p class="mt-1">{r.explanation}</p>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="mt-8 max-w-2xl" aria-labelledby="details">
	<h2 id="details" class="font-display text-heading">Campaign details</h2>
	<CampaignForm
		values={form && 'values' in form && form.values ? form.values : data.values}
		errors={form && 'errors' in form ? form.errors : undefined}
		books={data.books}
		submitLabel="Save"
	/>
	{#if form && 'saved' in form}<p class="mt-2 text-sm text-ok" role="status">Saved.</p>{/if}
</section>

<form
	method="POST"
	action="?/delete"
	class="mt-10 border-t border-border pt-6"
	use:enhance={({ cancel }) => {
		if (!confirm(`Delete “${c.name}”, with its results and reviews?`)) cancel();
	}}
>
	<button
		type="submit"
		class="rounded-md px-3 py-2 text-sm font-medium text-danger hover:bg-surface-2"
		>Delete this campaign</button
	>
</form>
