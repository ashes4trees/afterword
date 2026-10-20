import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { newBookStoreOptions, setDefaultStores } from '$lib/server/services/books';
import { getReminderSettings, saveReminderSettings } from '$lib/server/services/reminders';
import { CHANNELS } from '$lib/shared/channels';
import { REMINDER_KINDS } from '$lib/shared/reminders';
import { safeReturnPath } from '$lib/shared/returnTo';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const author = requireAuthor(locals);
	const { defaults } = await newBookStoreOptions(db, author);
	return {
		reminders: await getReminderSettings(db, author),
		defaultStores:
			defaults && CHANNELS.filter((c) => defaults.includes(c.slug)).map((c) => c.displayName)
	};
};

const days = (values: FormDataEntryValue[]) => values.map((v) => Number(v));

export const actions: Actions = {
	/** Stops starting new books with fixed stores, so they're suggested from past books (#41). */
	clearDefaultStores: async ({ locals }) => {
		await setDefaultStores(db, requireAuthor(locals), null);
	},
	reminders: async ({ request, locals, url }) => {
		const form = await request.formData();
		const byKind = Object.fromEntries(
			REMINDER_KINDS.filter((kind) => form.get(`mode:${kind}`) === 'custom').map((kind) => [
				kind,
				days(form.getAll(`days:${kind}`))
			])
		);
		try {
			await saveReminderSettings(db, requireAuthor(locals), {
				lead_days: days(form.getAll('days')),
				by_kind: byKind
			});
		} catch (e) {
			if (e instanceof z.ZodError) {
				return fail(400, {
					remindersError: e.issues[0]?.message ?? 'Those reminder times could not be saved.'
				});
			}
			throw e;
		}
		// Came from another page (such as Home's "Reminder settings")? Go back there.
		const back = safeReturnPath(url.searchParams.get('return'));
		if (back) redirect(303, back);
		return { remindersSaved: true };
	}
};
