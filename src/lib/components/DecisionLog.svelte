<script lang="ts">
	import { resolve } from '$app/paths';
	import { CHANNELS, FORMAT_LABELS, type BookFormat } from '$lib/shared/channels';
	import { dueDistance, formatDate } from '$lib/shared/dates';
	import {
		DECISION_KINDS,
		KIND_LABELS,
		SOURCE_LABELS,
		assumptionLabel,
		type DecisionKind
	} from '$lib/shared/decisions';

	// The decision log (#26): newest first, current decisions in full, replaced ones faded.

	type Decision = {
		id: string;
		kind: DecisionKind;
		choice: string;
		rationale: string | null;
		assumptions: unknown;
		commitsUntil: string | null;
		source: keyof typeof SOURCE_LABELS;
		decidedAt: Date;
		supersededBy: string | null;
		subjectType: string;
		titleId: string | null;
		bookTitle: string | null;
		channelSlug: string | null;
		format: string | null;
		marketplace: string | null;
	};

	let {
		decisions,
		today,
		showBook = true
	}: { decisions: Decision[]; today: string; showBook?: boolean } = $props();

	let kind = $state<DecisionKind | ''>('');
	let showReplaced = $state(false);
	const shown = $derived(
		decisions.filter((d) => (!kind || d.kind === kind) && (showReplaced || !d.supersededBy))
	);
	const replacedCount = $derived(decisions.filter((d) => d.supersededBy).length);

	const subject = (d: Decision) => {
		if (d.subjectType === 'author') return 'All your books';
		const store = CHANNELS.find((c) => c.slug === d.channelSlug)?.displayName;
		const format = d.format ? FORMAT_LABELS[d.format as BookFormat] : null;
		const where = [format, store && `on ${store}`, d.marketplace && `(${d.marketplace})`]
			.filter(Boolean)
			.join(' ');
		return showBook ? [d.bookTitle, where].filter(Boolean).join(' · ') : where || null;
	};
	const assumptions = (a: unknown) =>
		a && typeof a === 'object' && !Array.isArray(a)
			? Object.entries(a as Record<string, unknown>).filter(([, v]) => v !== null && v !== '')
			: [];
	const day = (d: Date) => formatDate(d.toISOString().slice(0, 10));
</script>

<div class="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
	<label class="flex items-center gap-2">
		<span class="text-fg-muted">Kind</span>
		<select bind:value={kind} class="rounded-md border border-border bg-surface px-2 py-1">
			<option value="">All</option>
			{#each DECISION_KINDS as k (k)}<option value={k}>{KIND_LABELS[k]}</option>{/each}
		</select>
	</label>
	{#if replacedCount}
		<label class="flex items-center gap-2">
			<input type="checkbox" bind:checked={showReplaced} class="size-4 accent-(--color-accent)" />
			Show replaced decisions ({replacedCount})
		</label>
	{/if}
</div>

{#if shown.length === 0}
	<p class="mt-4 text-fg-muted">
		{decisions.length ? 'No decisions match.' : 'No decisions logged yet.'}
	</p>
{:else}
	<ol class="mt-4 space-y-3">
		{#each shown as d (d.id)}
			<li
				class={['rounded-lg border border-border bg-surface p-4', d.supersededBy && 'opacity-60']}
			>
				<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
					<p class="font-medium">{d.choice}</p>
					<p class="text-sm text-fg-muted">{day(d.decidedAt)}</p>
				</div>
				<p class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
					<span class="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{KIND_LABELS[d.kind]}</span>
					{#if subject(d)}
						{#if showBook && d.titleId}
							<a
								href={resolve('/books/[id]/decisions', { id: d.titleId })}
								class="hover:text-fg hover:underline">{subject(d)}</a
							>
						{:else}
							<span>{subject(d)}</span>
						{/if}
					{/if}
					<span>· {SOURCE_LABELS[d.source]}</span>
					{#if d.supersededBy}<span>· Replaced by a later decision</span>{/if}
				</p>
				{#if d.rationale}<p class="mt-2 text-sm">{d.rationale}</p>{/if}
				{#if d.commitsUntil && !d.supersededBy}
					<p
						class={[
							'mt-2 text-sm',
							d.commitsUntil >= today ? 'font-medium text-warn' : 'text-fg-muted'
						]}
					>
						Committed until {formatDate(d.commitsUntil)}{d.commitsUntil >= today
							? ` · ${dueDistance(d.commitsUntil, today)}`
							: ' · ended'}
					</p>
				{/if}
				{#if assumptions(d.assumptions).length}
					<dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-fg-muted">
						{#each assumptions(d.assumptions) as [k, v] (k)}
							<dt>{assumptionLabel(k)}</dt>
							<dd>
								{typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatDate(v) : String(v)}
							</dd>
						{/each}
					</dl>
				{/if}
			</li>
		{/each}
	</ol>
{/if}
