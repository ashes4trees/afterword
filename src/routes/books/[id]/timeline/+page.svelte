<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import BookTabs from '$lib/components/BookTabs.svelte';
	import MyIdeaForm from '$lib/components/MyIdeaForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TimelineCalendar from '$lib/components/TimelineCalendar.svelte';
	import { page } from '$app/state';
	import { daysBetween, dueDistance, formatDate } from '$lib/shared/dates';
	import { EMPTY_MY_IDEA, IDEA_PHASES, PHASE_LABELS, describeWindow } from '$lib/shared/ideas';

	let { data, form } = $props();

	const today = $derived(data.today);
	/** List (default) or the drag-and-drop calendar (#112), kept in the URL. */
	const calendar = $derived(page.url.searchParams.get('view') === 'calendar');
	const viewTab =
		'-mb-px border-b-2 border-transparent px-3 py-1.5 text-sm text-fg-muted hover:text-fg aria-[current=page]:border-accent aria-[current=page]:font-medium aria-[current=page]:text-fg';
	const keep =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
	const keepAndClose =
		() =>
		async ({
			update,
			formElement
		}: {
			update: (o?: { reset?: boolean }) => Promise<void>;
			formElement: HTMLFormElement;
		}) => {
			await update({ reset: false });
			formElement.closest('details')?.removeAttribute('open');
		};

	const overdue = (s: { dueOn: string | null; done: boolean; skipped: boolean }) =>
		!!s.dueOn && !s.done && !s.skipped && daysBetween(today, s.dueOn) < 0;

	const SOURCE_TAG = { idea: 'Idea', author: 'Your step' } as const;
	const timesLabel = (n: number) => (n === 1 ? 'Once' : `Weekly, ${n} times`);

	/** A My ideas form that failed to save, so it can show the error and stay open. */
	const failedIdea = $derived(form && 'myIdea' in form ? form.myIdea : null);
	const failedNew = $derived(failedIdea && !failedIdea.id ? failedIdea : null);

	const field = 'rounded-md border border-border bg-surface px-2 py-1';
	const smallButton = 'rounded-md border border-border px-2 py-1 hover:bg-surface-2';
</script>

<PageHeader title={data.book.title} />
<BookTabs id={data.book.id} />

{#if form?.taskError}
	<p class="mt-4 text-sm text-danger" role="alert">{form.taskError}</p>
{/if}

<!-- eslint-disable svelte/no-navigation-without-resolve -- built on resolve() -->
<nav aria-label="Timeline view" class="mt-4 flex gap-1 border-b border-border">
	<a
		href={resolve('/books/[id]/timeline', { id: data.book.id })}
		aria-current={calendar ? undefined : 'page'}
		class={viewTab}>List</a
	>
	<a
		href="{resolve('/books/[id]/timeline', { id: data.book.id })}?view=calendar"
		aria-current={calendar ? 'page' : undefined}
		class={viewTab}>Calendar</a
	>
</nav>
<!-- eslint-enable svelte/no-navigation-without-resolve -->

{#if calendar}
	{#if data.book.releaseDate}
		<TimelineCalendar
			steps={data.timeline.steps}
			ideas={data.timeline.ideas}
			myIdeas={data.timeline.myIdeas}
			releaseDate={data.book.releaseDate}
			{today}
		/>
	{:else}
		<p class="mt-6 rounded-md bg-surface-2 px-4 py-3 text-sm">
			The calendar counts the weeks to release, so it needs a release date.
			<a
				href={resolve('/books/[id]', { id: data.book.id })}
				class="font-medium text-accent hover:underline">Add a release date</a
			>
		</p>
	{/if}
{:else}
	{#if !data.book.releaseDate}
		<p class="mt-6 rounded-md bg-surface-2 px-4 py-3 text-sm">
			These steps are dated from the release date.
			<a
				href={resolve('/books/[id]', { id: data.book.id })}
				class="font-medium text-accent hover:underline">Add a release date</a
			> to schedule them.
		</p>
	{/if}

	<ol class="mt-6 space-y-3">
		{#each data.timeline.steps as step (step.id)}
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
						<p class="flex flex-wrap items-center gap-x-2 gap-y-1">
							<span class={['font-medium', (step.done || step.skipped) && 'line-through']}
								>{step.label}</span
							>
							{#if step.milestone}
								<span
									class="rounded-full border border-warn px-2 py-0.5 text-xs font-medium text-warn"
									title="One of the big moments in your launch. Key dates show in Coming up on your home page."
									>Key date</span
								>
							{/if}
							{#if step.source !== 'playbook'}
								<span class="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-fg-muted"
									>{SOURCE_TAG[step.source]}</span
								>
							{/if}
						</p>
						<p class="mt-0.5 text-sm text-fg-muted">
							{#if step.skipped}
								{step.passedOnAdd
									? 'Skipped: this date had passed when you added the book'
									: 'Skipped for this book'}
							{:else if step.dueOn}
								<span class={overdue(step) ? 'font-medium text-warn' : ''}>
									{formatDate(step.dueOn)} · {overdue(step) ? 'overdue, ' : ''}{dueDistance(
										step.dueOn,
										today
									)}
								</span>
								{#if step.duePinned && step.source === 'playbook'}· date set by you{/if}
							{:else}
								No date yet
							{/if}
						</p>
						{#if step.waitingOn.length && !step.done && !step.skipped}
							<p class="mt-1 text-sm text-fg-muted">Waiting on: {step.waitingOn.join(', ')}</p>
						{/if}

						{#if step.detail || step.gotchas.length || step.links.length}
							<details class="mt-2 text-sm">
								<summary class="cursor-pointer text-accent">Advice</summary>
								{#if step.detail}<p class="mt-2">{step.detail}</p>{/if}
								{#if step.links.length}
									{@render links(step.links)}
								{/if}
								{#if step.gotchas.length}
									<ul class="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
										{#each step.gotchas as gotcha (gotcha)}<li>{gotcha}</li>{/each}
									</ul>
								{/if}
							</details>
						{/if}

						<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
							{#if step.source === 'playbook' && !step.done}
								<form method="POST" action="?/skip" use:enhance={keep}>
									<input type="hidden" name="task" value={step.id} />
									<input type="hidden" name="skip" value={step.skipped ? '0' : '1'} />
									<button type="submit" class="text-fg-muted hover:text-fg hover:underline">
										{step.skipped ? 'Bring back' : 'Skip for this book'}
									</button>
								</form>
							{/if}
							{#if step.source !== 'playbook'}
								<form method="POST" action="?/remove" use:enhance={keep}>
									<input type="hidden" name="task" value={step.id} />
									<button type="submit" class="text-fg-muted hover:text-fg hover:underline"
										>Remove</button
									>
								</form>
							{/if}
							{#if !step.done && !step.skipped}
								<details>
									<summary class="cursor-pointer text-fg-muted hover:text-fg">Change date</summary>
									<form
										method="POST"
										action="?/due"
										use:enhance={keepAndClose}
										class="mt-2 flex flex-wrap items-center gap-2"
									>
										<input type="hidden" name="task" value={step.id} />
										<input
											type="date"
											name="dueOn"
											value={step.dueOn ?? ''}
											required
											aria-label="New date for {step.label}"
											class={field}
										/>
										<button type="submit" class={smallButton}>Save</button>
									</form>
									{#if step.duePinned && step.source === 'playbook'}
										<form method="POST" action="?/due" use:enhance={keepAndClose} class="mt-2">
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
		{:else}
			<li class="text-fg-muted">No steps apply to this book's formats yet.</li>
		{/each}
	</ol>

	<details class="mt-4 rounded-lg border border-dashed border-border px-4 py-3">
		<summary class="cursor-pointer text-sm font-medium text-accent">+ Add your own step</summary>
		<form
			method="POST"
			action="?/addOwn"
			use:enhance={keepAndClose}
			class="mt-3 flex flex-wrap items-end gap-3"
		>
			<label class="min-w-56 flex-1">
				<span class="text-sm">What's the step?</span>
				<input name="label" required maxlength="120" class="mt-1 block w-full {field} py-2" />
			</label>
			<label>
				<span class="text-sm">Date <span class="text-fg-muted">(optional)</span></span>
				<input type="date" name="dueOn" class="mt-1 block {field} py-2" />
			</label>
			<button type="submit" class="{smallButton} py-2">Add</button>
			<div class="flex w-full flex-wrap items-center gap-2 text-sm">
				<label class="flex items-center gap-2">
					<input type="checkbox" name="save" class="size-4 accent-(--color-accent)" />
					Also save to My ideas, for other books
				</label>
				<select name="phase" aria-label="Which part of a launch it fits" class={field}>
					{#each IDEA_PHASES as p (p)}
						<option value={p} selected={p === 'prelaunch'}>{PHASE_LABELS[p]}</option>
					{/each}
				</select>
				<label class="flex items-center gap-2">
					<input type="checkbox" name="share" class="size-4 accent-(--color-accent)" />
					and share it with other authors
				</label>
			</div>
		</form>
	</details>

	{#if data.timeline.asOf}
		<p class="mt-4 text-xs text-fg-muted">Advice last reviewed {formatDate(data.timeline.asOf)}.</p>
	{/if}

	{#snippet links(items: { label: string; url: string }[])}
		<p class="mt-2">
			Popular options:
			{#each items as link, i (link.url)}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external site -->
				<a
					href={link.url}
					target="_blank"
					rel="external noopener"
					class="font-medium text-accent hover:underline"
					>{link.label}<span class="sr-only"> (opens in a new tab)</span><span aria-hidden="true"
						>&nbsp;↗</span
					></a
				>{i < items.length - 1 ? ', ' : ''}
			{/each}
		</p>
	{/snippet}

	{#snippet idea(item: (typeof data.timeline.ideas)[number]['items'][number], hidden: boolean)}
		<li class="rounded-lg border border-border bg-surface p-4">
			<p class="flex flex-wrap items-center gap-x-2 gap-y-1">
				<span class="font-medium">{item.label}</span>
				{#if item.milestone}
					<span class="rounded-full border border-warn px-2 py-0.5 text-xs font-medium text-warn"
						>Key date</span
					>
				{/if}
				{#if item.mine?.share === 'on'}
					<span class="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-fg-muted">Shared</span>
				{/if}
				{#if item.added > 0}
					<span class="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-fg-muted">
						{item.repeatable && item.added > 1
							? `On your timeline ×${item.added}`
							: 'On your timeline'}
					</span>
				{/if}
			</p>
			<p class="mt-0.5 text-sm text-fg-muted">{describeWindow(item.window)}</p>
			{#if item.detail}<p class="mt-2 text-sm">{item.detail}</p>{/if}
			{#if item.links.length}<div class="text-sm">{@render links(item.links)}</div>{/if}

			<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
				{#if hidden}
					<form method="POST" action="?/hideIdea" use:enhance={keep}>
						<input type="hidden" name="pack" value={item.pack} />
						<input type="hidden" name="stepId" value={item.stepId} />
						<input type="hidden" name="hide" value="0" />
						<button type="submit" class="text-accent hover:underline">Bring back</button>
					</form>
				{:else}
					{#if item.repeatable || item.added === 0}
						<details>
							<summary class="cursor-pointer font-medium text-accent">
								{item.added > 0 ? 'Add again' : 'Add to timeline'}
							</summary>
							<form
								method="POST"
								action="?/addIdea"
								use:enhance={keepAndClose}
								class="mt-2 flex flex-wrap items-center gap-2"
							>
								<input type="hidden" name="pack" value={item.pack} />
								<input type="hidden" name="stepId" value={item.stepId} />
								<input
									type="date"
									name="start"
									value={item.suggestedDate}
									required
									aria-label="Date for {item.label}"
									class={field}
								/>
								{#if item.repeatable}
									<select name="times" aria-label="How often" class={field}>
										{#each [1, 2, 3, 4, 6, 8] as n (n)}
											<option value={n}>{timesLabel(n)}</option>
										{/each}
									</select>
								{:else}
									<input type="hidden" name="times" value="1" />
								{/if}
								<button type="submit" class={smallButton}>Add</button>
							</form>
						</details>
					{/if}
					<form method="POST" action="?/hideIdea" use:enhance={keep}>
						<input type="hidden" name="pack" value={item.pack} />
						<input type="hidden" name="stepId" value={item.stepId} />
						<input type="hidden" name="hide" value="1" />
						<button type="submit" class="text-fg-muted hover:text-fg hover:underline"
							>Not for this book</button
						>
					</form>
					{#if item.mine}
						{@const failed = failedIdea?.id === item.stepId ? failedIdea : null}
						<details class="w-full" open={!!failed}>
							<summary class="cursor-pointer text-fg-muted hover:text-fg">Edit</summary>
							<MyIdeaForm
								id={item.stepId}
								values={failed?.values ?? item.mine}
								error={failed?.error}
							/>
							<form
								method="POST"
								action="?/deleteMyIdea"
								class="mt-3"
								use:enhance={({ cancel }) => {
									if (
										!confirm(
											`Delete “${item.label}” from My ideas? Any copies on your timelines stay.`
										)
									)
										cancel();
									return keep();
								}}
							>
								<input type="hidden" name="id" value={item.stepId} />
								<button type="submit" class="text-danger hover:underline"
									>Delete from My ideas</button
								>
							</form>
						</details>
					{/if}
				{/if}
			</div>
		</li>
	{/snippet}

	{#if data.timeline.ideas.length || data.timeline.hiddenIdeas.length}
		<section class="mt-10" aria-labelledby="ideas-heading">
			<h2 id="ideas-heading" class="font-display text-title">Ideas</h2>
			<p class="mt-1 text-fg-muted">
				Optional ways to build excitement around this book. Add the ones that fit and leave the
				rest.
			</p>

			{#each data.timeline.ideas as group (group.phase)}
				<h3 class="mt-6 font-display text-heading">{PHASE_LABELS[group.phase]}</h3>
				<ul class="mt-3 space-y-3">
					{#each group.items as item (item.stepId)}
						{@render idea(item, false)}
					{/each}
				</ul>
			{/each}

			<h3 class="mt-6 font-display text-heading">My ideas</h3>
			<p class="mt-1 text-sm text-fg-muted">
				Ideas you've saved for yourself, ready for any book. Only you see them.
			</p>
			{#if data.timeline.myIdeas.length}
				<ul class="mt-3 space-y-3">
					{#each data.timeline.myIdeas as item (item.stepId)}
						{@render idea(item, false)}
					{/each}
				</ul>
			{/if}
			<details
				class="mt-3 rounded-lg border border-dashed border-border px-4 py-3"
				open={!!failedNew}
			>
				<summary class="cursor-pointer text-sm font-medium text-accent">+ Save a new idea</summary>
				<MyIdeaForm values={failedNew?.values ?? EMPTY_MY_IDEA} error={failedNew?.error} />
			</details>

			{#if data.timeline.hiddenIdeas.length}
				<details class="mt-6">
					<summary class="cursor-pointer text-sm text-fg-muted hover:text-fg">
						Ideas you've set aside for this book ({data.timeline.hiddenIdeas.length})
					</summary>
					<ul class="mt-3 space-y-3">
						{#each data.timeline.hiddenIdeas as item (item.stepId)}
							{@render idea(item, true)}
						{/each}
					</ul>
				</details>
			{/if}

			{#if data.timeline.ideasAsOf}
				<p class="mt-4 text-xs text-fg-muted">
					Ideas last reviewed {formatDate(data.timeline.ideasAsOf)}.
				</p>
			{/if}
		</section>
	{/if}
{/if}
