import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { listBooks } from '$lib/server/services/books';
import { decisionLog, logDecision } from '$lib/server/services/decisions';
import { localToday } from '$lib/shared/bookList';
import { DecisionInputSchema } from '$lib/shared/decisions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const author = requireAuthor(locals);
	const [decisions, books] = await Promise.all([decisionLog(db, author), listBooks(db, author)]);
	return {
		decisions,
		books: books.map((b) => ({ id: b.id, title: b.workingTitle })),
		today: localToday()
	};
};

export const actions: Actions = {
	log: async ({ request, locals }) => {
		const form = Object.fromEntries(await request.formData());
		const parsed = DecisionInputSchema.safeParse(form);
		if (!parsed.success) return fail(400, { decisionError: parsed.error.issues[0]!.message });
		const titleId = z.uuid().safeParse(form.titleId);
		if (
			!(await logDecision(
				db,
				requireAuthor(locals),
				titleId.success ? titleId.data : null,
				parsed.data
			))
		) {
			return fail(404, { decisionError: "That book doesn't exist any more." });
		}
		return { logged: true };
	}
};
