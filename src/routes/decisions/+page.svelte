<script lang="ts">
	import DecisionForm from '$lib/components/DecisionForm.svelte';
	import DecisionLog from '$lib/components/DecisionLog.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';

	let { data, form } = $props();
</script>

<PageHeader title="Decisions" />

{#if data.decisions.length === 0}
	<EmptyState title="No decisions logged">
		A record of the calls you make, like enrolling in KDP Select or going wide, with your reasoning
		and when the commitment ends, so you're reminded before a 90-day term renews.
	</EmptyState>
{:else}
	<p class="mt-1 text-fg-muted">
		Every call you've made, newest first. Nothing here is ever edited: a new decision replaces the
		old one, which stays as history.
	</p>
	<DecisionLog decisions={data.decisions} today={data.today} />
{/if}

<DecisionForm books={data.books} error={form?.decisionError ?? null} />
