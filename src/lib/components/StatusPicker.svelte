<script lang="ts">
	import { enhance } from '$app/forms';
	import { LISTING_STATUSES, STATUS_META, type ListingStatus } from '$lib/shared/listings';
	import StatusIcon from './StatusIcon.svelte';

	// One click sets a listing's status, creating the listing if there isn't one yet.
	let {
		action,
		titleId,
		bookTitle,
		channel,
		current,
		onDone
	}: {
		/** The page whose setStatus and remove actions handle this, e.g. "?" or "/listings?". */
		action: string;
		titleId: string;
		bookTitle: string;
		channel: { slug: string; displayName: string };
		current: ListingStatus | 'none';
		onDone?: () => void;
	} = $props();

	const after = () => {
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			onDone?.();
		};
	};
</script>

<form method="POST" action="{action}/setStatus" use:enhance={after}>
	<input type="hidden" name="titleId" value={titleId} />
	<input type="hidden" name="channel" value={channel.slug} />
	<fieldset>
		<legend class="mb-2 text-sm text-fg-muted">Status on {channel.displayName}</legend>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
			{#each LISTING_STATUSES as status (status)}
				<button
					type="submit"
					name="status"
					value={status}
					aria-pressed={current === status}
					class="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-surface-2 aria-pressed:border-accent aria-pressed:bg-surface-2 aria-pressed:font-medium"
				>
					<StatusIcon {status} />
					{STATUS_META[status].label}
				</button>
			{/each}
		</div>
	</fieldset>
</form>

{#if current !== 'none'}
	<form
		method="POST"
		action="{action}/remove"
		class="mt-4"
		use:enhance={({ cancel }) => {
			if (!confirm(`Stop tracking “${bookTitle}” on ${channel.displayName}?`)) return cancel();
			return after();
		}}
	>
		<input type="hidden" name="titleId" value={titleId} />
		<input type="hidden" name="channel" value={channel.slug} />
		<button type="submit" class="text-sm font-medium text-danger hover:underline">
			Remove from {channel.displayName}
		</button>
	</form>
{/if}
