<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import VerdictBadge from '$lib/components/VerdictBadge.svelte';
	import { STATUS_LABELS, TARGETING_LABELS } from '$lib/shared/campaigns';
	import { CHANNELS } from '$lib/shared/channels';
	import { formatMoney } from '$lib/shared/money';

	let { data } = $props();

	const groups = $derived(
		Object.entries(Object.groupBy(data.campaigns, (c) => c.bookTitle)) as [
			string,
			(typeof data.campaigns)[number][]
		][]
	);
	const store = (slug: string) => CHANNELS.find((c) => c.slug === slug)?.displayName ?? slug;
	const button =
		'inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90';
</script>

<PageHeader title="Ads">
	{#if data.campaigns.length}
		<a href={resolve('/ads/new')} class={button}>Add a campaign</a>
	{/if}
</PageHeader>

{#if data.campaigns.length === 0}
	<EmptyState title="No campaigns yet">
		Track your ad campaigns and get a keep, adjust, or stop verdict once each one has run long
		enough and spent enough to judge. The thresholds come from your settings.
		{#snippet action()}
			<a href={resolve('/ads/new')} class={button}>Add a campaign</a>
		{/snippet}
	</EmptyState>
{:else}
	{#each groups as [book, campaigns] (book)}
		<h2 class="mt-8 font-display text-heading">{book}</h2>
		<ul class="mt-3 space-y-3">
			{#each campaigns as c (c.campaign.id)}
				<li>
					<a
						href={resolve('/ads/[id]', { id: c.campaign.id })}
						class="block rounded-lg border border-border bg-surface p-4 hover:bg-surface-2"
					>
						<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
							<p class="font-medium">{c.campaign.name}</p>
							{#if c.verdict}<VerdictBadge verdict={c.verdict} />{/if}
						</div>
						<p class="mt-0.5 text-sm text-fg-muted">
							{store(c.campaign.channelSlug)} · {c.campaign.marketplace} · {TARGETING_LABELS[
								c.campaign.targetingKind
							]} · {STATUS_LABELS[c.campaign.status]}{c.campaign.dailyBudgetMinor
								? ` · ${formatMoney(c.campaign.dailyBudgetMinor, c.campaign.currency)} a day`
								: ''}
						</p>
						<p class="mt-2 text-sm">
							{c.explanation ?? 'Not reviewed yet. Record some results, then review it.'}
						</p>
					</a>
				</li>
			{/each}
		</ul>
	{/each}
{/if}
