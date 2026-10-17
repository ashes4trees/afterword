import { onMount } from 'svelte';
import { beforeNavigate } from '$app/navigation';

/** Every field's current value, including hidden inputs such as the trope chips. */
export function formSnapshot(form: HTMLFormElement): string {
	return JSON.stringify(
		[...new FormData(form)].map(([name, value]) => [name, typeof value === 'string' ? value : ''])
	);
}

/**
 * Warns before leaving a form with unsaved changes. Call during component setup.
 *
 * Compares the form against a snapshot taken when it mounted, so changing a field and
 * changing it back counts as unchanged. Following a link or using Back asks first.
 * Refreshing, closing the tab, or typing an address gets the browser's own dialog,
 * whose wording can't be changed. Programmatic navigation ("goto") is never guarded:
 * in this app it only happens after a form is submitted, such as the redirect after
 * Save or Delete.
 */
export function guardUnsavedChanges(
	getForm: () => HTMLFormElement | undefined,
	message = 'You have unsaved changes. Leave without saving?'
) {
	let initial: string | null = null;

	onMount(() => {
		const form = getForm();
		if (form) initial = formSnapshot(form);
	});

	beforeNavigate(({ type, willUnload, cancel }) => {
		if (type === 'goto' || type === 'form') return;
		const form = getForm();
		if (!form || initial === null || formSnapshot(form) === initial) return;
		// On unload the browser shows its own prompt; confirm() isn't allowed there.
		if (willUnload) cancel();
		else if (!confirm(message)) cancel();
	});
}
