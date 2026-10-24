<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import BookTabs from '$lib/components/BookTabs.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { formatDate } from '$lib/shared/dates';
	import { EDIT_PARAMS, type EditParam } from '$lib/shared/exclusivityForm';
	import { formatMoney } from '$lib/shared/money';

	let { data, form } = $props();

	const m = $derived(data.model);
	const money = (minor: number) => formatMoney(minor, m.currency);
	const top = $derived.by(() => {
		const best = Math.max(...m.scenarios.map((s) => s.monthlyMinor));
		const winners = m.scenarios.filter((s) => s.monthlyMinor === best);
		return best > 0 && winners.length === 1 ? winners[0]!.key : null;
	});
	const param = (key: string) =>
		EDIT_PARAMS[key as keyof typeof EDIT_PARAMS] as EditParam | undefined;
	const BASIS = { history: 'your history', default: 'a default', author: 'you set this' } as const;
	const UNIT = $derived<Record<EditParam, string>>({
		amazon: `${m.currency} a month`,
		wide: `${m.currency} a month`,
		direct: `${m.currency} a month`,
		pages: 'pages a month',
		rate: `${m.currency} per 1,000 pages`,
		ku: '%'
	});
	const field = 'w-32 rounded-md border border-border bg-surface px-2 py-1';
</script>

<PageHeader title={data.book.title} />
<BookTabs id={data.book.id} />

<p class="mt-4 max-w-2xl text-fg-muted">
	What the ebook might earn in a month under each option, from your own numbers. It's a model, not a
	promise: every assumption is listed below, and you can change any of them to test what you
	believe.
</p>

{#if !data.hasHistory}
	<p class="mt-4 max-w-2xl rounded-md bg-surface-2 px-4 py-3 text-sm">
		There's no sales history for this book yet, so everything starts at zero. Enter your own monthly
		numbers below to try it out.
	</p>
{/if}
{#if data.needsRate}
	<p class="mt-4 max-w-2xl rounded-md bg-surface-2 px-4 py-3 text-sm">
		There's no default KU rate for {m.currency}. Enter what KU pays you per 1,000 pages below.
	</p>
{/if}
{#if m.commitment}
	<p class="mt-4 max-w-2xl rounded-md border border-warn px-4 py-3 text-sm">
		{m.commitment.note} That's {m.commitment.daysLeft} days from now.
	</p>
{/if}

<div class="mt-6 grid gap-4 md:grid-cols-3">
	{#each m.scenarios as s (s.key)}
		<section class="rounded-lg border border-border bg-surface p-4" aria-labelledby="opt-{s.key}">
			<h2 id="opt-{s.key}" class="font-display text-heading">{s.label}</h2>
			<p class="mt-2 text-title font-medium">
				{money(s.monthlyMinor)}<span class="text-sm font-normal text-fg-muted"> a month</span>
			</p>
			{#if top === s.key}
				<p class="mt-1 text-xs font-medium text-ok">Highest on these numbers</p>
			{/if}
			{#if s.earliestStart > data.model.scenarios[0]!.earliestStart}
				<p class="mt-1 text-xs text-fg-muted">From {formatDate(s.earliestStart)}</p>
			{/if}
			<details class="mt-3 text-sm">
				<summary class="cursor-pointer text-accent">How this adds up</summary>
				<dl class="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
					{#each s.parts as p (p.label)}
						<dt class="text-fg-muted">{p.label}</dt>
						<dd class="text-right">{money(p.minor)}</dd>
					{/each}
				</dl>
			</details>
			<form
				method="POST"
				action="?/choose"
				class="mt-4 space-y-2 text-sm"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
			>
				<input type="hidden" name="option" value={s.key} />
				{#each Object.entries(data.values) as [name, value] (name)}
					<input type="hidden" {name} {value} />
				{/each}
				<label class="block">
					<span class="text-fg-muted">Why <span class="text-xs">(optional)</span></span>
					<input
						name="rationale"
						maxlength="500"
						class="mt-1 block w-full rounded-md border border-border bg-surface px-2 py-1"
					/>
				</label>
				<button
					type="submit"
					class="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2"
				>
					Choose this
				</button>
			</form>
		</section>
	{/each}
</div>

{#if form?.chosen}
	<p class="mt-4 text-sm text-ok" role="status">
		Logged in
		<a href={resolve('/books/[id]/decisions', { id: data.book.id })} class="font-medium underline"
			>this book's decisions</a
		>, with the numbers behind it.
	</p>
{/if}

<section class="mt-8 max-w-3xl" aria-labelledby="assumptions">
	<h2 id="assumptions" class="font-display text-heading">Assumptions</h2>
	{#if data.problems.length}
		<ul class="mt-2 list-disc pl-5 text-sm text-danger" role="alert">
			{#each data.problems as p (p)}<li>{p}</li>{/each}
		</ul>
	{/if}
	<form method="GET" class="mt-3">
		<ul class="divide-y divide-border rounded-lg border border-border bg-surface">
			{#each m.assumptions as a (a.key)}
				{@const name = param(a.key)}
				<li class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
					<div class="min-w-0 flex-1">
						<p>{a.label}</p>
						<p class="text-fg-muted">{a.value} · {BASIS[a.basis]}</p>
					</div>
					{#if a.editable && name}
						<label class="flex items-center gap-2">
							<span class="sr-only">{a.label}</span>
							<input
								{name}
								inputmode="decimal"
								defaultValue={data.values[name] ?? ''}
								placeholder="Change"
								class={field}
							/>
							<span class="text-xs text-fg-muted">{UNIT[name]}</span>
						</label>
					{/if}
				</li>
			{/each}
		</ul>
		<div class="mt-3 flex items-center gap-4 text-sm">
			<button
				type="submit"
				class="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90"
			>
				Update
			</button>
			{#if page.url.search}
				<a
					href={resolve('/books/[id]/select-or-wide', { id: data.book.id })}
					class="text-accent hover:underline">Back to your numbers</a
				>
			{/if}
		</div>
	</form>
	{#if m.excluded.length}
		<p class="mt-3 text-xs text-fg-muted">
			Left out, not converted: {m.excluded.map((e) => `${e.rows} ${e.currency} rows`).join(', ')}.
		</p>
	{/if}
	<p class="mt-3 text-xs text-fg-muted">Defaults last reviewed {formatDate(data.defaultsAsOf)}.</p>
</section>
