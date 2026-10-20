<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { BACKUP_RETENTION_DAYS } from '$lib/shared/account';
</script>

<PageHeader title="Your account is deleted" />

<div class="mt-6 max-w-2xl space-y-3">
	<p>Your account and everything in it are gone. Thank you for trying Afterword.</p>
	<p class="text-sm text-fg-muted">
		Copies stay in nightly backups until they rotate out, within {BACKUP_RETENTION_DAYS} days. After that,
		nothing is left.
	</p>
</div>
