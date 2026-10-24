import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAuthor } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { getBook } from '$lib/server/services/books';
import { decisionLog, logDecision } from '$lib/server/services/decisions';
import { localToday } from '$lib/shared/bookList';
import { DecisionInputSchema } from '$lib/shared/decisions';
import type { Actions, PageServerLoad } from './$types';

const bookId = (id: string) => {
	if (!z.uuid().safeParse(id).success) error(404, 'Book not found');
	return id;
};

export const load: PageServerLoad = async ({ locals, params }) => {
	const author = requireAuthor(locals);
	const book = await getBook(db, author, bookId(params.id));
	if (!book) error(404, 'Book not found');
	return {
		book: { id: book.id, title: book.workingTitle },
		decisions: await decisionLog(db, author, book.id),
		today: localToday()
	};
};

export const actions: Actions = {
	log: async ({ request, locals, params }) => {
		const parsed = DecisionInputSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) return fail(400, { decisionError: parsed.error.issues[0]!.message });
		if (!(await logDecision(db, requireAuthor(locals), bookId(params.id), parsed.data))) {
			return fail(404, { decisionError: "That book doesn't exist any more." });
		}
		return { logged: true };
	}
};
