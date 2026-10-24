<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { calendarWeeks, formatDay, guessDropDate, weekOf } from '$lib/shared/calendar';
	import { formatDate } from '$lib/shared/dates';
	import { IDEA_PHASES, PHASE_LABELS, describeWindow, type IdeaPhase } from '$lib/shared/ideas';

	// The timeline's calendar view (#112): weeks counted from release day. Steps can be
	// dragged to another week and ideas dragged in from the tray; the day they land on is
	// guessed (guessDropDate) and can be changed. Every drag has a week picker beside it,
	// for keyboards and phones. Uses the page's existing `due` and `addIdea` actions.

	type Step = {
		id: string;
		source: 'playbook' | 'idea' | 'author';
		label: string;
		milestone: boolean;
		dueOn: string | null;
		done: boolean;
		skipped: boolean;
	};
	type Idea = {
		pack: string;
		stepId: string;
		label: string;
		repeatable: boolean;
		window: { from_days: number; to_days: number } | null;
		added: number;
	};

	let {
		steps,
		ideas,
		myIdeas,
		releaseDate,
		today
	}: {
		steps: Step[];
		ideas: { phase: IdeaPhase; items: Idea[] }[];
		myIdeas: Idea[];
		releaseDate: string;
		today: string;
	} = $props();

	const dated = $derived(steps.filter((s) => s.dueOn && !s.skipped));
	const undated = $derived(steps.filter((s) => !s.dueOn && !s.done && !s.skipped));
	const weeks = $derived(
		calendarWeeks(
			releaseDate,
			today,
			dated.map((s) => s.dueOn!)
		)
	);
	/** Weeks the pickers offer: this week onwards. Dragging can still reach any week. */
	const upcoming = $derived(weeks.filter((w) => w.end >= today));
	const inWeek = (week: number) =>
		dated
			.filter((s) => weekOf(releaseDate, s.dueOn!) === week)
			.sort((a, b) => a.dueOn!.localeCompare(b.dueOn!));

	/** Ideas that can still be added: anything repeatable, or not on the timeline yet. */
	const available = (items: Idea[]) => items.filter((i) => i.repeatable || i.added === 0);
	const tray = $derived([
		...IDEA_PHASES.map((phase) => ({
			title: PHASE_LABELS[phase],
			items: available(ideas.find((g) => g.phase === phase)?.items ?? [])
		})),
		{ title: 'My ideas', items: available(myIdeas) }
	]);

	type Dragged = { kind: 'step'; step: Step } | { kind: 'idea'; idea: Idea };
	let dragged = $state<Dragged | null>(null);
	let overWeek = $state<number | null>(null);
	/** An idea dropped on a week, waiting for the author to confirm its date. */
	let pending = $state<{ idea: Idea; week: number; date: string; times: number } | null>(null);
	let status = $state('');
	let busy = $state(false);

	async function post(action: string, fields: Record<string, string>) {
		busy = true;
		try {
			const body = new FormData();
			for (const [k, v] of Object.entries(fields)) body.set(k, v);
			const response = await fetch(`?/${action}`, {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const result = deserialize(await response.text());
			if (result.type === 'failure') {
				const message = (result.data as { taskError?: string } | undefined)?.taskError;
				status = message ?? 'That change could not be saved.';
				return false;
			}
			await invalidateAll();
			return true;
		} finally {
			busy = false;
		}
	}

	async function moveStep(step: Step, week: number) {
		const date = guessDropDate({ kind: 'step', dueOn: step.dueOn }, week, releaseDate, today);
		if (date === step.dueOn) return;
		if (await post('due', { task: step.id, dueOn: date })) {
			status = `Moved “${step.label}” to ${formatDay(date)}.`;
		}
	}

	function offerIdea(idea: Idea, week: number) {
		const date = guessDropDate({ kind: 'idea', window: idea.window }, week, releaseDate, today);
		pending = { idea, week, date, times: 1 };
	}

	async function addPending() {
		if (!pending) return;
		const { idea, date, times } = pending;
		const added = await post('addIdea', {
			pack: idea.pack,
			stepId: idea.stepId,
			start: date,
			times: String(times)
		});
		if (added) {
			status = `Added “${idea.label}” on ${formatDay(date)}${times > 1 ? `, weekly ×${times}` : ''}.`;
			pending = null;
		}
	}

	function drop(week: number) {
		const d = dragged;
		dragged = null;
		overWeek = null;
		if (!d) return;
		if (d.kind === 'step') void moveStep(d.step, week);
		else offerIdea(d.idea, week);
	}

	const tag = (s: Step) =>
		s.source === 'idea'
			? 'Idea'
			: s.source === 'author'
				? 'Your step'
				: s.milestone
					? 'Key date'
					: null;
	const range = (start: string, end: string) =>
		`${formatDate(start, 'short')} – ${formatDate(end, 'short')}`;
	const field = 'rounded-md border border-border bg-surface px-2 py-1 text-sm';
</script>

{#snippet weekPicker(label: string, text: string, onpick: (week: number) => void)}
	<!-- A week list instead of a select: a native select is as wide as its longest option.
	     It opens in place, so the scrolling ideas tray can't clip it. -->
	<details class="text-xs">
		<summary
			aria-label={label}
			class="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-border px-2 py-1 text-fg-muted hover:bg-surface-2 hover:text-fg"
		>
			{text}
			<svg aria-hidden="true" viewBox="0 0 12 12" class="size-3.5">
				<path
					d="M3 4.5 6 7.5 9 4.5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</summary>
		<ul class="mt-1 max-h-56 w-44 overflow-y-auto rounded-md border border-border bg-surface py-1">
			{#each upcoming as w (w.week)}
				<li>
					<button
						type="button"
						class="block w-full px-3 py-1 text-left hover:bg-surface-2"
						onclick={(e) => {
							e.currentTarget.closest('details')?.removeAttribute('open');
							onpick(w.week);
						}}>{w.label}</button
					>
				</li>
			{/each}
		</ul>
	</details>
{/snippet}

{#snippet card(step: Step)}
	{@const movable = !step.done && !step.skipped}
	<li
		draggable={movable && !busy}
		ondragstart={(e) => {
			dragged = { kind: 'step', step };
			e.dataTransfer?.setData('text/plain', step.label);
		}}
		ondragend={() => {
			dragged = null;
			overWeek = null;
		}}
		class={[
			'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-surface px-3 py-2 text-sm',
			movable ? 'cursor-grab border-border active:cursor-grabbing' : 'border-border opacity-60',
			movable && step.dueOn! < today && 'border-warn'
		]}
	>
		{#if movable}<span aria-hidden="true" class="text-fg-muted">⠿</span>{/if}
		<span class={['min-w-0 flex-1 font-medium', step.done && 'line-through']}>{step.label}</span>
		{#if tag(step)}
			<span class="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-fg-muted">{tag(step)}</span>
		{/if}
		<span class="text-xs text-fg-muted">{formatDay(step.dueOn!)}</span>
		{#if movable}{@render weekPicker(`Move “${step.label}” to another week`, 'Move', (w) =>
				moveStep(step, w)
			)}{/if}
	</li>
{/snippet}

<p class="sr-only" role="status" aria-live="polite">{status}</p>

<div class="mt-6 grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
	<aside class="md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:self-start md:overflow-y-auto">
		<details class="rounded-lg border border-border bg-surface p-3 md:open:block" open>
			<summary class="cursor-pointer font-medium">Ideas to drag in</summary>
			<p class="mt-1 text-xs text-fg-muted">
				Drag an idea onto a week, or pick a week. You'll confirm the date first.
			</p>
			{#each tray.filter((g) => g.items.length) as group (group.title)}
				<h3 class="mt-3 text-xs font-medium tracking-wide text-fg-muted uppercase">
					{group.title}
				</h3>
				<ul class="mt-1 space-y-1.5">
					{#each group.items as idea (idea.pack + idea.stepId)}
						<li
							draggable={!busy}
							ondragstart={(e) => {
								dragged = { kind: 'idea', idea };
								e.dataTransfer?.setData('text/plain', idea.label);
							}}
							ondragend={() => {
								dragged = null;
								overWeek = null;
							}}
							class="cursor-grab rounded-md border border-dashed border-border px-2 py-1.5 text-sm active:cursor-grabbing"
						>
							<p class="font-medium">{idea.label}</p>
							<p class="text-xs text-fg-muted">{describeWindow(idea.window)}</p>
							<div class="mt-1">
								{@render weekPicker(`Add “${idea.label}” to a week`, 'Add to a week', (w) =>
									offerIdea(idea, w)
								)}
							</div>
						</li>
					{/each}
				</ul>
			{/each}
		</details>
	</aside>

	<div>
		{#if status}<p class="mb-3 text-sm text-ok" aria-hidden="true">{status}</p>{/if}
		<ol class="space-y-2">
			{#each weeks as w (w.week)}
				<li
					ondragover={(e) => {
						if (!dragged) return;
						e.preventDefault();
						overWeek = w.week;
					}}
					ondragleave={() => {
						if (overWeek === w.week) overWeek = null;
					}}
					ondrop={(e) => {
						e.preventDefault();
						drop(w.week);
					}}
					class={[
						'rounded-lg border transition-colors',
						inWeek(w.week).length || pending?.week === w.week ? 'p-3' : 'px-3 py-1.5',
						overWeek === w.week
							? 'border-accent bg-surface-2'
							: w.week === 0
								? 'border-accent/60 bg-surface'
								: 'border-border bg-surface',
						w.isNow && 'ring-2 ring-warn/50'
					]}
				>
					<div class="flex flex-wrap items-baseline justify-between gap-x-3">
						<h3 class="font-medium">
							{#if w.week === 0}<span aria-hidden="true">★ </span>{/if}{w.label}
							{#if w.isNow}<span class="ml-1 text-xs font-normal text-warn">This week</span>{/if}
						</h3>
						<span class="text-xs text-fg-muted">{range(w.start, w.end)}</span>
					</div>

					{#if inWeek(w.week).length}
						<ul class="mt-2 space-y-1.5">
							{#each inWeek(w.week) as step (step.id)}{@render card(step)}{/each}
						</ul>
					{:else if dragged}
						<p class="mt-2 text-xs text-fg-muted">Drop here</p>
					{/if}

					{#if pending && pending.week === w.week}
						<div class="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-surface-2 p-2 text-sm">
							<span class="font-medium">Add “{pending.idea.label}” on</span>
							<input
								type="date"
								aria-label="Date for {pending.idea.label}"
								bind:value={pending.date}
								class={field}
							/>
							{#if pending.idea.repeatable}
								<select aria-label="How often" bind:value={pending.times} class={field}>
									{#each [1, 2, 3, 4, 6, 8] as n (n)}
										<option value={n}>{n === 1 ? 'Once' : `Weekly, ${n} times`}</option>
									{/each}
								</select>
							{/if}
							<button
								type="button"
								disabled={busy || !pending.date}
								onclick={addPending}
								class="rounded-md bg-accent px-3 py-1 font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
								>Add</button
							>
							<button
								type="button"
								onclick={() => (pending = null)}
								class="rounded-md px-2 py-1 text-fg-muted hover:text-fg">Cancel</button
							>
						</div>
					{/if}
				</li>
			{/each}
		</ol>

		{#if undated.length}
			<h3 class="mt-6 font-medium">No date yet</h3>
			<ul class="mt-2 space-y-1.5">
				{#each undated as step (step.id)}
					<li
						class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
					>
						<span class="min-w-0 flex-1 font-medium">{step.label}</span>
						{@render weekPicker(`Move “${step.label}” to another week`, 'Move', (w) =>
							moveStep(step, w)
						)}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
