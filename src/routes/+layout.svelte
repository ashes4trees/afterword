<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { NAV_GROUPS, SETTINGS, isCurrent, type NavItem } from '$lib/nav';

	let { data, children } = $props();
	let menuOpen = $state(false);

	afterNavigate(() => {
		menuOpen = false;
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') menuOpen = false;
	}}
/>

{#snippet link(item: NavItem)}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- nav.ts resolves every href -->
	<a
		href={item.href}
		aria-current={isCurrent(item.href, page.url.pathname, item.exact) ? 'page' : undefined}
		class="block rounded-md px-3 py-2 text-fg-muted hover:bg-surface-2 hover:text-fg aria-[current=page]:bg-surface-2 aria-[current=page]:font-medium aria-[current=page]:text-fg"
	>
		{item.label}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{/snippet}

<a
	href="#main"
	class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
>
	Skip to content
</a>

<div class="md:flex md:min-h-dvh">
	<header
		class="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-gutter py-3 md:hidden"
	>
		<a href={resolve('/')} class="font-display text-heading">Afterword</a>
		<button
			type="button"
			aria-expanded={menuOpen}
			aria-controls="main-nav"
			onclick={() => (menuOpen = !menuOpen)}
			class="-mr-2 rounded-md p-2 text-fg-muted hover:bg-surface-2 hover:text-fg"
		>
			<span class="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
			<svg
				viewBox="0 0 24 24"
				class="size-6"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				{#if menuOpen}
					<path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
				{:else}
					<path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" />
				{/if}
			</svg>
		</button>
	</header>

	<nav
		id="main-nav"
		aria-label="Main"
		class={[
			'flex-col border-border bg-surface px-3 py-4',
			'md:sticky md:top-0 md:flex md:h-dvh md:w-sidebar md:shrink-0 md:overflow-y-auto md:border-r',
			menuOpen ? 'flex border-b' : 'hidden'
		]}
	>
		<a href={resolve('/')} class="mb-4 hidden px-3 font-display text-heading md:block">Afterword</a>

		{#each NAV_GROUPS as group, i (i)}
			<div class={i > 0 ? 'mt-4' : ''}>
				{#if group.label}
					<p class="px-3 pb-1 text-xs font-medium tracking-wide text-fg-muted uppercase">
						{group.label}
					</p>
				{/if}
				<ul>
					{#each group.items as item (item.href)}
						<li>{@render link(item)}</li>
					{/each}
				</ul>
			</div>
		{/each}

		<div class="mt-4 border-t border-border pt-4 md:mt-auto">
			{@render link(SETTINGS)}
			{#if data.author}
				<p class="px-3 pt-2 text-sm text-fg-muted">Signed in as {data.author.displayName}</p>
			{/if}
		</div>
	</nav>

	<main id="main" class="min-w-0 flex-1 px-gutter py-6 md:py-10">
		<div class="mx-auto max-w-content">
			{@render children()}
		</div>
	</main>
</div>
