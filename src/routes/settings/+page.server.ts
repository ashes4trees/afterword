import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { getReminderSettings, saveReminderSettings } from '$lib/server/services/reminders';
import { REMINDER_KINDS } from '$lib/shared/reminders';
import { safeReturnPath } from '$lib/shared/returnTo';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	reminders: await getReminderSettings(db, requireAuthor(locals))
});

const days = (values: FormDataEntryValue[]) => values.map((v) => Number(v));

export const actions: Actions = {
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
