<script lang="ts">
	let { data } = $props();
</script>

<h1 class="text-2xl font-semibold">Afterword</h1>
<p>Everything that happens after the book is finished.</p>
{#if data.author}
	<p>Signed in as {data.author.displayName}</p>
{/if}
