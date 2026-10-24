<script lang="ts">
	import { VERDICT_META, type CampaignVerdict } from '$lib/shared/campaigns';

	let { verdict }: { verdict: CampaignVerdict } = $props();
	const meta = $derived(VERDICT_META[verdict]);
	const tones = {
		muted: 'border-border text-fg-muted',
		ok: 'border-ok text-ok',
		accent: 'border-accent text-accent',
		warn: 'border-warn text-warn',
		danger: 'border-danger text-danger'
	};
</script>

<span class="rounded-full border px-2 py-0.5 text-xs font-medium {tones[meta.tone]}"
	>{meta.label}</span
>
