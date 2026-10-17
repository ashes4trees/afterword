<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import BookTabs from '$lib/components/BookTabs.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { localToday } from '$lib/shared/bookList';
	import { daysBetween, dueDistance, formatDate } from '$lib/shared/dates';

	let { data, form } = $props();

	const today = localToday();
	const keep =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });

	const overdue = (s: { dueOn: string | null; done: boolean; skipped: boolean }) =>
		!!s.dueOn && !s.done && !s.skipped && daysBetween(today, s.dueOn) < 0;
</script>

<PageHeader title={data.book.title} />
<BookTabs id={data.book.id} />

{#if form?.taskError}
	<p class="mt-4 text-sm text-danger" role="alert">{form.taskError}</p>
{/if}

{#if !data.book.releaseDate}
	<p class="mt-6 rounded-md bg-surface-2 px-4 py-3 text-sm">
		These steps are dated from the release date.
		<a
			href={resolve('/books/[id]', { id: data.book.id })}
			class="font-medium text-accent hover:underline">Add a release date</a
		> to schedule them.
	</p>
{/if}

{#each data.timelines as timeline (timeline.pack.title)}
	<ol class="mt-6 space-y-3">
		{#each timeline.steps as step (step.id)}
			<li
				class={[
					'rounded-lg border bg-surface p-4',
					overdue(step) ? 'border-warn' : 'border-border',
					(step.done || step.skipped) && 'opacity-70'
				]}
			>
				<div class="flex items-start gap-3">
					<form method="POST" action="?/done" use:enhance={keep}>
						<input type="hidden" name="task" value={step.id} />
						<input type="hidden" name="done" value={step.done ? '0' : '1'} />
						<button
							type="submit"
							disabled={step.skipped}
							aria-label={step.done ? `Mark “${step.label}” not done` : `Mark “${step.label}” done`}
							class={[
								'mt-0.5 flex size-5 items-center justify-center rounded border',
								step.done ? 'border-ok bg-ok text-bg' : 'border-fg-muted',
								'disabled:opacity-40'
							]}
						>
							{#if step.done}<span aria-hidden="true">✓</span>{/if}
						</button>
					</form>

					<div class="min-w-0 flex-1">
						<p class={['font-medium', (step.done || step.skipped) && 'line-through']}>
							{#if step.milestone}<span
									class="mr-1.5 text-warn"
									title="Milestone"
									aria-label="Milestone">★</span
								>
							{/if}{step.label}
						</p>
						<p class="mt-0.5 text-sm text-fg-muted">
							{#if step.skipped}
								Skipped for this book
							{:else if step.dueOn}
								<span class={overdue(step) ? 'font-medium text-warn' : ''}>
									{formatDate(step.dueOn)} · {overdue(step) ? 'overdue, ' : ''}{dueDistance(
										step.dueOn,
										today
									)}
								</span>
								{#if step.duePinned}· date set by you{/if}
							{:else}
								No date yet
							{/if}
						</p>
						{#if step.waitingOn.length && !step.done && !step.skipped}
							<p class="mt-1 text-sm text-fg-muted">Waiting on: {step.waitingOn.join(', ')}</p>
						{/if}

						{#if step.detail || step.gotchas.length}
							<details class="mt-2 text-sm">
								<summary class="cursor-pointer text-accent">Advice</summary>
								{#if step.detail}<p class="mt-2">{step.detail}</p>{/if}
								{#if step.gotchas.length}
									<ul class="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
										{#each step.gotchas as gotcha (gotcha)}<li>{gotcha}</li>{/each}
									</ul>
								{/if}
							</details>
						{/if}

						<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
							{#if !step.done}
								<form method="POST" action="?/skip" use:enhance={keep}>
									<input type="hidden" name="task" value={step.id} />
									<input type="hidden" name="skip" value={step.skipped ? '0' : '1'} />
									<button type="submit" class="text-fg-muted hover:text-fg hover:underline">
										{step.skipped ? 'Bring back' : 'Skip for this book'}
									</button>
								</form>
							{/if}
							{#if !step.done && !step.skipped}
								<details>
									<summary class="cursor-pointer text-fg-muted hover:text-fg">Change date</summary>
									<form
										method="POST"
										action="?/due"
										use:enhance={keep}
										class="mt-2 flex flex-wrap items-center gap-2"
									>
										<input type="hidden" name="task" value={step.id} />
										<input
											type="date"
											name="dueOn"
											value={step.dueOn ?? ''}
											required
											aria-label="New date for {step.label}"
											class="rounded-md border border-border bg-surface px-2 py-1"
										/>
										<button
											type="submit"
											class="rounded-md border border-border px-2 py-1 hover:bg-surface-2"
											>Save</button
										>
									</form>
									{#if step.duePinned}
										<form method="POST" action="?/due" use:enhance={keep} class="mt-2">
											<input type="hidden" name="task" value={step.id} />
											<input type="hidden" name="dueOn" value="" />
											<button type="submit" class="text-accent hover:underline"
												>Back to the schedule</button
											>
										</form>
									{/if}
								</details>
							{/if}
						</div>
					</div>
				</div>
			</li>
		{/each}
	</ol>

	<!-- Advice is shown without attribution (brand voice); sources live in the pack file. -->
	<footer class="mt-6 text-xs text-fg-muted">
		Advice last reviewed {formatDate(timeline.pack.asOf)}.
	</footer>
{:else}
	<p class="mt-6 text-fg-muted">No timeline steps apply to this book's formats.</p>
{/each}
