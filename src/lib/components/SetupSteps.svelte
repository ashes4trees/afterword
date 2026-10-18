<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate } from '$lib/shared/dates';

	// A store's setup walkthrough on the listing editor (#14, #15). Ticking a step doesn't
	// reload the page's data, which would re-apply the listing form's values and lose
	// unsaved edits there, so each step's state is kept here once it changes.

	type Step = {
		stepId: string;
		id: string | null;
		label: string;
		detail: string | null;
		gotchas: string[];
		links: { label: string; url: string }[];
		done: boolean;
		skipped: boolean;
		waitingOn: string[];
	};

	let {
		steps,
		asOf,
		store,
		tracked
	}: { steps: Step[]; asOf: string | null; store: string; tracked: boolean } = $props();

	let changed = $state<Record<string, { done: boolean; skipped: boolean }>>({});
	const status = (s: Step) => changed[s.stepId] ?? { done: s.done, skipped: s.skipped };
	const doneCount = $derived(steps.filter((s) => status(s).done || status(s).skipped).length);

	function toggle(step: Step, next: { done: boolean; skipped: boolean }) {
		return () => {
			const before = status(step);
			changed[step.stepId] = next;
			return async ({
				result,
				update
			}: {
				result: { type: string };
				update: (o?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
			}) => {
				if (result.type === 'success') return;
				changed[step.stepId] = before;
				await update({ reset: false, invalidateAll: false });
			};
		};
	}
</script>

<section class="mt-10 max-w-2xl" aria-labelledby="setup-steps">
	<h2 id="setup-steps" class="font-display text-heading">Setting up on {store}</h2>
	<p class="mt-1 text-sm text-fg-muted">
		{#if tracked}
			{doneCount} of {steps.length} done or skipped. Take them in any order.
		{:else}
			Save this listing to start ticking these off.
		{/if}
	</p>

	<ol class="mt-4 space-y-3">
		{#each steps as step (step.stepId)}
			{@const s = status(step)}
			<li
				class={[
					'rounded-lg border border-border bg-surface p-4',
					(s.done || s.skipped) && 'opacity-70'
				]}
			>
				<div class="flex items-start gap-3">
					{#if step.id}
						<form
							method="POST"
							action="?/step"
							use:enhance={toggle(step, { done: !s.done, skipped: false })}
						>
							<input type="hidden" name="task" value={step.id} />
							<input type="hidden" name="change" value={s.done ? 'undone' : 'done'} />
							<button
								type="submit"
								disabled={s.skipped}
								aria-label={s.done ? `Mark “${step.label}” not done` : `Mark “${step.label}” done`}
								class={[
									'mt-0.5 flex size-5 items-center justify-center rounded border',
									s.done ? 'border-ok bg-ok text-bg' : 'border-fg-muted',
									'disabled:opacity-40'
								]}
							>
								{#if s.done}<span aria-hidden="true">✓</span>{/if}
							</button>
						</form>
					{/if}

					<div class="min-w-0 flex-1">
						<p class={['font-medium', (s.done || s.skipped) && 'line-through']}>{step.label}</p>
						{#if s.skipped}
							<p class="mt-0.5 text-sm text-fg-muted">Skipped for this listing</p>
						{:else if step.waitingOn.length && !s.done}
							<p class="mt-0.5 text-sm text-fg-muted">Waiting on: {step.waitingOn.join(', ')}</p>
						{/if}

						{#if step.detail || step.gotchas.length || step.links.length}
							<details class="mt-2 text-sm">
								<summary class="cursor-pointer text-accent">Advice</summary>
								{#if step.detail}<p class="mt-2">{step.detail}</p>{/if}
								{#if step.links.length}
									<p class="mt-2">
										Popular options:
										{#each step.links as link, i (link.url)}
											<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external site -->
											<a
												href={link.url}
												target="_blank"
												rel="external noopener"
												class="font-medium text-accent hover:underline"
												>{link.label}<span class="sr-only"> (opens in a new tab)</span><span
													aria-hidden="true">&nbsp;↗</span
												></a
											>{i < step.links.length - 1 ? ', ' : ''}
										{/each}
									</p>
								{/if}
								{#if step.gotchas.length}
									<ul class="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
										{#each step.gotchas as gotcha (gotcha)}<li>{gotcha}</li>{/each}
									</ul>
								{/if}
							</details>
						{/if}

						{#if step.id && !s.done}
							<form
								method="POST"
								action="?/step"
								class="mt-3 text-sm"
								use:enhance={toggle(step, { done: false, skipped: !s.skipped })}
							>
								<input type="hidden" name="task" value={step.id} />
								<input type="hidden" name="change" value={s.skipped ? 'unskip' : 'skip'} />
								<button type="submit" class="text-fg-muted hover:text-fg hover:underline">
									{s.skipped ? 'Bring back' : 'Skip for this listing'}
								</button>
							</form>
						{/if}
					</div>
				</div>
			</li>
		{/each}
	</ol>

	{#if asOf}
		<p class="mt-4 text-xs text-fg-muted">Advice last reviewed {formatDate(asOf)}.</p>
	{/if}
</section>
