<script lang="ts">
	import { STATUS_META, type ListingStatus, type StatusTone } from '$lib/shared/listings';

	// A distinct shape per listing state, so status never depends on color alone (#11).
	let { status, class: className = 'size-5' }: { status: ListingStatus | 'none'; class?: string } =
		$props();

	const TONE: Record<StatusTone, string> = {
		faint: 'text-fg-muted/60',
		muted: 'text-fg-muted',
		info: 'text-info',
		warn: 'text-warn',
		ok: 'text-ok',
		danger: 'text-danger'
	};
	const meta = $derived(STATUS_META[status]);
</script>

<svg
	viewBox="0 0 24 24"
	class="{className} shrink-0 {TONE[meta.tone]}"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if meta.icon === 'dashed'}
		<circle cx="12" cy="12" r="8" stroke-dasharray="3 3.3" />
	{:else if meta.icon === 'circle'}
		<circle cx="12" cy="12" r="8" />
	{:else if meta.icon === 'pencil'}
		<path d="M4 20h4L19 9l-4-4L4 16z" />
		<path d="M13.5 6.5l4 4" />
	{:else if meta.icon === 'send'}
		<path d="M4 12h14M12 6l6 6-6 6" />
	{:else if meta.icon === 'hourglass'}
		<path d="M7 3h10M7 21h10M8 3v3l4 6-4 6v3M16 3v3l-4 6 4 6v3" />
	{:else if meta.icon === 'check'}
		<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
		<path d="M8 12.5l2.5 2.5L16 9.5" stroke="var(--color-bg)" stroke-width="2.25" />
	{:else if meta.icon === 'ban'}
		<circle cx="12" cy="12" r="8" />
		<path d="M6.5 6.5l11 11" />
	{/if}
</svg>
