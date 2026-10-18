<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { dueDistance, formatDate } from '$lib/shared/dates';

	let { data } = $props();

	const remindersOn = $derived(data.windowDays !== null);
	const hasOverdue = $derived(data.items.some((i) => i.overdue));
	const button =
		'inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90';
</script>

<PageHeader title="Home" />

{#if !data.hasBooks}
	<EmptyState title="Nothing needs you yet">
		This page collects what needs your attention across every book: key dates coming up, exclusivity
		terms about to renew, and ad campaigns that have run long enough to judge.
		{#snippet action()}
			<a href={resolve('/books')} class={button}>Go to Books</a>
		{/snippet}
	</EmptyState>
{:else}
	<section class="mt-6" aria-labelledby="coming-up">
		<div class="flex flex-wrap items-baseline justify-between gap-2">
			<h2 id="coming-up" class="font-display text-heading">Coming up</h2>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built on resolve() -->
			<a href="{resolve('/settings')}?return=%2F" class="text-sm text-accent hover:underline"
				>Reminder settings</a
			>
		</div>

		{#if !remindersOn && data.items.length > 0}
			<p class="mt-2 text-sm text-fg-muted">Reminders are off. Overdue dates still show here.</p>
		{/if}

		{#if data.items.length === 0}
			<p class="mt-2 text-fg-muted">
				{#if !remindersOn}
					Reminders are off. You can turn them on in settings.
				{:else if data.windowDays === 0}
					Nothing due today. Enjoy the quiet.
				{:else}
					Nothing in the next {data.windowDays} days. Enjoy the quiet.
				{/if}
			</p>
		{:else}
			<ul
				class="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface"
			>
				{#each data.items as item (item.key)}
					<li>
						<a
							href={item.link.kind === 'listing'
								? resolve('/listings/[titleId]/[channel]/[format]', {
										titleId: item.link.titleId,
										channel: item.link.channel,
										format: item.link.format
									})
								: resolve('/books/[id]/timeline', { id: item.link.titleId })}
							class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2"
						>
							<div class="min-w-0 flex-1">
								<p class="font-medium">{item.label}</p>
								<p class="text-sm text-fg-muted">{item.subject}</p>
							</div>
							<div class="text-right text-sm">
								<p class={item.overdue ? 'font-medium text-warn' : 'font-medium'}>
									{item.overdue ? 'Overdue, ' : ''}{dueDistance(item.date, data.today)}
								</p>
								<p class="text-fg-muted">{formatDate(item.date)}</p>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}

		{#if hasOverdue || data.overdueHidden > 0}
			<form method="POST" action="?/overdue" use:enhance class="mt-2 text-sm text-fg-muted">
				<input type="hidden" name="hide" value={hasOverdue ? 'true' : 'false'} />
				{#if hasOverdue}
					<button class="text-accent hover:underline">Hide overdue</button>
				{:else}
					{data.overdueHidden} overdue {data.overdueHidden === 1 ? 'date' : 'dates'} hidden.
					<button class="text-accent hover:underline">Show</button>
				{/if}
			</form>
		{/if}
	</section>
{/if}
