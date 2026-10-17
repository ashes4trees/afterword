import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { getReminderSettings, saveReminderSettings } from '$lib/server/services/reminders';
import { REMINDER_KINDS } from '$lib/shared/reminders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	reminders: await getReminderSettings(db, requireAuthor(locals))
});

const days = (values: FormDataEntryValue[]) => values.map((v) => Number(v));

export const actions: Actions = {
	reminders: async ({ request, locals }) => {
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
		return { remindersSaved: true };
	}
};
